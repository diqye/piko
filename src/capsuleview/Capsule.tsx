import { Electroview } from "electrobun/view";
import { Minus } from "lucide-react";
import type { CapsuleRPCSchema, EventForUpdate } from "../shared/rpc-schema";
import { useEffect, useState } from "react";

const rpc = Electroview.defineRPC<CapsuleRPCSchema>({
	handlers: {
		requests: {
			// bun 侧 watchdog 探活用，无实际逻辑
			ping: () => {},
		},
	},
});

new Electroview({ rpc });



function PencilBody() {
	return (
		<>
			<rect x="38" y="28" width="14" height="5" fill="#a1a1aa" stroke="#27272a" strokeWidth="1.5" />
			<line x1="42" y1="28" x2="42" y2="33" stroke="#71717a" strokeWidth="0.9" />
			<line x1="47" y1="28" x2="47" y2="33" stroke="#71717a" strokeWidth="0.9" />
			<rect x="38" y="33" width="14" height="33" fill="#fb923c" stroke="#27272a" strokeWidth="1.5" />
			<rect x="40" y="33" width="3" height="33" fill="rgba(255,255,255,0.3)" />
			<path d="M38 66 L52 66 L45 75 Z" fill="#fed7aa" stroke="#27272a" strokeWidth="1.5" strokeLinejoin="round" />
			<path d="M43 71 L47 71 L45 79 Z" fill="#27272a" />
		</>
	);
}

function PencilEyes({ dx = 0, dy = 0 }: { dx?: number; dy?: number }) {
	return (
		<>
			<ellipse cx="31" cy="16" rx="12" ry="14" fill="#fff" stroke="#27272a" strokeWidth="1.5" />
			<ellipse cx="59" cy="16" rx="12" ry="14" fill="#fff" stroke="#27272a" strokeWidth="1.5" />
			<circle cx={31 + dx} cy={16 + dy} r="6" fill="#27272a" />
			<circle cx={28.5 + dx} cy={12.5 + dy} r="2.2" fill="#fff" />
			<circle cx={59 + dx} cy={16 + dy} r="6" fill="#27272a" />
			<circle cx={56.5 + dx} cy={12.5 + dy} r="2.2" fill="#fff" />
		</>
	);
}

function PencilEraser() {
	return <rect x="38" y="4" width="14" height="16" rx="4" fill="#fb7185" stroke="#27272a" strokeWidth="1.5" />;
}

function PencilMouth({ kind }: { kind: "smile" | "o" | "flat" }) {
	if (kind === "smile") {
		return <path d="M42 25C44 27 46 27 48 25" fill="none" stroke="#27272a" strokeWidth="1.3" strokeLinecap="round" />;
	}
	if (kind === "o") {
		return <ellipse cx="45" cy="25.5" rx="2" ry="1.7" fill="#27272a" />;
	}
	return <path d="M42 26H48" stroke="#27272a" strokeWidth="1.3" strokeLinecap="round" />;
}

function CapsuleStatusIcon({ event }: { event: EventForUpdate }) {
	if (event.status === "idle") {
		return (
			<svg viewBox="0 0 90 90" className="h-18 w-18" aria-hidden="true">
				<g className="pencil-idle-float">
					<PencilBody />
					<PencilEraser />
					<g className="pencil-idle-eyes">
						<PencilEyes dx={0} dy={0} />
					</g>
					<PencilMouth kind="smile" />
				</g>
			</svg>
		);
	}

	if (event.status === "thinking") {
		return (
			<svg viewBox="0 0 90 90" className="h-18 w-18 overflow-visible" aria-hidden="true">
				<g className="pencil-thinking-scale">
					<g className="pencil-thinking-spin">
						<PencilBody />
						<PencilEraser />
						<g className="pencil-thinking-eyes">
							<PencilEyes dx={0} dy={0} />
						</g>
						<PencilMouth kind="o" />
					</g>
				</g>
			</svg>
		);
	}

	if (event.status == "working") {

		return (
			<svg viewBox="0 0 90 90" className="h-18 w-18 overflow-visible" aria-hidden="true">
				<path
					d="M28 82 Q32 79 36 82 Q40 85 44 82 Q48 79 52 82 Q56 85 60 82 Q64 79 68 82"
					fill="none"
					stroke="#4ade80"
					strokeWidth="2"
					strokeLinecap="round"
					className="pencil-working-scribble"
				/>
				<path
					d="M26 86 H70"
					stroke="rgba(52,211,153,0.4)"
					strokeWidth="1.6"
					strokeLinecap="round"
					strokeDasharray="3 4"
					className="pencil-working-base"
				/>
				<g transform="rotate(20 45 79)">
					<g className="pencil-working">
						<PencilBody />
						<PencilEraser />
						<PencilEyes dx={0} dy={2.5} />
						<PencilMouth kind="flat" />
					</g>
				</g>
			</svg>
		);
	}

	return event satisfies never
}


