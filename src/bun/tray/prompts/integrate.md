Create a pi code agent extension at `~/.pi/agent/extensions/piko.ts` that reports session status to piko (a floating capsule app).

## What piko is

piko is a floating always-on-top window that shows agent status. It runs a Unix domain socket HTTP server. Your extension should send POST requests to it.

## Extension to write

```ts
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import http from "node:http";
import path from "node:path";

const SOCKET = "/Users/diqye/piko/piko.sock";

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

function update(ctx: ExtensionContext, event: Parameters<typeof pikoUpdate>[1]) {
  const model = ctx.model && `${ctx.model.id} . ${ctx.thinkingLevel}`;
  pikoUpdate(ctx.sessionManager.getSessionId(), {
    ...event,
    name: ctx.sessionManager.getSessionName() ?? path.basename(ctx.cwd),
    model,
  });
}

export default function (pi: ExtensionAPI) {
  pi.on("before_agent_start", (event, ctx) => {
    update(ctx, { status: "thinking", name: "", sample: event.prompt.slice(0, 200) });
  });

  let buf = "";

  pi.on("before_agent_start", () => {
    buf = "";
  });

  pi.on("message_update", (event, ctx) => {
    const e = event.assistantMessageEvent;
    if (!e) return;
    if (e.type === "thinking_delta" || e.type === "text_delta") {
      buf += e.delta;
      if (buf.length > 40) buf = e.delta;
      const status = e.type === "thinking_delta" ? "thinking" : "working";
      update(ctx, { status, name: "", sample: buf });
    }
  });

  pi.on("tool_call", (event, ctx) => {
    const sample = `${event.toolName}: ${summarize(event.input)}`;
    update(ctx, { status: "working", name: "", sample });
  });

  pi.on("agent_settled", (_event, ctx) => {
    update(ctx, { status: "idle", name: "" });
  });

  pi.on("session_shutdown", (_event, ctx) => {
    update(ctx, { status: "idle", name: "" });
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