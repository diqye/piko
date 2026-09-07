type Rect = { x: number; y: number; width: number; height: number };
type Vec = { x: number; y: number };
type FlameLayer = "back" | "front";

type LayerConfig = {
	rate: number; // 每秒发射粒子数
	sizeMin: number;
	sizeMax: number;
	alpha: number;
};

const LAYER_CONFIG: Record<FlameLayer, LayerConfig> = {
	// 火舌是本体，粒子已退化为飘出的余烼火星：小、稀、短命
	back: { rate: 12, sizeMin: 3, sizeMax: 6, alpha: 0.36 },
	front: { rate: 9, sizeMin: 3, sizeMax: 5, alpha: 0.46 },
};

// 焰色梯度：随寿命推进白热核→暗尾的 5 档。
// B 方案：每主题可用 --piko-flame-1..5 单独调色，未定义时 fallback 到 --piko-t3 派生的单色 ramp
const FLAME_VARS = ["--piko-flame-1", "--piko-flame-2", "--piko-flame-3", "--piko-flame-4", "--piko-flame-5"] as const;

const SPRITE_SIZE = 64;
let spriteCache: HTMLCanvasElement[] | null = null;
// 壳 sprite：中心本档亮色、外围混向最暗档再淡出，单颗粒子即「中心亮、外面渐黑」
let shellCache: HTMLCanvasElement[] | null = null;
// 亮核相对壳的尺寸：只负责中心白热，不承担轮廓
const CORE_SCALE = 0.7;
// 主题火色（rgb 字符串）：火舌 path 填充用，与 sprite 同源同色；默认值是派生 ramp 的 fallback
let paletteCache: string[] = [
	"rgb(255,225,179)",
	"rgb(255,193,121)",
	"rgb(255,166,64)",
	"rgb(232,96,38)",
	"rgb(136,44,26)",
];
// 浅底主题（ningzhi/celadon）：白底上加色只会更白，front 层降级为正常覆盖
let lightBackground = false;

function parseColor(css: string): [number, number, number] | null {
	const m = css.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
	if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
	const hex = css.trim().replace("#", "");
	if (hex.length === 3) {
		return [parseInt(hex[0]! + hex[0]!, 16), parseInt(hex[1]! + hex[1]!, 16), parseInt(hex[2]! + hex[2]!, 16)];
	}
	if (hex.length === 6) {
		return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
	}
	return null;
}

// 单色 ramp：亮火心→本色→暗尾。前档只混入少量白：
// 白热靠叠加层数堆，单粒子太白叠两层就饱和成纯白
function deriveRamp(t3: string): string[] {
	const c = parseColor(t3);
	if (!c) return ["#ffc179", "#ffb157", "#ffa640", "#e86026", "#882c1a"];
	const mix = (ratio: number, withWhite: boolean): string => {
		const t = withWhite ? 255 : 17;
		const [r, g, b] = c;
		const d = withWhite
			? [t - r, t - g, t - b]
			: // 向暗端混用暖黑，避免蓝主题尾部发灰
				[t - r, (t - g) * 0.9, (t - b) * 0.8];
		return `rgb(${Math.round(r + d[0] * ratio)} ${Math.round(g + d[1] * ratio)} ${Math.round(b + d[2] * ratio)})`;
	};
	return [mix(0.35, true), mix(0.15, true), `rgb(${c[0]} ${c[1]} ${c[2]})`, mix(0.35, false), mix(0.55, false)];
}

// 主题切换时调用：读 CSS 变量重建 sprite；5 个 token 任一缺失则走派生 ramp
export function refreshFlamePalette() {
	const style = getComputedStyle(document.documentElement);
	const tokens = FLAME_VARS.map((v) => style.getPropertyValue(v).trim());
	const base = tokens.every(Boolean)
		? (tokens as unknown as string[])
		: deriveRamp(style.getPropertyValue("--piko-t3").trim() || "#ffa640");
	const colors = base.map((s): [number, number, number] => parseColor(s) ?? [255, 166, 64]);
	spriteCache = buildSprites(colors);
	shellCache = buildShellSprites(colors);
	paletteCache = colors.map(([r, g, b]) => `rgb(${r},${g},${b})`);
	// 顺带判断胶囊底色深浅：相对亮度 > 0.6 视为浅底，决定 front 层混合模式
	const s3 = parseColor(style.getPropertyValue("--piko-s3").trim());
	lightBackground = !!s3 && (0.299 * s3[0] + 0.587 * s3[1] + 0.114 * s3[2]) / 255 > 0.6;
}

