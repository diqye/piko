// 禁用 WKWebView 默认右键菜单（Inspect Element / Developer Tools）
document.addEventListener("contextmenu", (e) => e.preventDefault());

import { version } from "../../package.json";
import { Electroview } from "electrobun/view";
import type { AboutRPCSchema } from "../shared/rpc-schema";

document.getElementById("version")!.textContent = `v${version}`;

const rpc = Electroview.defineRPC<AboutRPCSchema>({
	handlers: {},
});

new Electroview({ rpc });

const meLink = document.getElementById("me-link") as HTMLAnchorElement | null;
if (meLink) {
	const url = meLink.href;
	meLink.addEventListener("click", (e) => {
		e.preventDefault();
		rpc.send.openExternal(url);
	});
}