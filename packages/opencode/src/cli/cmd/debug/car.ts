import { EOL } from "os"
import { Effect } from "effect"
import { Car } from "@/car"
import { effectCmd } from "../../effect-cmd"

export const CarCommand = effectCmd({
  command: "car",
  describe: "show CAR runtime state for the current instance",
  builder: (yargs) => yargs,
  handler: Effect.fn("Cli.debug.car")(function* () {
    const car = yield* Car.Service
    const info = yield* car.summary()
    process.stdout.write(JSON.stringify(info, null, 2) + EOL)
  }),
})
