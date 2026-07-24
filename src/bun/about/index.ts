import { BrowserView, BrowserWindow, Utils } from "electrobun";
import { getCenteredPositionInPrimaryDisplay } from "../kit/kit";
import type { AboutRPCSchema } from "../../shared/rpc-schema";

export function showAbout() {
	const width = 700;
	const height = 700;
	const [x, y] = getCenteredPositionInPrimaryDisplay(width, height);

	const rpc = BrowserView.defineRPC<AboutRPCSchema>({
		handlers: {
			messages: {
				openExternal: (url: string) => {
					Utils.openExternal(url);
				},
			},
		},
	});

	const win = new BrowserWindow({
		title: "About Piko",
		url: "views://aboutview/index.html",
		frame: { x, y, width, height },
		hidden: true,
		rpc,
	});
	win.on("dom-ready", () => {
		win.show();
	});
}