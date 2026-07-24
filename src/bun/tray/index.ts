import { Tray, Utils } from "electrobun";
import { getIntegratePrompt } from "./prompts";

type MenuAction = "show-capsule" | "show-model" | "clear-sessions" | "copy-prompt" | "about" | "quit";

export class TrayMenu {
	private static instance: TrayMenu | null = null;
	private tray: Tray;
	private capsuleVisible = true;
	private modelVisible = true;
	
	hook = {
		showCapsule   : (               ) => {              },
		hideCapsule   : (               ) => {              },
		clearSessions : (               ) => {              },
		about         : (               ) => {              },
		toogleModel   : (visible:boolean) => { void visible },
	};

	private constructor() {
		this.tray = new Tray({
			image    : "views://assets/tray-icon.png",
			template : true                          ,
			width    : 16                            ,
			height   : 16                            ,
		});

		this.refreshMenu();

		this.tray.on("tray-clicked", (event) => {
			const { action } = (event as { data: { action: MenuAction } }).data;
			if (action === "show-capsule") {
				if (this.capsuleVisible) {
					this.setCapsuleVisible(false)
					this.hook.hideCapsule();
				} else {
					this.setCapsuleVisible(true)
					this.hook.showCapsule();
				}
				return;
			}
			if (action === "clear-sessions") {
				this.hook.clearSessions();
				return;
			}
			if (action === "copy-prompt") {
				Utils.clipboardWriteText(getIntegratePrompt());
				return;
			}
			if (action === "about") {
				this.hook.about();
				return;
			}
			if (action === "quit") {
				Utils.quit();
				return;
			}
			if (action === "show-model") {
				this.modelVisible = !this.modelVisible
				this.refreshMenu()
				this.hook.toogleModel(this.modelVisible)
				return;
			}
			action satisfies never;
		});
	}

	private refreshMenu() {
		this.tray.setMenu([
			{ type: "normal", label: "Show capsule", action: "show-capsule", checked: this.capsuleVisible },
			{ type: "normal", label: "Show model", action: "show-model", checked: this.modelVisible },
			{ type: "separator" },
			{ type: "normal", label: "Clear sessions", action: "clear-sessions" },
			{ type: "separator" },
			{ type: "normal", label: "Copy integration prompt", action: "copy-prompt" },
			{ type: "normal", label: "About piko", action: "about" },
			{ type: "separator" },
			{ type: "normal", label: "Quit", action: "quit" },
		]);
	}

	setCapsuleVisible(visible: boolean) {
		this.capsuleVisible = visible;
		this.refreshMenu();
	}

	static fromDefault(): TrayMenu {
		if (!TrayMenu.instance) {
			TrayMenu.instance = new TrayMenu();
		}
		return TrayMenu.instance;
	}

	destroy() {
		this.tray.remove();
		TrayMenu.instance = null;
	}
}
