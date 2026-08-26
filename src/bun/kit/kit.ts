import { Screen, Utils } from "electrobun";
import path from "node:path";
import { THEMES, type ThemeName } from "../../shared/themes";

export const configDir = path.join(Utils.paths.home, "piko");
export const sockPath = path.join(configDir, "piko.sock");
export const configPath = path.join(configDir, "config.json");

export async function readTheme(): Promise<ThemeName> {
	try {
		const config = await Bun.file(configPath).json();
		if (THEMES.some(t => t.id === config.theme)) return config.theme;
	} catch { /* 无配置/损坏降级默认 */ }
	return "blue";
}

export async function writeTheme(theme: ThemeName) {
	await Bun.write(configPath, JSON.stringify({ theme }, null, "\t"));
}

/**
 * const [x,y] = centerInPrimary(600,600)
 * 
 * @param w 
 * @param h 
 * @returns 
 */
export function getCenteredPositionInPrimaryDisplay(w:number,h:number) {
    const display = Screen.getPrimaryDisplay()
    const x = display.workArea.x + Math.trunc(display.workArea.width - w) / 2
    const y = display.workArea.y + Math.trunc(display.workArea.height - h) / 2

    return [x,y] as const
}