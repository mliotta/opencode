import { CarRuntime, executeProposal } from "car-runtime"
import { Context, Effect, Layer } from "effect"
import { InstanceState } from "@/effect/instance-state"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "car" })

type State = {
  rt: CarRuntime
  registered: Set<string>
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

export interface Interface {
  readonly executeAction: <T>(input: ExecuteActionInput<T>) => Effect.Effect<T, ExecuteActionError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Car") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const state = yield* InstanceState.make<State>(
      Effect.fn("Car.state")(function* () {
        log.info("instantiating car-runtime")
        return { rt: new CarRuntime(), registered: new Set<string>() }
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

    return Service.of({ executeAction })
  }),
)

export const defaultLayer = layer

export * as Car from "."