// 每帧画径向渐变太贵，颜色档位固定，预渲染成 sprite 后 drawImage
function buildSprites(colors: [number, number, number][]): HTMLCanvasElement[] {
	return colors.map(([r, g, b]) => {
		const c = document.createElement("canvas");
		c.width = SPRITE_SIZE;
		c.height = SPRITE_SIZE;
		const ctx = c.getContext("2d")!;
		const half = SPRITE_SIZE / 2;
		const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
		grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
		grad.addColorStop(0.3, `rgba(${r},${g},${b},0.5)`);
		grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
		return c;
	});
}

// 壳 sprite：中心本档亮色不透明 → 中段混向最暗档 → 最外淡出。
// 与亮核 sprite 的分工：壳撑形体和暗边，亮核叠中心白热
function buildShellSprites(colors: [number, number, number][]): HTMLCanvasElement[] {
	const darkest = colors[colors.length - 1]!;
	return colors.map(([r, g, b]) => {
		const c = document.createElement("canvas");
		c.width = SPRITE_SIZE;
		c.height = SPRITE_SIZE;
		const ctx = c.getContext("2d")!;
		const half = SPRITE_SIZE / 2;
		// 向最暗档混合，暗边保留主题色相
		const mix = (m: number) =>
			[
				Math.round(r + (darkest[0] - r) * m),
				Math.round(g + (darkest[1] - g) * m),
				Math.round(b + (darkest[2] - b) * m),
			] as const;
		const mid = mix(0.7);
		const grad = ctx.createRadialGradient(half, half, 0, half, half, half);
		grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
		grad.addColorStop(0.32, `rgba(${r},${g},${b},1)`);
		grad.addColorStop(0.62, `rgba(${mid[0]},${mid[1]},${mid[2]},0.9)`);
		grad.addColorStop(0.85, `rgba(${darkest[0]},${darkest[1]},${darkest[2]},0.5)`);
		grad.addColorStop(1, `rgba(${darkest[0]},${darkest[1]},${darkest[2]},0)`);
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
		return c;
	});
}

type OutlinePoint = { x: number; y: number; nx: number; ny: number };

type Outline = {
	verts: Vec[];
	cum: number[]; // 各顶点处累计弧长，cum[0]=0
	segLens: number[]; // 段 i = verts[i] → verts[i+1] 的长度
	normals: Vec[]; // 段 i 的外法线（直线段内恒定）
	total: number;
};

// 折线近似圆角矩形轮廓（顺时针）；顶点仅供构形，采样必须走弧长，直边顶点太稀
function buildOutline(rect: Rect, radius: number, cornerSegments: number): Outline {
	const { x, y, width: w, height: h } = rect;
	const r = Math.min(radius, w / 2, h / 2);
	const verts: Vec[] = [];
	const arc = (cx: number, cy: number, from: number) => {
		for (let i = 0; i < cornerSegments; i++) {
			const a = from + (Math.PI / 2) * (i / cornerSegments);
			verts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
		}
	};
	arc(x + r, y + r, Math.PI);
	verts.push({ x: x + w - r, y });
	arc(x + w - r, y + r, -Math.PI / 2);
	verts.push({ x: x + w, y: y + h - r });
	arc(x + w - r, y + h - r, 0);
	verts.push({ x: x + r, y: y + h });
	arc(x + r, y + h - r, Math.PI / 2);
	verts.push({ x, y: y + r });

	const n = verts.length;
	const cum: number[] = [];
	const segLens: number[] = [];
	const normals: Vec[] = [];
	let acc = 0;
	for (let i = 0; i < n; i++) {
		const a = verts[i]!;
		const b = verts[(i + 1) % n]!;
		const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
		cum.push(acc);
		segLens.push(len);
		// 顺时针轮廓的切线旋转 -90° 即外法线
		normals.push({ x: (b.y - a.y) / len, y: -(b.x - a.x) / len });
		acc += len;
	}
	return { verts, cum, segLens, normals, total: acc };
}

// 周长参数 t∈[0,1) → 轮廓点 + 外法线，按弧长均匀落点
function sampleOutline(o: Outline, t: number): OutlinePoint {
	const target = t * o.total;
	let i = o.verts.length - 1;
	while (o.cum[i]! > target) i--;
	const a = o.verts[i]!;
	const b = o.verts[(i + 1) % o.verts.length]!;
	const local = (target - o.cum[i]!) / (o.segLens[i]! || 1);
	return {
		x: a.x + (b.x - a.x) * local,
		y: a.y + (b.y - a.y) * local,
		nx: o.normals[i]!.x,
		ny: o.normals[i]!.y,
	};
}

