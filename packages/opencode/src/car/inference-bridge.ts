import {
  type CarRuntime,
  inferenceRunnerEmitEvent,
  registerInferenceRunner,
} from "car-runtime"
import { streamText } from "ai"
import { randomUUID } from "node:crypto"
import * as Log from "@opencode-ai/core/util/log"
import { DELEGATED_MODEL_ID } from "./daemon"

const log = Log.create({ service: "car.inference" })

type StreamTextParams = Parameters<typeof streamText>[0]
type StreamTextResult = ReturnType<typeof streamText>
type FullStream = StreamTextResult["fullStream"]
type Chunk = FullStream extends AsyncIterable<infer T> ? T : never

interface BridgeContext {
  readonly params: StreamTextParams
  readonly queue: AsyncQueue<Chunk>
}

// v0.8+ daemon: the JS-side `inferenceRunnerEmitEvent` shim does not
// surface the WS-level `call_id` to the runner via the requestJson —
// `GenerateRequest` is a typed Rust struct, so unknown fields get
// dropped on serde round-trip. We smuggle our correlation id via the
// `prompt` field, which delegated models ignore for prompt
// construction (the runner uses `ctx.params` for `streamText`).
const bridge = new Map<string, BridgeContext>()

class AsyncQueue<T> {
  private items: T[] = []
  private waiters: Array<{
    resolve: (v: IteratorResult<T>) => void
    reject: (e: unknown) => void
  }> = []
  private closed = false
  private err: unknown = undefined

  push(item: T): void {
    if (this.closed) return
    const w = this.waiters.shift()
    if (w) w.resolve({ value: item, done: false })
    else this.items.push(item)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    while (this.waiters.length > 0) {
      this.waiters.shift()!.resolve({ value: undefined as unknown as T, done: true })
    }
  }

  error(e: unknown): void {
    if (this.closed) return
    this.closed = true
    this.err = e
    while (this.waiters.length > 0) {
      this.waiters.shift()!.reject(e)
    }
  }

  async *iterate(): AsyncIterable<T> {
    while (true) {
      if (this.items.length > 0) {
        yield this.items.shift() as T
        continue
      }
      if (this.closed) {
        if (this.err) throw this.err
        return
      }
      const result = await new Promise<IteratorResult<T>>((resolve, reject) => {
        this.waiters.push({ resolve, reject })
      })
      if (result.done) return
      yield result.value
    }
  }
}

let runnerRegistered = false

function emitSafe(carCallId: string, eventJson: string): void {
  try {
    inferenceRunnerEmitEvent(carCallId, eventJson)
  } catch (e) {
    log.warn("emitEvent failed", { error: String(e) })
  }
}

function unpackRunnerArgs(args: unknown[]): readonly [string, string] {
  // napi declares `(requestJson, callId)` but bun packs the two args into a
  // single array (`[requestJson, callId]`). Node passes them separately. Handle
  // both forms so this stays portable across runtimes.
  const first = args[0]
  if (Array.isArray(first) && first.length >= 2) {
    return [first[0] as string, first[1] as string] as const
  }
  return [first as string, args[1] as string] as const
}

function ensureRunner(): void {
  if (runnerRegistered) return
  runnerRegistered = true
  type RunnerFn = Parameters<typeof registerInferenceRunner>[0]
  const runner: RunnerFn = (async (...args: unknown[]) => {
    const [requestJson, carCallId] = unpackRunnerArgs(args)
    const req = JSON.parse(requestJson) as { prompt?: string }
    const ourCallId = req.prompt
    if (!ourCallId) throw new Error("car inference runner: missing correlation id in request.prompt")
    const ctx = bridge.get(ourCallId)
    if (!ctx) throw new Error(`car inference runner: no bridge context for ${ourCallId}`)

    const result = streamText(ctx.params)
    let aggregatedText = ""
    const aggregatedToolCalls: Array<{
      readonly name: string
      readonly id: string
      readonly arguments: unknown
    }> = []

    try {
      for await (const chunk of result.fullStream) {
        ctx.queue.push(chunk)

        const c = chunk as { type: string } & Record<string, unknown>
        switch (c.type) {
          case "text-delta": {
            const text = (c as unknown as { text?: string }).text
            if (typeof text === "string") {
              aggregatedText += text
              emitSafe(carCallId, JSON.stringify({ type: "text", data: text }))
            }
            break
          }
          case "tool-call": {
            const tc = c as unknown as {
              toolName: string
              toolCallId: string
              input: unknown
            }
            const idx = aggregatedToolCalls.length
            aggregatedToolCalls.push({
              name: tc.toolName,
              id: tc.toolCallId,
              arguments: tc.input,
            })
            emitSafe(
              carCallId,
              JSON.stringify({
                type: "tool_start",
                name: tc.toolName,
                index: idx,
                id: tc.toolCallId,
              }),
            )
            break
          }
          case "finish": {
            const f = c as unknown as {
              totalUsage?: { inputTokens?: number; outputTokens?: number }
            }
            if (f.totalUsage) {
              emitSafe(
                carCallId,
                JSON.stringify({
                  type: "usage",
                  input_tokens: f.totalUsage.inputTokens ?? 0,
                  output_tokens: f.totalUsage.outputTokens ?? 0,
                }),
              )
            }
            break
          }
        }
      }
      ctx.queue.close()
    } catch (e) {
      ctx.queue.error(e)
      throw e
    }

    return JSON.stringify({ text: aggregatedText, tool_calls: aggregatedToolCalls })
  }) as RunnerFn
  registerInferenceRunner(runner)
}

export interface InferenceResult {
  readonly fullStream: AsyncIterable<Chunk>
}

export function runInference(rt: CarRuntime, params: StreamTextParams): InferenceResult {
  ensureRunner()

  // The delegated model is persisted in ~/.car/models.json by
  // `daemon.ensureCarServer()` before the daemon starts, so the
  // daemon's `UnifiedRegistry::load_user_config` picks it up at
  // boot. We do NOT call `rt.registerModel` here — that endpoint
  // only writes the file (phase 1 limitation per
  // car-server-core/handler.rs); we'd duplicate the write and
  // still rely on daemon-boot visibility. If a daemon is already
  // running with a stale `models.json` snapshot, the first
  // inference call will fail with "model not found" and the user
  // needs to restart the daemon.
  const callId = randomUUID()
  const queue = new AsyncQueue<Chunk>()
  bridge.set(callId, { params, queue })

  const requestJson = JSON.stringify({
    model: DELEGATED_MODEL_ID,
    prompt: callId,
  })

  rt.inferTrackedWithRequest(requestJson)
    .catch((e) => queue.error(e))
    .finally(() => bridge.delete(callId))

  return { fullStream: queue.iterate() }
}
