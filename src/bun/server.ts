import fs from "node:fs/promises"
import z from "zod"
import { configDir, sockPath } from "./kit/kit"
import { EventForUpdate, eventForUpdateSchema } from "../shared/rpc-schema"

const postSchema = z.object({
    sessionId: z.string(),
    event: eventForUpdateSchema
})

let sessions: z.output<typeof postSchema> [] = []

export async function runServer(hook:(event:EventForUpdate) => void) {
    try {
        await fs.access(configDir)
    } catch {
        await fs.mkdir(configDir,{recursive:true})
    }

    // 这条 socket 文件是上一次进程退出时没清理的残留（进程崩溃/被 kill 时不会自动删除），新的 Bun.serve 绑定时报 "address already in use"
    try {
        await Bun.file(sockPath).delete()
    } catch {}
    
    let placeHolderIdelEvent:Extract<EventForUpdate,{status:"idle"}> =  {
        name: "Piko",
        model: "Ohooo",
        status: "idle"
    }
    function runSession() {
        if(sessions.length == 0) {
            hook(placeHolderIdelEvent)
            return
        }
        const head = sessions[0]
        hook(head.event)
    }
    const server = Bun.serve({
        unix: sockPath,
        routes: {
            "/piko": async req => {
                if (req.method != "POST") {
                    return new Response("Method Not Allowed", { status: 405 })
                }
                const dataOrigin = await req.json()
                const data = postSchema.parse(dataOrigin)

                const found = sessions.find(a => a.sessionId == data.sessionId)

                if(data.event.status == "idle") {
                    placeHolderIdelEvent = data.event
                }
                
                if (found == null) {
                    if(data.event.status == "idle") {
                        runSession()
                        return new Response("piko ok")
                    }
                    sessions.push(data)
                    runSession()
                    return new Response("piko ok")
                }
                // 去掉闲置的session
                if (data.event.status == "idle") {
                    sessions = sessions.filter(a => a.sessionId != found.sessionId)
                    runSession()
                    return new Response("piko ok")
                }

                found.event = data.event
                runSession()
                return new Response("piko ok")
            }
        }
    })
    console.log("Server started at",server.url.href)

    return {
        clearSessions: () => {
            sessions = []
            runSession()
        }
    }
}

