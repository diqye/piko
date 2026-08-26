import type { ElectrobunRPCSchema } from "electrobun";
import z from "zod";

export const eventForUpdateSchema = z.union([
	z.object({
		status: z.literal("idle"),
		model: z.string().nullish(),
		name: z.string(),
	}),
	z.object({
		status: z.literal("thinking"),
		name: z.string(),
		model: z.string().nullish(),
		sample: z.string()
	}),
	z.object({
		status: z.literal("working"),
		name: z.string(),
		model: z.string().nullish(),
		sample: z.string()
	})
])
export type EventForUpdate = z.output<typeof eventForUpdateSchema>



export interface CapsuleRPCSchema extends ElectrobunRPCSchema {
	bun: {
		requests: {
		};
		messages: {
			hide: void
		};
	};
	webview: {
		requests: {
			ping: { params: void; response: void };
		};
		messages: {
			update: EventForUpdate,
			toogleModel: boolean
		};
	};
}

export interface AboutRPCSchema extends ElectrobunRPCSchema {
	bun: {
		requests: {};
		messages: {
			openExternal: string;
		};
	};
	webview: {
		requests: {};
		messages: {};
	};
}
