import { sockPath } from "../../kit/kit";
import integratePrompt from "./integrate.md" with { type: "text" };

export function getIntegratePrompt(): string {
	return integratePrompt.replaceAll("{{SOCKET}}", sockPath);
}
