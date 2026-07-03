import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Kaspa WASM SDK is a CommonJS module that loads its .wasm via fs at
  // require-time. It must never be bundled for the client or by Turbopack — keep
  // it external so it is required at runtime on the Node server only.
  serverExternalPackages: ["kaspa-wasm"],
};

export default nextConfig;
