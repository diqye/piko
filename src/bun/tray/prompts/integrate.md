Create a pi code agent extension at `~/.pi/agent/extensions/piko.ts` that reports session status to piko (a floating capsule app).

## What piko is

piko is a floating always-on-top window that shows agent status. It runs a Unix domain socket HTTP server. Your extension should send POST requests to it.

## Extension to write

```ts
import type { ExtensionAPI, Model } from "@earendil-works/pi-coding-agent";
import http from "node:http";
import path from "node:path";

const SOCKET = "{{SOCKET}}";

function pikoUpdate(sessionId: string, event: {
  status: "idle" | "thinking" | "working";
  name: string;
  model?: string;
  sample?: string;
}) {
  const body = JSON.stringify({ sessionId, event });
  const req = http.request(
    {
      socketPath: SOCKET,
      path: "/piko",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    () => {},
  );
  req.on("error", () => {});
  req.write(body);
  req.end();
}

function modelString(m: Model<any> | undefined): string | undefined {
  return m ? m.id : undefined;
}

export default function (pi: ExtensionAPI) {
  let sessionId = "";
  let name = "pi";
  let currentModel: string | undefined;

  pi.on("session_start", (_event, ctx) => {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    name = path.basename(ctx.cwd);
    currentModel = modelString(ctx.model);
  });

  pi.on("model_select", (event) => {
    currentModel = modelString(event.model);
  });

  pi.on("before_agent_start", (event) => {
    pikoUpdate(sessionId, { status: "thinking", name, model: currentModel, sample: event.prompt.slice(0, 200) });
  });

  let buf = "";

  pi.on("before_agent_start", () => {
    buf = "";
  });

  pi.on("message_update", (event) => {
    const e = event.assistantMessageEvent;
    if (!e) return;
    if (e.type === "thinking_delta" || e.type === "text_delta") {
      buf += e.delta;
      if (buf.length > 40) buf = e.delta;
      const status = e.type === "thinking_delta" ? "thinking" : "working";
      pikoUpdate(sessionId, { status, name, model: currentModel, sample: buf });
    }
  });

  pi.on("tool_call", (event) => {
    const sample = `${event.toolName}: ${summarize(event.input)}`;
    pikoUpdate(sessionId, { status: "working", name, model: currentModel, sample });
  });

  pi.on("agent_settled", () => {
    pikoUpdate(sessionId, { status: "idle", name, model: currentModel });
  });

  pi.on("session_shutdown", () => {
    pikoUpdate(sessionId, { status: "idle", name, model: currentModel });
  });
}

function summarize(input: unknown): string {
  if (typeof input !== "object" || input === null) return "";
  const obj = input as Record<string, unknown>;
  for (const key of ["command", "path", "prompt", "query"]) {
    if (typeof obj[key] === "string") return String(obj[key]).slice(0, 80);
  }
  return "";
}
```

## Request schema

```ts
{
  sessionId: string,   // unique per session, reuse for the entire session
  event:
    | { status: "idle",      name: string, model?: string }
    | { status: "thinking",  name: string, model?: string, sample: string }
    | { status: "working",   name: string, model?: string, sample: string }
}
```

## Status mapping

| Event | Status | sample |
|-------|--------|--------|
| `before_agent_start` | thinking | user prompt |
| `message_update` | thinking (reasoning) / working (text output) | whatever the assistant is streaming |
| `tool_call` | working | tool name + input |
| `agent_settled` | idle | — |
| `session_shutdown` | idle | — |

## Rules

- If piko is not running, requests fail silently — never disrupt the agent
- Generate a unique `sessionId` on `session_start`, reuse it for the whole session
- Always send `idle` on `agent_settled` and `session_shutdown`
- Create the file, don't just describe it