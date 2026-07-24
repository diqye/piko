// 禁用 WKWebView 默认右键菜单（Inspect Element / Developer Tools）
document.addEventListener("contextmenu", (e) => e.preventDefault());

import "./tailwind.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Capsule from "./Capsule";

const rootEl = document.querySelector("#root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
	<StrictMode>
		<Capsule />
	</StrictMode>,
);