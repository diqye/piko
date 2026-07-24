import { BrowserView, BrowserWindow, Screen } from "electrobun";
import type { CapsuleRPCSchema, EventForUpdate } from "../../shared/rpc-schema";

export class CapsuleWindow {
	private static instance: CapsuleWindow | null = null;
	private win: BrowserWindow;
	private rpc: ReturnType<typeof BrowserView.defineRPC<CapsuleRPCSchema>>;

	hook = {
		hide: () => {},
	};

	private constructor() {
		const capsuleWidth = 400;
		const capsuleHeight = 128;
		const marginTop = 12;
		const marginRight = 12;
		const display = Screen.getPrimaryDisplay();
		const frame = {
			width: capsuleWidth,
			height: capsuleHeight,
			x: display.workArea.x + display.workArea.width - capsuleWidth - marginRight,
			y: display.workArea.y + marginTop,
		};

		this.rpc = BrowserView.defineRPC<CapsuleRPCSchema>({
			handlers: {
				messages: {
					hide: () => this.hook.hide(),
				},
			},
		});

		this.win = new BrowserWindow({
			title: "piko",
			url: "views://capsuleview/index.html",
			frame,
			titleBarStyle: "hidden",
			transparent: true,
			styleMask: { Resizable: false },
			hidden: true,
			rpc: this.rpc,
		});

		this.win.setAlwaysOnTop(true);
		this.win.on("close", () => {
			CapsuleWindow.instance = null;
		});
		this.win.on("dom-ready", () => {
			this.win.show();
		});
	}

	static fromDefault(): CapsuleWindow {
		if (!CapsuleWindow.instance) {
			CapsuleWindow.instance = new CapsuleWindow();
		}
		return CapsuleWindow.instance;
	}

	updateEvent(event:EventForUpdate) {
		this.rpc.send.update(event)
	}

	toogleModel(visible:boolean) {
		this.rpc.send.toogleModel(visible)
	}

	open() {
		this.win.show();
		return this;
	}

	hide() {
		this.win.hide();
		return this;
	}

	show() {
		this.win.show();
		return this;
	}
}
