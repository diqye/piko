import type { ElectrobunConfig } from "electrobun";
import tailwindPlugin from "bun-plugin-tailwind";

export default {
	app: {
		name: "Piko",
		identifier: "www.dogdog.work",
		version: "0.0.1",
	},
	runtime: {
		exitOnLastWindowClosed: false,
	},
	build: {
		bun: {
			entrypoint: "src/bun/index.ts",
		},
		views: {
			capsuleview: {
				entrypoint: "src/capsuleview/index.html",
				plugins: [tailwindPlugin],
			},
			aboutview: {
				entrypoint: "src/aboutview/index.html",
			},
		},
		copy: {
			"src/assets/logo/tray-icon.png": "views/assets/tray-icon.png",
		},
		mac: {
			bundleCEF: false,
			icons: "src/assets/logo/piko.iconset",
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