type Particle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	size: number;
	phase: number;
	swayAmp: number;
};

// 驻留火舌：锚定在轮廓上的火根。常驻燃烧、只有摆动呼吸，不生不灭；
// 模式切换时随旺度整体涨落，这才是「开启一次之后持续燃烧」的本体
type Harm = { f: number; w: number; a: number; p: number };

type Tongue = {
	x: number;
	y: number;
	nx: number;
	ny: number;
	base: number; // 基础尺寸，最终直径 ≈ base × 1.8 × 旺度
	phase: number;
	// 和声参数组：每条火舌独立随机，频率不成整数比 → 波形永不重复，扭动才「飘忽」不机械
	harm: Harm[];
};

export type FlameMode = "bottom" | "full" | "off";

export type Flame = {
	// bottom=底部小火(thinking)、full=全轮廓旺火(working)、off=烧尽熄灭；模式切换带过渡
	setMode: (mode: FlameMode) => void;
	destroy: () => void;
};

const MAX_PARTICLES = 300;
const BUOYANCY = -70; // px/s²，火苗向上加速
const DRAG = 1.6; // 1/s，水平速度衰减
const SWAY_FREQ = 6; // rad/s，火苗横向摆动频率

// 火焰旺度：1.0 = 初版基准观感；同步缩放发射率/粒子尺寸/透明度，建议 0.3~2.0
export const DEFAULT_FLAME_INTENSITY = 1.3;
const BOTTOM_INTENSITY = 0.8; // 底部小火的旺度，低于全火避免喧宾夺主
const INTENSITY_LERP = 2.5; // 1/s，火势渐变速度，太快会瞬变没有呼吸感

