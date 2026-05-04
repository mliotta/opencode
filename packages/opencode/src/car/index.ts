import { CarRuntime } from "car-runtime"
import { Context, Effect, Layer } from "effect"
import { InstanceState } from "@/effect/instance-state"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "car" })

type State = { rt: CarRuntime }

export interface Interface {
  readonly runtime: () => Effect.Effect<CarRuntime>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Car") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const state = yield* InstanceState.make<State>(
      Effect.fn("Car.state")(function* () {
        log.info("instantiating car-runtime")
        return { rt: new CarRuntime() }
      }),
    )

    const runtime = Effect.fn("Car.runtime")(function* () {
      return (yield* InstanceState.get(state)).rt
    })

    return Service.of({ runtime })
  }),
)

export const defaultLayer = layer

export * as Car from "."
