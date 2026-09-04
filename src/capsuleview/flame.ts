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
	// 后层：被胶囊遮住下半，读作轮廓后面的火；
	// 粒子必须小：光晕叠光晕只会更糊，雾气感来自大而软的光斑；
	// 密集小亮核叠在一起才读作「实体火焰」
	back: { rate: 260, sizeMin: 5, sizeMax: 9, alpha: 0.36 },
	// 前层：叠在不透明胶囊底上，黑底发光感的加色优势没了，靠亮度和密度撑住对比
	front: { rate: 160, sizeMin: 5, sizeMax: 8, alpha: 0.46 },
};

// 焰色梯度：随寿命推进白热核→暗尾的 5 档。
// B 方案：每主题可用 --piko-flame-1..5 单独调色，未定义时 fallback 到 --piko-t3 派生的单色 ramp
const FLAME_VARS = ["--piko-flame-1", "--piko-flame-2", "--piko-flame-3", "--piko-flame-4", "--piko-flame-5"] as const;

const SPRITE_SIZE = 64;
let spriteCache: HTMLCanvasElement[] | null = null;
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
	spriteCache = buildSprites(base.map((s) => parseColor(s) ?? [255, 166, 64]));
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
		// 寿命缩短 + 发射率提高：粒子总数基本持平，但堆在火根，密度观感翻倍
		p.maxLife = 0.36 + Math.random() * 0.26;
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

		// 每帧设模式：主题切换即时生效，无需重建 flame；
		// lighter 加色是深底发光感的来源，浅底上退化成白看不见，改正常覆盖
		ctx.globalCompositeOperation = layer === "front" && lightBackground ? "source-over" : "lighter";

		ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

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
			// 火舌随寿命收缩 + 纵向拉伸，出生快速淡入、死亡线性淡出
			const h = p.size * (0.5 + 1.0 * (p.life / p.maxLife));
			const dw = h * 0.95;
			const dh = h * 1.8;
			// 幂次衰减替代线性：火根（寿命前期）保持高亮，火梢快速熄灭，根浓梢淡
			// 指数只到 1.2：再高平均亮度掉太快，火焰会整体变暗
			const fade = (p.life / p.maxLife) ** 1.2;
			ctx.globalAlpha = cfg.alpha * Math.min(1, Math.sqrt(intensityScale)) * Math.min(1, age01 * 10) * fade;
			ctx.drawImage(sprites()![idx]!, p.x - dw / 2, p.y - dh / 2, dw, dh);
		}
		ctx.globalAlpha = 1;

		// 烧尽逻辑：停发射后存量粒子烧完才停帧，避免画面僵住
		const burnedOut = mode === "off" && particles.length === 0;
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