const labelByStatus = {
	idle: "Idle",
	thinking: "Thinking",
	working: "Working",
} as const

export default function Capsule() {
	const [eventForUpdate,setEventForUpdate] = useState<EventForUpdate>({status:"idle",name: "Piko"})
	const [modelVisible,setModelVisible] = useState(true)
	useEffect(()=>{
		rpc.addMessageListener("update",event =>{
			setEventForUpdate(event)
		})
		rpc.addMessageListener("toogleModel",visible=>{
			setModelVisible(visible)
		})
	},[])

	const statusMeta = {
		idle: {
			accent: "text-orange-200/80",
			pill: "border-orange-300/25 bg-orange-300/8 text-orange-200",
			bg: "bg-orange-950/75",
			border: "border-orange-300/20",
		},
		thinking: {
			accent: "text-orange-300",
			pill: "border-orange-500/30 bg-orange-500/12 text-orange-300",
			bg: "bg-orange-900/75",
			border: "border-orange-500/30",
		},
		working: {
			accent: "text-orange-400",
			pill: "border-orange-700/40 bg-orange-700/15 text-orange-400",
			bg: "bg-orange-800/75",
			border: "border-orange-600/40",
		},
	}[eventForUpdate.status];

	const hide = () => {
		rpc.send.hide();
	};

	return (
		<div className="electrobun-webkit-app-region-drag relative flex h-full w-full items-center justify-center bg-transparent p-2">
			<div className="relative w-full max-w-70 translate-y-2">
				<div className="absolute bottom-0 left-0 z-10">
					<CapsuleStatusIcon event={eventForUpdate} />
				</div>
				<div className={`relative flex items-center overflow-hidden rounded-full border ${statusMeta.border} ${statusMeta.bg} pl-13 pr-3 py-1 text-zinc-100 transition-colors duration-300`}>
					<div className="relative min-w-0 flex-1">
						<div className="flex items-center gap-2">
							<span className="truncate text-sm font-semibold tracking-tight text-zinc-100">{eventForUpdate.name}</span>
							<span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] ${statusMeta.pill}`}>
								{labelByStatus[eventForUpdate.status]}
							</span>
						</div>
						<div className={`truncate text-[10px] ${statusMeta.accent}`}>{eventForUpdate.status == "idle" ? "Ready for you" : eventForUpdate.sample}</div>
					</div>
					<div className="relative ml-3">
						<button
							type="button"
							className="electrobun-webkit-app-region-no-drag inline-flex h-5 w-5 items-center justify-center rounded-xl border border-white/10 bg-white/6 text-zinc-400 transition hover:bg-white/10 hover:text-white"
							onClick={hide}
							title="Hide"
							aria-label="Hide"
						>
							<Minus size={8} strokeWidth={2} />
						</button>
					</div>
				</div>
				<p className={`
					absolute -top-7.5 right-2 rounded-full px-3 py-1.5 text-white scale-75 origin-[right_center]
					${statusMeta.bg} text-sm ${modelVisible ? "" : "hidden"}
				`}>{eventForUpdate.model ?? "Ohooo"}</p>
			</div>
		</div>
	);
}
