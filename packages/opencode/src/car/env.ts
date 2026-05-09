// Side-effect-only module: must be imported before any module that pulls in
// `car-runtime`. ESM imports are hoisted, so we cannot reliably set this
// inside the same file as `import { CarRuntime } from "car-runtime"`.
//
// `CAR_FFI_MODE=embedded` skips the napi binding's daemon probe at
// `new CarRuntime()` construction. opencode is a single-process CLI; daemon
// mode (the napi default) is for multi-consumer setups and would emit a
// fallback warning every run.
// We also try to set CAR_FFI_MODE here in case a future bun release fixes the
// env-sync issue. Today it's a no-op for napi (bun does not propagate JS-side
// process.env mutations to the C `environ` array); set it externally before
// invoking opencode (the npm `dev` script + bin/opencode do this for you).
if (!process.env["CAR_FFI_MODE"]) process.env["CAR_FFI_MODE"] = "embedded"
