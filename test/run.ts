import assert from "node:assert/strict";
import { createAuthPlugin, createClient, ThusError, ThusFetch, setDebug } from "../src/index";
import { validateUrl } from "../src/utils/security";

const originalFetch = globalThis.fetch;
const tests: Array<{ name: string; run: () => Promise<void> }> = [];

function test(name: string, run: () => Promise<void>): void {
  tests.push({ name, run });
}

function response(body: unknown, status = 200, headers: Record<string, string> = { "content-type": "application/json" }): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
}

test("performs a typed GET request", async () => {
  globalThis.fetch = async () => response({ id: 1, name: "ThusDev" });
  const api = createClient();
  const data = await api.get<{ id: number; name: string }>("https://example.test/users/1");
  assert.deepEqual(data, { id: 1, name: "ThusDev" });
});

test("serializes JSON bodies without overriding an explicit content type", async () => {
  let request: Request | undefined;
  globalThis.fetch = async (input, init) => {
    request = new Request(input, init);
    return response({ ok: true });
  };
  const api = new ThusFetch();
  await api.post("https://example.test/users", { name: "Malthus" }, { headers: { "content-type": "application/custom+json" } });
  assert.equal(request?.headers.get("content-type"), "application/custom+json");
  assert.equal(await request?.text(), JSON.stringify({ name: "Malthus" }));
});

test("supports FormData, Blob and URLSearchParams bodies", async () => {
  const bodies: string[] = [];
  globalThis.fetch = async (_input, init) => {
    bodies.push(await new Response(init?.body).text());
    return response({ ok: true });
  };
  const api = new ThusFetch();
  const form = new FormData();
  form.set("name", "ThusDev");
  await api.post("https://example.test/form", form);
  await api.post("https://example.test/blob", new Blob(["hello"]));
  await api.post("https://example.test/query", new URLSearchParams({ q: "thusdev" }));
  assert.equal(bodies.length, 3);
  assert.equal(bodies[1], "hello");
  assert.equal(bodies[2], "q=thusdev");
});

test("supports response interceptors and ejection", async () => {
  globalThis.fetch = async () => response({ value: 1 });
  const api = new ThusFetch();
  const id = api.interceptors.useResponse((result) => ({ ...result, data: { value: 2 } }));
  assert.equal((await api.get<{ value: number }>("https://example.test")).value, 2);
  api.interceptors.ejectResponse(id);
  assert.equal((await api.get<{ value: number }>("https://example.test")).value, 1);
});

test("runs asynchronous plugins and supports removal", async () => {
  globalThis.fetch = async () => response({ value: 1 });
  const api = new ThusFetch();
  const plugin = {
    beforeRequest: async (config: any) => ({ ...config, headers: { "x-test": "true" } }),
    afterResponse: async (result: any) => ({ ...result, data: { value: 3 } })
  };
  api.plugins.use(plugin);
  assert.equal((await api.get<{ value: number }>("https://example.test")).value, 3);
  api.plugins.remove(plugin);
  assert.equal((await api.get<{ value: number }>("https://example.test")).value, 1);
});

test("retries only retryable HTTP failures", async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts < 3) return response({ error: "temporary" }, 503);
    return response({ ok: true });
  };
  const api = new ThusFetch();
  const data = await api.get<{ ok: boolean }>("https://example.test", { retry: { attempts: 2, delay: 0, jitter: false } });
  assert.deepEqual(data, { ok: true });
  assert.equal(attempts, 3);
});

test("does not retry unsafe POST requests by default", async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return response({ error: "temporary" }, 503);
  };
  const api = new ThusFetch();
  await assert.rejects(api.post("https://example.test/payments", { amount: 10 }, { retry: { attempts: 3, delay: 0, jitter: false } }), (error: unknown) => error instanceof ThusError && error.status === 503);
  assert.equal(attempts, 1);
});

