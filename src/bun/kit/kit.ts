import { Screen, Utils } from "electrobun";
import path from "node:path";

export const configDir = path.join(Utils.paths.home, "piko");
export const sockPath = path.join(configDir, "piko.sock");

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