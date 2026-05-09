import {
  type CarRuntime,
  inferStream,
  inferenceRunnerEmitEvent,
  registerInferenceRunner,
} from "car-runtime"
import { streamText } from "ai"
import { randomUUID } from "node:crypto"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "car.inference" })

const DELEGATED_MODEL_ID = "opencode-delegated"

type StreamTextParams = Parameters<typeof streamText>[0]
type StreamTextResult = ReturnType<typeof streamText>
type FullStream = StreamTextResult["fullStream"]
type Chunk = FullStream extends AsyncIterable<infer T> ? T : never

interface BridgeContext {
  readonly params: StreamTextParams
  readonly queue: AsyncQueue<Chunk>
}

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

function ensureRunner(): void {
  if (runnerRegistered) return
  runnerRegistered = true
  registerInferenceRunner(async (requestJson: string, carCallId: string) => {
    const req = JSON.parse(requestJson) as { _opencode_call_id?: string }
    const ourCallId = req._opencode_call_id
    if (!ourCallId) throw new Error("car inference runner: missing _opencode_call_id in request")
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
  })
}

const modelRegisteredFor = new WeakSet<CarRuntime>()

function ensureModelRegistered(rt: CarRuntime): void {
  if (modelRegisteredFor.has(rt)) return
  modelRegisteredFor.add(rt)
  try {
    rt.registerModel(
      JSON.stringify({
        id: DELEGATED_MODEL_ID,
        name: "opencode delegated",
        provider: "opencode",
        source: { type: "delegated", hint: null },
        capabilities: ["generate", "tool_use"],
      }),
    )
  } catch (e) {
    log.warn("registerModel failed; inferStream may reject", { error: String(e) })
  }
}

export interface InferenceResult {
  readonly fullStream: AsyncIterable<Chunk>
}

export function runInference(rt: CarRuntime, params: StreamTextParams): InferenceResult {
  ensureRunner()
  ensureModelRegistered(rt)

  const callId = randomUUID()
  const queue = new AsyncQueue<Chunk>()
  bridge.set(callId, { params, queue })

  const requestJson = JSON.stringify({
    model: DELEGATED_MODEL_ID,
    prompt: "",
    _opencode_call_id: callId,
  })

  inferStream(rt, requestJson, () => {})
    .catch((e) => queue.error(e))
    .finally(() => bridge.delete(callId))

  return { fullStream: queue.iterate() }
}
