import { showAbout } from "./about";
import { CapsuleWindow } from "./capsule";
import { setupApplicationMenu } from "./menu";
import { runServer } from "./server";
import { TrayMenu } from "./tray";

async function bootstrap() {
	const capsule = CapsuleWindow.fromDefault();
	const tray = TrayMenu.fromDefault();

	capsule.hook.hide = () => {
		capsule.hide();
		tray.setCapsuleVisible(false);
	};
	tray.hook.showCapsule = () => {
		capsule.show();
	};
	tray.hook.hideCapsule = () => {
		capsule.hide();
	};
	tray.hook.about = showAbout;
    tray.hook.toogleModel = visible => {
        capsule.toogleModel(visible)
    }
	capsule.open();
	const server = await runServer(event => {
		capsule.updateEvent(event);
	});
	tray.hook.clearSessions = () => server.clearSessions();
}

setupApplicationMenu({ onAbout: showAbout });
bootstrap();