test("allows unsafe retries when explicitly enabled", async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return response({ error: "temporary" }, 503);
    return response({ ok: true });
  };
  const api = new ThusFetch();
  await api.post("https://example.test/resource", {}, { retry: { attempts: 1, delay: 0, jitter: false, retryUnsafeMethods: true } });
  assert.equal(attempts, 2);
});

test("honors Retry-After without forcing a long test delay", async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) return response({ error: "busy" }, 429, { "content-type": "application/json", "retry-after": "0" });
    return response({ ok: true });
  };
  const api = new ThusFetch();
  await api.get("https://example.test", { retry: { attempts: 1, delay: 0, jitter: false, retryAfter: true } });
  assert.equal(attempts, 2);
});

test("handles timeout and cleans the timer", async () => {
  globalThis.fetch = async (_input, init) => new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  const api = new ThusFetch();
  await assert.rejects(api.get("https://example.test", { timeout: 10 }), (error: unknown) => error instanceof ThusError && error.code === "TIMEOUT");
});

test("supports external abort signals", async () => {
  const controller = new AbortController();
  globalThis.fetch = async (_input, init) => new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    controller.abort();
  });
  const api = new ThusFetch();
  await assert.rejects(api.get("https://example.test", { signal: controller.signal }), (error: unknown) => error instanceof ThusError && error.code === "ABORTED");
});

test("parses text responses", async () => {
  globalThis.fetch = async () => response("hello", 200, { "content-type": "text/plain" });
  const api = new ThusFetch();
  assert.equal(await api.get<string>("https://example.test"), "hello");
});

test("supports base URLs", async () => {
  let calledUrl = "";
  globalThis.fetch = async (input) => {
    calledUrl = String(input);
    return response({ ok: true });
  };
  const api = new ThusFetch({ baseURL: "https://example.test/api/" });
  await api.get("/health");
  assert.equal(calledUrl, "https://example.test/api/health");
});

test("supports memory caching and ETag revalidation", async () => {
  let attempts = 0;
  globalThis.fetch = async (_input, init) => {
    attempts += 1;
    const headers = new Headers(init?.headers);
    if (headers.get("if-none-match") === '"v1"') return new Response(null, { status: 304, headers: { etag: '"v1"' } });
    return response({ value: 1 }, 200, { "content-type": "application/json", etag: '"v1"' });
  };
  const api = new ThusFetch();
  assert.deepEqual(await api.get("https://example.test/cache", { cacheOptions: { ttl: 10 } }), { value: 1 });
  assert.deepEqual(await api.get("https://example.test/cache", { cacheOptions: { ttl: 10 } }), { value: 1 });
  assert.equal(attempts, 1);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.deepEqual(await api.get("https://example.test/cache", { cacheOptions: { ttl: 1000 } }), { value: 1 });
  assert.equal(attempts, 2);
});

test("supports lifecycle hooks and metrics", async () => {
  const events: string[] = [];
  globalThis.fetch = async () => response({ ok: true });
  const api = createClient({
    onRequestStart: async ({ method }) => { events.push(`start:${method}`); },
    onRequestEnd: async ({ status }) => { events.push(`end:${status}`); }
  });
  await api.get("https://example.test");
  const metrics = api.getMetrics();
  assert.deepEqual(events, ["start:GET", "end:200"]);
  assert.equal(metrics.total, 1);
  assert.equal(metrics.succeeded, 1);
});

test("supports the authentication plugin", async () => {
  let authorization = "";
  globalThis.fetch = async (_input, init) => {
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return response({ ok: true });
  };
  const api = createClient();
  api.plugins.use(createAuthPlugin(() => "secret"));
  await api.get("https://example.test");
  assert.equal(authorization, "Bearer secret");
});

test("sanitizes sensitive query parameters in debug output", async () => {
  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    setDebug(true);
    globalThis.fetch = async () => response({ ok: true });
    const api = new ThusFetch();
    await api.get("https://example.test/data?token=secret&api_key=key123&visible=yes");
    assert.equal(logs.some((entry) => entry.includes("secret")), false);
    assert.equal(logs.some((entry) => entry.includes("key123")), false);
    assert.equal(logs.some((entry) => entry.includes("visible=yes")), true);
  } finally {
    console.info = originalInfo;
    setDebug(false);
  }
});

