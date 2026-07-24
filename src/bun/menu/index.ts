import { ApplicationMenu, app } from "electrobun";

type MenuAction = "about" | "quit";

type SetupApplicationMenuOptions = {
	onAbout: () => void;
};

export function setupApplicationMenu(options: SetupApplicationMenuOptions) {
	ApplicationMenu.setApplicationMenu([
		{
			label: "piko",
			submenu: [
				{ label: "About piko", action: "about" },
				{ type: "separator" },
				{ label: "Quit piko", action: "quit", accelerator: "Cmd+Q" },
			],
		},
	]);

	ApplicationMenu.on("application-menu-clicked", (event) => {
		const { action } = (event as { data: { action: MenuAction } }).data;
		if (action === "about") {
			options.onAbout();
			return;
		}
		if (action === "quit") {
			app.quit();
			return;
		}
		action satisfies never;
	});
}
