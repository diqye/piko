import { BrowserView, BrowserWindow, Screen } from "electrobun";
import type { CapsuleRPCSchema, EventForUpdate } from "../../shared/rpc-schema";
import type { ThemeName } from "../../shared/themes";

const SEND_INTERVAL = 150;
const WATCHDOG_INTERVAL = 30_000;
const MISSES_ALLOWED = 2;

export class CapsuleWindow {
	private static instance: CapsuleWindow | null = null;
	private win: BrowserWindow;
	private rpc: ReturnType<typeof BrowserView.defineRPC<CapsuleRPCSchema>>;
	private visible = true;
	private modelVisible = true;
	private theme: ThemeName = "blue";
	private lastEvent: EventForUpdate | null = null;
	private lastSentAt = 0;
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private missedPings = 0;

	hook = {
		hide: () => {},
	};

	private constructor() {
		const { win, rpc } = this.createWindow();
		this.win = win;
		this.rpc = rpc;
		this.startWatchdog();
	}

	// transport 绑定在具体 webview 上，webview 重建后旧通道作废，rpc 必须跟窗口一起换新
	private createWindow() {
		const rpc = BrowserView.defineRPC<CapsuleRPCSchema>({
			handlers: {
				messages: {
					hide: () => this.hook.hide(),
				},
			},
		});

		const capsuleWidth = 264;
		const capsuleHeight = 96;
		const marginTop = 12;
		const marginRight = 12;
		const display = Screen.getPrimaryDisplay();
		const frame = {
			width: capsuleWidth,
			height: capsuleHeight,
			x: display.workArea.x + display.workArea.width - capsuleWidth - marginRight,
			y: display.workArea.y + marginTop,
		};

		const win = new BrowserWindow({
			title: "piko",
			url: "views://capsuleview/index.html",
			frame,
			titleBarStyle: "hidden",
			transparent: true,
			styleMask: { Resizable: false },
			hidden: true,
			rpc,
		});
		win.setAlwaysOnTop(true);

		win.on("close", () => {
			// watchdog 换窗时旧窗口的 close 不算，只有「当前窗口」被外部关闭才清单例
			if (this.win === win) CapsuleWindow.instance = null;
		});

		win.on("dom-ready", () => {
			if (this.win !== win) return;
			// 新 webview 是白纸，最近事件和各开关状态要补发一遍
			if (this.lastEvent) rpc.send.update(this.lastEvent);
			rpc.send.toogleModel(this.modelVisible);
			rpc.send.theme(this.theme);
			if (this.visible) win.show();
		});

		return { win, rpc };
	}

	// send 底层静默吞错、探不出死活；request 超时(默认 1s)会 reject，是唯一可靠的探针
	private startWatchdog() {
		setInterval(() => {
			this.rpc.request
				.ping()
				.then(() => {
					this.missedPings = 0;
				})
				.catch(() => {
					this.missedPings++;
					if (this.missedPings >= MISSES_ALLOWED) this.recreate();
				});
		}, WATCHDOG_INTERVAL);
	}

	private recreate() {
		console.log("[piko] capsule webview unresponsive, recreating window");
		this.missedPings = 0;
		const old = this.win;
		// 先建新窗再关旧窗：保持窗口数 > 0，避免触发 exitOnLastWindowClosed 连带退出整个 app
		const { win, rpc } = this.createWindow();
		this.win = win;
		this.rpc = rpc;
		old.close();
	}

	static fromDefault(): CapsuleWindow {
		if (!CapsuleWindow.instance) {
			CapsuleWindow.instance = new CapsuleWindow();
		}
		return CapsuleWindow.instance;
	}

	// 流式 delta 每秒可达上百条，直灌 webview 会把 IPC/渲染压垮（假死主嫌疑），trailing 合并限流
	updateEvent(event: EventForUpdate) {
		this.lastEvent = event;
		const elapsed = Date.now() - this.lastSentAt;
		if (elapsed >= SEND_INTERVAL) {
			this.lastSentAt = Date.now();
			this.rpc.send.update(event);
			return;
		}
		if (this.flushTimer) return;
		this.flushTimer = setTimeout(() => {
			this.flushTimer = null;
			if (!this.lastEvent) return;
			this.lastSentAt = Date.now();
			this.rpc.send.update(this.lastEvent);
		}, SEND_INTERVAL - elapsed);
	}

	toogleModel(visible: boolean) {
		this.modelVisible = visible;
		this.rpc.send.toogleModel(visible);
	}

	setTheme(theme: ThemeName) {
		this.theme = theme;
		this.rpc.send.theme(theme);
	}

	open() {
		this.visible = true;
		this.win.show();
		return this;
	}

	hide() {
		this.visible = false;
		this.win.hide();
		return this;
	}

	show() {
		this.visible = true;
		this.win.show();
		return this;
	}
}