test("debug logging does not leak sensitive headers", async () => {
  const logs: string[] = [];
  const originalInfo = console.info;
  console.info = (...args: unknown[]) => logs.push(args.join(" "));
  try {
    setDebug(true);
    globalThis.fetch = async () => response({ ok: true });
    const api = new ThusFetch();
    await api.get("https://example.test", { headers: { Authorization: "Bearer secret", "x-api-key": "secret-key" } });
    assert.equal(logs.some((entry) => entry.includes("Bearer secret")), false);
    assert.equal(logs.some((entry) => entry.includes("secret-key")), false);
    assert.equal(logs.some((entry) => entry.includes("[REDACTED]")), true);
  } finally {
    console.info = originalInfo;
    setDebug(false);
  }
});

test("rejects a set of malformed and dangerous URL inputs", async () => {
  const api = createClient();
  const candidates = ["file:///etc/passwd", "ftp://example.test/file", "https://user:pass@example.test", "https://127.0.0.1", "https://169.254.169.254/latest/meta-data", "https://[::1]", "https://[fc00::1]", "not a url"];
  for (const candidate of candidates) await assert.rejects(api.get(candidate));
  for (let i = 0; i < 100; i += 1) await assert.rejects(api.get(`http://10.${i % 256}.${(i * 7) % 256}.${(i * 13) % 256}`));
});

test("blocks unsafe URLs and supports host allowlists", async () => {
  const api = createClient({ security: { allowedHosts: ["example.test"] } });
  await assert.rejects(api.get("http://127.0.0.1/secret"));
  await assert.rejects(api.get("https://evil.test/secret"));
  await assert.rejects(api.get("https://user:pass@example.test/secret"));
  globalThis.fetch = async () => response({ ok: true });
  assert.deepEqual(await api.get("https://example.test/ok"), { ok: true });
});

test("enforces response size limits", async () => {
  globalThis.fetch = async () => response("123456789", 200, { "content-type": "text/plain" });
  const api = createClient();
  await assert.rejects(api.get("https://example.test", { security: { maxResponseSize: 4 } }), (error: unknown) => error instanceof ThusError && error.code === "RESPONSE_TOO_LARGE");
});

test("enforces request size limits", async () => {
  globalThis.fetch = async () => response({ ok: true });
  const api = createClient();
  await assert.rejects(api.post("https://example.test", { payload: "123456789" }, { security: { maxRequestSize: 4 } }), (error: unknown) => error instanceof ThusError && error.code === "REQUEST_TOO_LARGE");
});

test("enforces a total request deadline across retries", async () => {
  globalThis.fetch = async (_input, init) => new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
  });
  const api = createClient();
  await assert.rejects(api.get("https://example.test", { deadline: 10, retry: { attempts: 3, delay: 0, jitter: false } }), (error: unknown) => error instanceof ThusError && error.code === "DEADLINE_EXCEEDED");
});

test("bounds cache entries and respects private/no-store responses", async () => {
  let calls = 0;
  globalThis.fetch = async (input) => {
    calls += 1;
    const url = String(input);
    return response({ url }, 200, { "content-type": "application/json", "cache-control": url.includes("private") ? "private" : "no-store" });
  };
  const api = createClient();
  await api.get("https://example.test/private", { cacheOptions: { ttl: 1000 } });
  await api.get("https://example.test/private", { cacheOptions: { ttl: 1000 } });
  await api.get("https://example.test/no-store", { cacheOptions: { ttl: 1000, maxEntries: 1 } });
  await api.get("https://example.test/no-store", { cacheOptions: { ttl: 1000, maxEntries: 1 } });
  assert.equal(calls, 4);
});


