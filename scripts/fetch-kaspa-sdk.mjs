#!/usr/bin/env node
/**
 * Re-vendor the Kaspa WASM SDK (Node build) into `vendor/kaspa-wasm/`.
 *
 *   node scripts/fetch-kaspa-sdk.mjs
 *
 * The SDK is NOT on npm in a current form (the `kaspa-wasm` npm package is stale,
 * v0.13.0). We vendor the `nodejs/kaspa` build from the official GitHub release so
 * `pnpm install && pnpm dev` works offline. This script only needs to be re-run to
 * bump the SDK version — the build is committed to the repo.
 */
import { mkdir, writeFile, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const VERSION = process.env.KASPA_SDK_VERSION ?? "v2.0.1";
const URL = `https://github.com/kaspanet/rusty-kaspa/releases/download/${VERSION}/kaspa-wasm32-sdk-${VERSION}.zip`;
const DEST = path.resolve("vendor/kaspa-wasm");
const TMP = path.resolve("vendor/.kaspa-sdk.zip");
const PREFIX = "kaspa-wasm32-sdk/nodejs/kaspa/";

console.log(`Fetching ${URL} …`);
const res = await fetch(URL);
if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
await mkdir(path.dirname(TMP), { recursive: true });
await pipeline(res.body, createWriteStream(TMP));

console.log("Extracting nodejs/kaspa build …");
await rm(DEST, { recursive: true, force: true });
await mkdir(DEST, { recursive: true });

// Use python3's zipfile (portable; avoids an `unzip` dependency).
const py = `
import zipfile, os, shutil
z = zipfile.ZipFile(${JSON.stringify(TMP)})
prefix = ${JSON.stringify(PREFIX)}
dest = ${JSON.stringify(DEST)}
for n in z.namelist():
    if n.startswith(prefix) and not n.endswith('/'):
        target = os.path.join(dest, n[len(prefix):])
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with z.open(n) as s, open(target, 'wb') as o:
            shutil.copyfileobj(s, o)
print('ok')
`;
execFileSync("python3", ["-c", py], { stdio: "inherit" });
await rm(TMP, { force: true });

await writeFile(path.join(DEST, ".vendor-version"), `${VERSION}\n`);
console.log(`Done. Vendored Kaspa WASM SDK ${VERSION} into vendor/kaspa-wasm/`);
