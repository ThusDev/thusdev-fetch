import { performance } from "node:perf_hooks";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("../dist/index.js");
const iterations = Number(process.env.BENCHMARK_ITERATIONS ?? 5000);
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(JSON.stringify({ ok: true }), {
  status: 200,
  headers: { "content-type": "application/json" }
});

const api = createClient();

async function measure(name, fn) {
  const start = performance.now();
  for (let i = 0; i < iterations; i += 1) await fn();
  const elapsed = performance.now() - start;
  console.log(`${name}_total_ms: ${elapsed.toFixed(2)}`);
  console.log(`${name}_avg_ms: ${(elapsed / iterations).toFixed(4)}`);
  console.log(`${name}_requests_per_second: ${(iterations / (elapsed / 1000)).toFixed(2)}`);
}

await measure("thusdev_fetch", () => api.get("https://benchmark.test"));
await measure("native_fetch", () => fetch("https://benchmark.test"));
globalThis.fetch = originalFetch;