test("guards redirect destinations when redirects are explicitly enabled", async () => {
  let calls = 0;
  globalThis.fetch = async (input, init) => {
    calls += 1;
    if (calls === 1) return new Response(null, { status: 302, headers: { location: "https://127.0.0.1/private" } });
    return response({ ok: true });
  };
  const api = createClient();
  await assert.rejects(api.get("https://example.test", { redirect: "follow", security: { allowRedirects: true } }), (error: unknown) => error instanceof ThusError && error.code === "SECURITY_ERROR");
  assert.equal(calls, 1);
});

test("rejects automatic follow redirects unless explicitly enabled", async () => {
  globalThis.fetch = async () => response(null, 302, { location: "https://example.test/next" });
  const api = createClient();
  await assert.rejects(api.get("https://example.test", { redirect: "follow" }), (error: unknown) => error instanceof ThusError && error.code === "SECURITY_ERROR");
});

test("supports binary and stream response types", async () => {
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "application/octet-stream" } });
  const api = createClient();
  const buffer = await api.get<ArrayBuffer>("https://example.test/binary", { responseType: "arrayBuffer" });
  assert.deepEqual(Array.from(new Uint8Array(buffer)), [1, 2, 3]);
  const stream = await api.get<ReadableStream<Uint8Array>>("https://example.test/stream", { responseType: "stream" });
  assert.ok(stream instanceof ReadableStream);
});

test("enforces response limits for binary payloads", async () => {
  globalThis.fetch = async () => new Response(new Uint8Array([1, 2, 3, 4, 5]), { status: 200 });
  const api = createClient();
  await assert.rejects(api.get<ArrayBuffer>("https://example.test/binary", { responseType: "arrayBuffer", security: { maxResponseSize: 4 } }), (error: unknown) => error instanceof ThusError && error.code === "RESPONSE_TOO_LARGE");
});

test("bounds returned streams by response size", async () => {
  globalThis.fetch = async () => new Response(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("1234"));
      controller.enqueue(new TextEncoder().encode("5678"));
      controller.close();
    }
  }), { status: 200, headers: { "content-type": "application/octet-stream" } });
  const api = createClient();
  const stream = await api.get<ReadableStream<Uint8Array>>("https://example.test/stream", { responseType: "stream", security: { maxResponseSize: 5 } });
  const reader = stream.getReader();
  assert.deepEqual(new TextDecoder().decode((await reader.read()).value), "1234");
  await assert.rejects(reader.read(), (error: unknown) => error instanceof ThusError && error.code === "RESPONSE_TOO_LARGE");
});

test("deduplicates stale cache revalidation", async () => {
  let calls = 0;
  let release: (() => void) | undefined;
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return response({ value: 1 }, 200, { "content-type": "application/json", etag: '"v1"' });
    await new Promise<void>((resolve) => { release = resolve; });
    return response({ value: 2 }, 200, { "content-type": "application/json", etag: '"v2"' });
  };
  const api = createClient();
  await api.get("https://example.test/revalidate", { cacheOptions: { ttl: 1, staleWhileRevalidate: true } });
  await new Promise((resolve) => setTimeout(resolve, 5));
  const results = await Promise.all([
    api.get("https://example.test/revalidate", { cacheOptions: { ttl: 1, staleWhileRevalidate: true } }),
    api.get("https://example.test/revalidate", { cacheOptions: { ttl: 1, staleWhileRevalidate: true } })
  ]);
  assert.deepEqual(results[0], { value: 1 });
  assert.deepEqual(results[1], { value: 1 });
  assert.equal(calls, 2);
  release?.();
  await new Promise((resolve) => setTimeout(resolve, 5));
});

test("fuzzes URL validation with malformed inputs", async () => {
  for (let i = 0; i < 1000; i += 1) {
    const candidate = i % 2 === 0 ? `https://[${i}` : `not-a-url-${i}`;
    assert.throws(() => validateUrl(candidate));
  }
});

async function main(): Promise<void> {
  let passed = 0;
  try {
    for (const item of tests) {
      await item.run();
      passed += 1;
      console.log(`PASS ${item.name}`);
    }
    console.log(`\n${passed}/${tests.length} tests passed`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
