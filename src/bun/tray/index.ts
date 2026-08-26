import { Tray, Utils } from "electrobun";
import { getIntegratePrompt } from "./prompts";
import { THEMES, type ThemeName } from "../../shared/themes";

type MenuAction = "show-capsule" | "show-model" | "clear-sessions" | "copy-prompt" | "about" | "quit" | "theme";

export class TrayMenu {
	private static instance: TrayMenu | null = null;
	private tray: Tray;
	private capsuleVisible = true;
	private modelVisible = true;
	private theme: ThemeName = "blue";
	
	hook = {
		showCapsule   : (               ) => {              },
		hideCapsule   : (               ) => {              },
		clearSessions : (               ) => {              },
		about         : (               ) => {              },
		toogleModel   : (visible:boolean) => { void visible },
		setTheme      : (theme:ThemeName) => { void theme   },
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
			// event.data = { id: trayId, action, data?: 自定义 data }，菜单项的 data 在 data.data
			const trayEvent = (event as { data: { action: MenuAction; data?: { id?: ThemeName } } }).data;
			const { action } = trayEvent;
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
			if (action === "theme") {
				const id = trayEvent.data?.id;
				if (id == null) return;
				this.setTheme(id);
				this.hook.setTheme(id);
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
			{
				type: "normal",
				label: `Theme: ${THEMES.find(t => t.id === this.theme)?.label ?? ""}`,
				submenu: THEMES.map(t => ({
					type: "normal" as const,
					label: t.label,
					action: "theme",
					data: { id: t.id },
					checked: t.id === this.theme,
				})),
			},
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

	setTheme(theme: ThemeName) {
		this.theme = theme;
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
