import { createRequire } from "node:module";

/**
 * Loader for the vendored Kaspa WASM SDK (v2.0.1, `vendor/kaspa-wasm`).
 *
 * The SDK is a CommonJS module that (a) synchronously loads its `.wasm` via `fs`
 * at require-time and (b) needs a W3C `WebSocket` global before it opens an RPC
 * connection. Both are Node-only concerns; the module is imported only by server
 * code and kept out of the bundler via `serverExternalPackages` in next.config.ts.
 */

export type KaspaSdk = typeof import("kaspa-wasm");

let cached: KaspaSdk | undefined;

export function loadKaspa(): KaspaSdk {
  if (cached) return cached;

  const require = createRequire(import.meta.url);

  // The RPC client relies on a browser-style WebSocket; install the shim first.
  const g = globalThis as { WebSocket?: unknown };
  if (!g.WebSocket) {
    const ws = require("websocket") as { w3cwebsocket: unknown };
    g.WebSocket = ws.w3cwebsocket;
  }

  const kaspa = require("kaspa-wasm") as KaspaSdk;
  // Surface Rust-side panics as readable JS errors.
  kaspa.initConsolePanicHook();

  cached = kaspa;
  return cached;
}
