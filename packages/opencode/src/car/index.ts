import { CarRuntime, executeProposal } from "car-runtime"
import { Context, Effect, Layer } from "effect"
import { InstanceState } from "@/effect/instance-state"
import { Global } from "@opencode-ai/core/global"
import * as Log from "@opencode-ai/core/util/log"
import { existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import path from "node:path"

const log = Log.create({ service: "car" })

type State = {
  rt: CarRuntime
  registered: Set<string>
  memoryPath: string
}

export interface ExecuteActionInput<T> {
  readonly action: {
    readonly id: string
    readonly tool: string
    readonly parameters: Record<string, unknown>
  }
  readonly dispatch: (params: Record<string, unknown>) => Promise<T>
}

export class ExecuteActionError extends Error {
  readonly status: string
  constructor(status: string, message: string) {
    super(message)
    this.name = "CarExecuteActionError"
    this.status = status
  }
}

export interface FactInput {
  readonly subject: string
  readonly body: string
  readonly kind: string
}

export interface Interface {
  readonly executeAction: <T>(input: ExecuteActionInput<T>) => Effect.Effect<T, ExecuteActionError>
  readonly addFact: (input: FactInput) => Effect.Effect<void>
  readonly factCount: () => Effect.Effect<number>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Car") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const state = yield* InstanceState.make<State>(
      Effect.fn("Car.state")(function* (ctx) {
        log.info("instantiating car-runtime")
        const rt = new CarRuntime()
        const memoryDir = path.join(Global.Path.data, "car")
        const memoryPath = path.join(memoryDir, `${ctx.project.id}.json`)

        if (existsSync(memoryPath)) {
          const count = rt.loadMemory(memoryPath)
          log.info("loaded memory", { count, path: memoryPath })
        }

        yield* Effect.addFinalizer(() =>
          Effect.tryPromise({
            try: async () => {
              await mkdir(memoryDir, { recursive: true })
              rt.persistMemory(memoryPath)
              log.info("persisted memory", { path: memoryPath })
            },
            catch: (e) => new Error(String(e)),
          }).pipe(Effect.ignore),
        )

        return { rt, registered: new Set<string>(), memoryPath }
      }),
    )

    const registerTool = Effect.fn("Car.registerTool")(function* (name: string) {
      const s = yield* InstanceState.get(state)
      if (s.registered.has(name)) return
      yield* Effect.tryPromise({
        try: () => s.rt.registerTool(name),
        catch: (e) => new Error(`car: registerTool ${name}: ${String(e)}`),
      }).pipe(Effect.orDie)
      s.registered.add(name)
    })

    const executeAction = Effect.fn("Car.executeAction")(function* <T>(input: ExecuteActionInput<T>) {
      const s = yield* InstanceState.get(state)
      yield* registerTool(input.action.tool)

      const proposalJson = JSON.stringify({
        source: "opencode",
        actions: [
          {
            id: input.action.id,
            type: "tool_call",
            tool: input.action.tool,
            parameters: input.action.parameters,
            idempotent: false,
            max_retries: 0,
            failure_behavior: "abort",
          },
        ],
      })

      const verifyJson = yield* Effect.tryPromise({
        try: () => s.rt.verifyProposal(proposalJson),
        catch: (e) => new ExecuteActionError("verify", String(e)),
      })
      const verify = JSON.parse(verifyJson) as {
        valid: boolean
        issues?: ReadonlyArray<{ message: string }>
      }
      if (!verify.valid) {
        const reasons = verify.issues?.map((i) => i.message).join("; ") ?? "verification failed"
        return yield* Effect.fail(new ExecuteActionError("invalid", reasons))
      }

      const dispatcher = async (callJson: string): Promise<string> => {
        const parsed = JSON.parse(callJson) as { tool: string; params: Record<string, unknown> }
        if (parsed.tool !== input.action.tool) {
          throw new Error(`car-dispatcher: unexpected tool ${parsed.tool}`)
        }
        const result = await input.dispatch(parsed.params)
        return JSON.stringify(result)
      }

      const resultJson = yield* Effect.tryPromise({
        try: () => executeProposal(s.rt, proposalJson, dispatcher),
        catch: (e) => new ExecuteActionError("error", String(e)),
      })

      const result = JSON.parse(resultJson) as {
        results?: ReadonlyArray<{ status: string; output?: unknown; error?: string }>
      }
      const action = result.results?.[0]
      if (!action) {
        return yield* Effect.fail(new ExecuteActionError("missing", "car: no action result"))
      }
      const status = action.status.toLowerCase()
      if (status !== "succeeded") {
        return yield* Effect.fail(new ExecuteActionError(status, action.error ?? `action ${status}`))
      }
      return action.output as T
    })

    const addFact = Effect.fn("Car.addFact")(function* (input: FactInput) {
      const s = yield* InstanceState.get(state)
      yield* Effect.try({
        try: () => s.rt.addFact(input.subject, input.body, input.kind),
        catch: (e) => new Error(`car: addFact ${input.subject}: ${String(e)}`),
      }).pipe(Effect.ignore)
    })

    const factCount = Effect.fn("Car.factCount")(function* () {
      const s = yield* InstanceState.get(state)
      return s.rt.factCount()
    })

    return Service.of({ executeAction, addFact, factCount })
  }),
)

export const defaultLayer = layer

export * as Car from "."
