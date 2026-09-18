# ThusDev Fetch

[![CI](https://github.com/ThusDev/thusdev-fetch/actions/workflows/ci.yml/badge.svg)](https://github.com/ThusDev/thusdev-fetch/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/thusdev-fetch.svg)](https://www.npmjs.com/package/thusdev-fetch)
[![npm downloads](https://img.shields.io/npm/dm/thusdev-fetch.svg)](https://www.npmjs.com/package/thusdev-fetch)
[![License](https://img.shields.io/npm/l/thusdev-fetch.svg)](https://github.com/ThusDev/thusdev-fetch/blob/main/LICENSE)

A lightweight, TypeScript-first HTTP client built on native `fetch` for modern applications.

ThusDev Fetch provides safe retries, timeouts, interceptors, plugins, structured errors, secure debug logging, caching, request metrics, and request timing without replacing the simplicity of `fetch`.

## Requirements

- Node.js 18 or newer
- A runtime with `fetch`, `Headers`, `Request`, `Response`, `AbortController`, `FormData`, and `Blob`

## Installation

```bash
npm install thusdev-fetch
```

## Quick start

```ts
import { createClient } from "thusdev-fetch";

const api = createClient({
  baseURL: "https://api.example.com",
  timeout: 5000,
  retry: 2
});

type User = {
  id: number;
  name: string;
};

const user = await api.get<User>("/users/1");
console.log(user.name);
```

## Features

- Native `fetch` foundation
- TypeScript generics
- All common HTTP methods
- JSON, text, `FormData`, `Blob`, `ArrayBuffer`, and `URLSearchParams` bodies
- Base URL support
- Standard fetch options
- Timeout and external abort signals
- Exponential backoff with optional jitter
- Retry-After support
- Safe retry defaults for idempotent methods
- Explicit unsafe-method retry opt-in
- Request and response interceptors
- Async plugins
- Memory caching for GET requests
- ETag and Last-Modified revalidation
- Optional stale-while-revalidate behavior
- Structured errors
- Secure debug logging
- Request lifecycle hooks
- Request metrics
- Authentication and logging plugins
- SSRF-aware URL validation and host allowlisting
- Safe redirect default (`error`)
- Request and response size limits
- Bounded LRU-style memory cache
- Total request deadline across retries
- Guarded redirects with destination validation and configurable limits
- Typed response modes for JSON, text, ArrayBuffer, Blob, and streams

## Client factory

Use `createClient` when you want a concise API:

```ts
const api = createClient({
  baseURL: "https://api.example.com",
  security: {
    allowedHosts: ["api.example.com"],
    maxRequestSize: 1024 * 1024,
    maxResponseSize: 5 * 1024 * 1024
  }
});
```

`new ThusFetch()` remains fully supported.

## HTTP methods

```ts
await api.get<User>("/users/1");
await api.post<User>("/users", { name: "Ada" });
await api.put<User>("/users/1", { name: "Ada Lovelace" });
await api.patch<User>("/users/1", { name: "Ada" });
await api.delete("/users/1");
await api.head("/users/1");
await api.options("/users/1");
```

## Request bodies

Plain objects are serialized as JSON. Existing body types are passed through without modification.

```ts
await api.post("/users", { name: "Ada" });

const form = new FormData();
form.set("name", "Ada");
await api.post("/users", form);

await api.post("/query", new URLSearchParams({ q: "thusdev" }));
```

## Retries

Retries are disabled by default.

```ts
await api.get("/users", {
  retry: {
    attempts: 3,
    delay: 100,
    maxDelay: 2000,
    factor: 2,
    jitter: true,
    retryAfter: true
  }
});
```

Transient HTTP statuses include `408`, `425`, `429`, `500`, `502`, `503`, and `504`.

By default, retries are allowed for idempotent methods: `GET`, `HEAD`, `OPTIONS`, `PUT`, and `DELETE`. `POST` and `PATCH` are not retried unless explicitly enabled.

```ts
await api.post("/payments", payload, {
  retry: {
    attempts: 2,
    retryUnsafeMethods: true
  }
});
```

Custom retry logic receives the error and retry context:

```ts
await api.get("/users", {
  retry: {
    attempts: 2,
    retryOn: (error, context) => {
      console.log(context.attempt, error);
      return true;
    }
  }
});
```

## Security configuration

Security controls are available through `security` and are designed to reduce common client-side SSRF, resource-exhaustion, credential-leakage, and unsafe-redirect risks.

```ts
const api = createClient({
  baseURL: "https://api.example.com",
  security: {
    allowedHosts: ["api.example.com"],
    maxRequestSize: 1024 * 1024,
    maxResponseSize: 5 * 1024 * 1024
  },
  redirect: "error"
});
```

HTTP and HTTPS are allowed by default. Embedded URL credentials and loopback/private IPv4 and IPv6 literal destinations are rejected by default. `allowedHosts` is recommended when URLs can be influenced by untrusted input. Private-network access can be explicitly enabled with `allowPrivateNetwork` for trusted internal environments.

Response caching does not store responses marked `private` or `no-store`, and the in-memory cache is bounded. Avoid caching personalized or sensitive responses unless the cache key is deliberately isolated.

See [Security](./docs/security.md) for the threat model and deployment guidance.

## Timeout and cancellation

```ts
const controller = new AbortController();

await api.get("/users", {
  timeout: 5000,
  deadline: 15000,
  signal: controller.signal
});

controller.abort();
```

Timeouts produce `ThusError` with code `TIMEOUT`. User cancellation produces `ABORTED`. A configured `deadline` limits the entire operation across retries and produces `DEADLINE_EXCEEDED`.

## Interceptors

```ts
const requestId = api.interceptors.useRequest((config) => {
  const headers = new Headers(config.headers);
  headers.set("x-client", "thusdev");
  return { ...config, headers };
});

const responseId = api.interceptors.useResponse((response) => response);

api.interceptors.ejectRequest(requestId);
api.interceptors.ejectResponse(responseId);
```

Interceptors can be asynchronous and execute in registration order.

## Plugins

```ts
api.plugins.use({
  beforeRequest: async (config) => config,
  afterResponse: async (response) => response
});
```

Plugins can be removed:

```ts
const plugin = {
  beforeRequest: async (config) => config
};

api.plugins.use(plugin);
api.plugins.remove(plugin);
```

### Authentication plugin

```ts
import { createAuthPlugin } from "thusdev-fetch";

api.plugins.use(createAuthPlugin(async () => getAccessToken()));
```

The plugin only adds `Authorization` when a request does not already provide one.

### Logging plugin

```ts
import { createLoggingPlugin } from "thusdev-fetch";

api.plugins.use(createLoggingPlugin());
```

Sensitive headers are redacted by the built-in logger.

## Caching

Caching is opt-in and applies to GET requests.

```ts
const user = await api.get<User>("/users/1", {
  cacheOptions: {
    ttl: 30000
  }
});
```

ETag and Last-Modified values are used for conditional revalidation after an entry expires.

For authenticated requests, caching is disabled by default unless an explicit cache key is supplied:

```ts
await api.get("/me", {
  headers: {
    Authorization: `Bearer ${token}`
  },
  cacheOptions: {
    key: `me:${userId}`,
    ttl: 30000
  }
});
```

Stale-while-revalidate can return an expired entry immediately while refreshing it in the background:

```ts
await api.get("/config", {
  cacheOptions: {
    ttl: 30000,
    staleWhileRevalidate: true
  }
});
```

The cache can be managed directly:

```ts
api.clearCache();
api.invalidateCache("GET:https://api.example.com/users");
```

## Hooks and metrics

```ts
const api = createClient({
  onRequestStart: ({ method, url }) => {
    console.log("start", method, url);
  },
  onRequestEnd: ({ status, duration, error }) => {
    console.log("end", status, duration, error);
  },
  onRetry: ({ attempt, method, url }) => {
    console.log("retry", attempt, method, url);
  }
});

const metrics = api.getMetrics();
api.resetMetrics();
```

Metrics expose total requests, successes, failures, retries, and cumulative duration.

## Errors

```ts
import { ThusError } from "thusdev-fetch";

try {
  await api.get("/users/1");
} catch (error) {
  if (error instanceof ThusError) {
    console.log(error.code);
    console.log(error.status);
    console.log(error.method);
    console.log(error.url);
    console.log(error.response);
    console.log(error.retryAfter);
  }
}
```

Available codes:

- `NETWORK_ERROR`
- `TIMEOUT`
- `HTTP_ERROR`
- `ABORTED`
- `UNKNOWN_ERROR`
- `SECURITY_ERROR`
- `REQUEST_TOO_LARGE`
- `RESPONSE_TOO_LARGE`
- `DEADLINE_EXCEEDED`

## Debugging

```ts
import { setDebug } from "thusdev-fetch";

setDebug(true);
```

Debug logging includes method, sanitized URL, status, and duration. Authorization, cookies, API keys, proxy authorization, and common token headers are redacted. Common sensitive query parameters are also redacted. Keep debug logging disabled in production unless explicitly required.

## Response types

Use `responseType` when the response is not JSON or when streaming is required:

```ts
const file = await api.get<ArrayBuffer>("/file", { responseType: "arrayBuffer" });
const stream = await api.get<ReadableStream<Uint8Array>>("/large-file", { responseType: "stream" });
```

Supported values are `auto`, `json`, `text`, `arrayBuffer`, `blob`, and `stream`.

## TypeScript

Every HTTP method accepts a response generic:

```ts
type Product = {
  id: string;
  name: string;
};

const product = await api.get<Product>("/products/1");
```

## Security and quality

The project includes CI, dependency auditing, CodeQL analysis, dependency review, Dependabot configuration, deterministic tests, and security-focused tests. The implementation follows OWASP-aligned practices relevant to an HTTP client; it does not claim universal OWASP compliance because application-level controls depend on the deployment environment.

Read the detailed guides:

- [Security](./docs/security.md)
- [Configuration](./docs/configuration.md)
- [Retries](./docs/retries.md)
- [Caching](./docs/caching.md)
- [Performance](./docs/performance.md)
- [Interceptors](./docs/interceptors.md)
- [Plugins](./docs/plugins.md)
- [Migration](./docs/migration.md)
- [API Reference](./docs/api.md)
- [Compatibility](./docs/compatibility.md)
- [Pre-deployment test plan](./TEST_BEFORE_DEPLOYING.md
- [`TEST_COMMANDS.md`](./TEST_COMMANDS.md) — command-by-command validation, packaging, security and release reference)

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm run pack:check
npm run benchmark
```

The test suite is deterministic and uses mocked `fetch` calls. It does not require network access.

Benchmark iterations can be changed:

```bash
BENCHMARK_ITERATIONS=10000 npm run benchmark
```

The benchmark reports both `thusdev-fetch` and native `fetch` under the same local mocked transport. These numbers measure this repository's overhead in one controlled scenario and are not a universal performance ranking.

## Release

Create a version tag after validation:

```bash
npm run typecheck
npm test
npm run build
npm pack --dry-run
git tag v1.5.0
git push origin v1.5.0
```

The GitHub release workflow validates the package and publishes it to npm with provenance. No npm token is stored in the repository; publishing is performed through npm trusted publishing/OIDC.

## Project structure

```text
src/
├── core/
├── features/
├── plugins/
└── utils/

benchmark/
test/
.github/
```

## Documentation

- [API Reference](docs/api.md)
- [Compatibility](docs/compatibility.md)
- [Performance](docs/performance.md)
- [Security](docs/security.md)

## Development & Testing

- [Test Commands](TEST_COMMANDS.md) — Complete reference of commands for testing, validation, security checks, benchmarking, and release preparation.
- [Pre-Deployment Checklist](TEST_BEFORE_DEPLOYING.md) — Complete checklist to run before releasing or deploying a new version.

## Security

See [SECURITY.md](SECURITY.md) for the security policy and vulnerability reporting process.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## Development and Testing

- TEST_COMMANDS.md — complete command reference for development and validation
- TEST_BEFORE_DEPLOYING.md — pre-release and pre-deployment checklist

## License

MIT © 2026 ThusDev

Built in Benin. Built for developers everywhere.