export function createFlame(
	canvas: HTMLCanvasElement,
	rect: Rect,
	layer: FlameLayer,
	intensity = DEFAULT_FLAME_INTENSITY,
): Flame {
	const cfg = LAYER_CONFIG[layer];
	const sprites = () => spriteCache;
	const ctx = canvas.getContext("2d")!;
	// 胶囊是 rounded-full，半径取高度一半；上限 18 防御极端值
	const outline = buildOutline(rect, Math.min(rect.height / 2, 18), 6);
	// 沿轮廓均匀撒火舌锚点：间距即火苗疏密，均匀中带随机错落避免栅格感
	const TONGUE_SPACING = 26;
	const tongueCount = Math.max(3, Math.round(outline.total / TONGUE_SPACING));
	const tongues: Tongue[] = Array.from({ length: tongueCount }, (_, i) => {
		const pt = sampleOutline(outline, (i + Math.random()) / tongueCount);
		return {
			x: pt.x,
			y: pt.y,
			nx: pt.nx,
			ny: pt.ny,
			base: 9 + Math.random() * 5,
			phase: Math.random() * Math.PI * 2,
			// 4 层和声：空间频率沿链递增（尖端扭得更细碎），时间角速度正负交错避免同频摆
			harm: Array.from({ length: 4 }, (_, k) => ({
				f: 2.2 + Math.random() * 1.5 + k * 2.7,
				w: (1.6 + Math.random() * 2.2) * (k % 2 ? 1 : -1),
				a: 0.5 / (k + 1),
				p: Math.random() * Math.PI * 2,
			})),
		};
	});
	// 阵风：所有火舌共享同一阵风，整片火焰同向倒伏又散开；风本身低频漂移，不是周期摆动
	const windSeed = Math.random() * Math.PI * 2;
	const wind = (ts: number) => Math.sin(ts * 0.6 + windSeed) * 0.7 + Math.sin(ts * 1.7 + windSeed * 2.3) * 0.3;
	const particles: Particle[] = [];
	const freelist: Particle[] = [];
	let raf = 0;
	let running = false;
	let mode: FlameMode = "full";
	let intensityTarget = intensity;
	let intensityScale = intensity;
	let prev = 0;
	let emitAcc = 0;

	const dpr = window.devicePixelRatio || 1;
	canvas.width = Math.round(canvas.clientWidth * dpr);
	canvas.height = Math.round(canvas.clientHeight * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	const spawn = () => {
		if (particles.length >= MAX_PARTICLES) return;
		// bottom 模式只在底边点火：拒绝采样偏置，火苗从底边向上舔更符合物理
		let pt: OutlinePoint | null = null;
		for (let i = 0; i < 8 && !pt; i++) {
			const cand = sampleOutline(outline, Math.random());
			if (mode !== "bottom" || cand.ny > 0.2) pt = cand;
		}
		pt ??= sampleOutline(outline, Math.random());
		// 出生先顶出轮廓 2px 起步：火根贴边但压在轮廓外，不被不透明胶囊遮住
		const outward = 4 + Math.random() * 8;
		const p = freelist.pop() ?? ({} as Particle);
		p.x = pt.x + pt.nx * (2 + Math.random() * 4);
		p.y = pt.y + pt.ny * (2 + Math.random() * 4);
		// 底边法线朝下无意义，钳为 0，统一向上烧
		p.vx = pt.nx * outward + (Math.random() - 0.5) * 10;
		p.vy = Math.min(0, pt.ny * outward) - (13 + Math.random() * 15);
		// 火星短命即可：只是从火舌上飘起的余烼
		p.maxLife = 0.45 + Math.random() * 0.3;
		p.life = p.maxLife;
		p.size = (cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin)) * intensityScale;
		p.phase = Math.random() * Math.PI * 2;
		p.swayAmp = 20 + Math.random() * 40;
		particles.push(p);
	};

	const step = (t: number) => {
		// 钳住 dt，避免窗口唤醒瞬间大步长把粒子甩飞
		const dt = Math.min((t - prev) / 1000, 1 / 30);
		prev = t;

		// 火势向目标旺度渐变，模式切换有呼吸感
		intensityScale += (intensityTarget - intensityScale) * Math.min(1, INTENSITY_LERP * dt);

		emitAcc += cfg.rate * intensityScale * dt;
		while (emitAcc >= 1) {
			emitAcc -= 1;
			if (mode !== "off") spawn();
		}

		ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

		// 画火舌本体：真正的连续形状，不是珠子拼的——沿噪声中轴采样，
		// 宽度从根到尖按 cos^0.7 平滑收窄，左右轮廓闭合成泪滴形 path 填渐变。
		// 珠链法重叠不足就是一串可数的珠子（灯泡感），形体必须一次画整
		const TONGUE_MAX_HEIGHT = 32; // 火苗最大高度（px），防长出可视区
		const drawTongues = (ts: number, corePass: boolean) => {
			const ia = Math.min(1, intensityScale);
			const pal = paletteCache;
			ctx.globalAlpha = Math.min(1, cfg.alpha * 1.5) * ia;
			for (const tg of tongues) {
				// bottom 模式只在底边烧，与火星采样同一判定
				if (mode === "bottom" && tg.ny <= 0.2) continue;
				const breathe = 0.8 + 0.3 * (0.6 * Math.sin(ts * 1.3 + tg.phase) + 0.4 * Math.sin(ts * 3.7 + tg.phase * 2.1));
				const scale = intensityScale * breathe;
				if (scale < 0.03) continue;
				// 钳高度：旺度叠加呼吸后很容易长出可视区，火苗被截断只剩半截更难看
				const height = Math.min(tg.base * 3.4 * scale, TONGUE_MAX_HEIGHT);
				// 扭动 = 和声噪声（非整数频率比，波形永不重复），摆幅乘 s：根部锁死、尖端细扭
				const wob = (s: number) => {
					let v = 0;
					for (const h of tg.harm) v += h.a * Math.sin(s * h.f + ts * h.w + h.p);
					return v * height * 0.22 * s;
				};
				// 中轴：顶出法线起步 + 向上生长 + 阵风整条吹（根部不动、尖端 s² 倒伏）
				const N = 10;
				const axis: Array<[number, number]> = [];
				for (let j = 0; j <= N; j++) {
					const s = j / N;
					axis.push([
						tg.x + tg.nx * 2 + wob(s) + wind(ts) * height * 0.4 * s * s,
						tg.y + tg.ny * 2 - s * height,
					]);
				}
				// 半宽轮廓：根 ≈ base×0.95，尖端收 0；内芯收窄到 35%，白热区只留一线
				const widthScale = corePass ? 0.35 : 1;
				const half = (s: number) => tg.base * 0.95 * Math.pow(Math.cos((s * Math.PI) / 2), 0.7) * scale * widthScale;
				// 轮廓点 = 轴点 + 切线法线 × 半宽
				const edge = (j: number, side: number): [number, number] => {
					const s = j / N;
					const [x, y] = axis[j]!;
					const k = j === N ? j - 1 : j;
					const dx = axis[k + 1]![0] - axis[k]![0];
					const dy = axis[k + 1]![1] - axis[k]![1];
					const len = Math.hypot(dx, dy) || 1;
					const w = half(s);
					return [x - side * (dy / len) * w, y + side * (dx / len) * w];
				};
				ctx.beginPath();
				for (let j = 0; j <= N; j++) {
					// 左侧：根→尖
					const [px, py] = edge(j, -1);
					if (j === 0) ctx.moveTo(px, py);
					else ctx.lineTo(px, py);
				}
				for (let j = N; j >= 0; j--) {
					// 右侧：尖→根，闭合出连续泪滴
					const [px, py] = edge(j, 1);
					ctx.lineTo(px, py);
				}
				ctx.closePath();
				// 渐变沿中轴：壳层中色→暗尾撑轮廓，内芯白热→中色撑「中心亮」
				const [rx, ry] = axis[0]!;
				const [tx, ty] = axis[N]!;
				const g = ctx.createLinearGradient(rx, ry, tx, ty);
				if (corePass) {
					g.addColorStop(0, pal[0]!);
					g.addColorStop(0.55, pal[1]!);
					g.addColorStop(1, pal[2]!);
				} else {
					g.addColorStop(0, pal[1]!);
					g.addColorStop(0.5, pal[2]!);
					g.addColorStop(1, pal[4]!);
				}
				ctx.fillStyle = g;
				ctx.fill();
			}
		};
		const ts = t / 1000;

		// 两遍绘制：先画壳再点亮核。壳中心是不透明亮色，能盖住别的火苗的暗边，
		// 密集区堆出实心火团、外围自然渐黑。
		// 第一遍（火舌壳 + 物理更新 + 火星壳）必须走 source-over：lighter 下画暗色等于没画
		ctx.globalCompositeOperation = "source-over";
		drawTongues(ts, false);
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i]!;
			p.life -= dt;
			if (p.life <= 0) {
				const last = particles.pop()!;
				if (i < particles.length) particles[i] = last;
				freelist.push(p);
				continue;
			}
			p.vy += BUOYANCY * dt;
			p.vx -= p.vx * DRAG * dt;
			p.vx += Math.sin((t / 1000) * SWAY_FREQ + p.phase) * p.swayAmp * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;

			const age01 = 1 - p.life / p.maxLife;
			const idx = Math.min(FLAME_VARS.length - 1, Math.floor(age01 * FLAME_VARS.length));
			const h = p.size * (0.5 + 1.0 * (p.life / p.maxLife));
			const fade = (p.life / p.maxLife) ** 1.2;
			const dw = h * 0.95;
			const dh = h * 1.8;
			ctx.globalAlpha = cfg.alpha * Math.min(1, Math.sqrt(intensityScale)) * Math.min(1, age01 * 10) * fade;
			ctx.drawImage(shellCache![idx]!, p.x - dw / 2, p.y - dh / 2, dw, dh);
		}

		// 第二遍亮核（比壳小，只叠中心）：lighter 加色是深底发光感的来源，浅底上退化成白看不见，改正常覆盖
		ctx.globalCompositeOperation = layer === "front" && lightBackground ? "source-over" : "lighter";
		drawTongues(ts, true);
		for (const p of particles) {
			const age01 = 1 - p.life / p.maxLife;
			const idx = Math.min(FLAME_VARS.length - 1, Math.floor(age01 * FLAME_VARS.length));
			// 火舌随寿命收缩 + 纵向拉伸，出生快速淡入、死亡线性淡出
			const h = p.size * (0.5 + 1.0 * (p.life / p.maxLife));
			const dw = h * 0.95 * CORE_SCALE;
			const dh = h * 1.8 * CORE_SCALE;
			// 幂次衰减替代线性：火根（寿命前期）保持高亮，火梢快速熄灭，根浓梢淡
			// 指数只到 1.2：再高平均亮度掉太快，火焰会整体变暗
			const fade = (p.life / p.maxLife) ** 1.2;
			ctx.globalAlpha = cfg.alpha * Math.min(1, Math.sqrt(intensityScale)) * Math.min(1, age01 * 10) * fade;
			ctx.drawImage(sprites()![idx]!, p.x - dw / 2, p.y - dh / 2, dw, dh);
		}
		ctx.globalAlpha = 1;

		// 烧尽逻辑：火舌随旺度缩没 + 存量火星烧完才停帧，避免画面僵住
		const burnedOut = mode === "off" && particles.length === 0 && intensityScale < 0.03;
		if (!burnedOut) raf = requestAnimationFrame(step);
		else running = false;
	};

	return {
		setMode(next: FlameMode) {
			mode = next;
			intensityTarget = next === "off" ? 0 : next === "bottom" ? BOTTOM_INTENSITY : DEFAULT_FLAME_INTENSITY;
			if (!running) {
				running = true;
				prev = performance.now();
			raf = requestAnimationFrame(step);
			}
		},
		destroy() {
			running = false;
			cancelAnimationFrame(raf);
			particles.length = 0;
			ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
		},
	};
}
