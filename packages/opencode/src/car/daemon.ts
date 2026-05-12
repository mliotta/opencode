// CAR daemon discovery + lazy spawn. v0.8+ removed the embedded engine, so
// every FFI method proxies to a `car-server` daemon over WebSocket. The
// NAPI binding connects lazily and auto-reads the per-launch auth token,
// but it does not spawn the daemon — that's our job for the single-user
// CLI case where no macOS menubar app or systemd unit is supervising it.

import * as net from "node:net"
import * as os from "node:os"
import * as path from "node:path"
import * as fs from "node:fs"
import { spawn } from "node:child_process"
import { createRequire } from "node:module"
import * as Log from "@opencode-ai/core/util/log"

const log = Log.create({ service: "car.daemon" })

const DEFAULT_URL = "ws://127.0.0.1:9100"
const PROBE_TIMEOUT_MS = 200
const READY_POLL_INTERVAL_MS = 100
const READY_POLL_TIMEOUT_MS = 4000

export const DELEGATED_MODEL_ID = "opencode-delegated"

// Schema we need the daemon's `UnifiedRegistry::load_user_config` to
// pick up at boot. Daemon-side hot-update of the live registry is a
// known follow-up (handler.rs `models.register` phase 1 limitation);
// pre-writing the file before we spawn the daemon sidesteps that gap.
const DELEGATED_MODEL_SCHEMA = {
  id: DELEGATED_MODEL_ID,
  name: "opencode delegated",
  provider: "opencode",
  family: "opencode",
  capabilities: ["generate", "tool_use"],
  source: { type: "delegated" },
  context_length: 0,
}

let ensured: Promise<void> | undefined

function parseDaemonUrl(url: string): { host: string; port: number } {
  const u = new URL(url)
  return {
    host: u.hostname || "127.0.0.1",
    port: u.port ? Number(u.port) : 9100,
  }
}

function probe(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const finish = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.once("connect", () => finish(true))
    socket.once("error", () => finish(false))
    socket.setTimeout(PROBE_TIMEOUT_MS, () => finish(false))
  })
}

function resolveCarServerBinary(): string | undefined {
  const require = createRequire(import.meta.url)
  let pkgPath: string
  try {
    pkgPath = require.resolve("car-runtime/package.json")
  } catch {
    return undefined
  }
  const pkgDir = path.dirname(pkgPath)
  const assetsPath = path.join(pkgDir, "assets.json")
  if (!fs.existsSync(assetsPath)) return undefined
  const assets = JSON.parse(fs.readFileSync(assetsPath, "utf8")) as {
    platforms: Record<string, { server: string }>
  }
  const key = `${process.platform}-${process.arch}`
  const entry = assets.platforms[key]
  if (!entry) return undefined
  const binary = path.join(pkgDir, entry.server)
  return fs.existsSync(binary) ? binary : undefined
}

async function waitForReady(host: string, port: number): Promise<boolean> {
  const deadline = Date.now() + READY_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (await probe(host, port)) return true
    await new Promise((r) => setTimeout(r, READY_POLL_INTERVAL_MS))
  }
  return false
}

interface PersistedModel {
  readonly id: string
  readonly [key: string]: unknown
}

// Merge our delegated-model schema into `~/.car/models.json` so the
// daemon's `UnifiedRegistry::load_user_config` picks it up on boot.
// Preserves any other entries already on disk; replaces an existing
// entry with the same id. Best-effort — on IO failure we log and let
// the runtime-side `rt.registerModel` fallback handle it.
function ensureDelegatedModelOnDisk(): void {
  try {
    const carDir = path.join(os.homedir(), ".car")
    fs.mkdirSync(carDir, { recursive: true })
    const file = path.join(carDir, "models.json")
    let existing: PersistedModel[] = []
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, "utf8").trim()
      if (text) {
        const parsed = JSON.parse(text) as unknown
        if (Array.isArray(parsed)) existing = parsed as PersistedModel[]
      }
    }
    const idx = existing.findIndex((m) => m && m.id === DELEGATED_MODEL_ID)
    if (idx >= 0) existing[idx] = DELEGATED_MODEL_SCHEMA
    else existing.push(DELEGATED_MODEL_SCHEMA)
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(existing, null, 2))
    fs.renameSync(tmp, file)
    log.info("ensured opencode-delegated model on disk", { path: file })
  } catch (e) {
    log.warn("failed to ensure opencode-delegated in models.json", { error: String(e) })
  }
}

export function ensureCarServer(): Promise<void> {
  if (ensured) return ensured
  ensured = (async () => {
    const url = process.env["CAR_DAEMON_URL"] ?? DEFAULT_URL
    const { host, port } = parseDaemonUrl(url)

    if (await probe(host, port)) {
      log.info("car-server reachable", { url })
      return
    }

    // Pre-write models.json before spawning so the daemon's
    // load_user_config picks up opencode-delegated at boot.
    ensureDelegatedModelOnDisk()

    const binary = resolveCarServerBinary()
    if (!binary) {
      log.warn("car-server binary not found in car-runtime package", { url })
      throw new Error(
        "car-server is not running and the daemon binary was not found in node_modules/car-runtime. " +
          "Start car-server manually, set CAR_DAEMON_URL, or reinstall car-runtime.",
      )
    }

    log.info("spawning car-server", { binary, host, port })
    const child = spawn(binary, ["--host", host, "--port", String(port)], {
      detached: true,
      stdio: "ignore",
    })
    child.unref()
    child.once("error", (e) => log.warn("car-server spawn error", { error: String(e) }))

    if (await waitForReady(host, port)) {
      log.info("car-server ready", { url })
      return
    }

    throw new Error(
      `car-server failed to become ready at ${url} within ${READY_POLL_TIMEOUT_MS}ms`,
    )
  })()
  ensured.catch(() => {
    ensured = undefined
  })
  return ensured
}
