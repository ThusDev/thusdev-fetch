# API Reference

## Client creation

```ts
import { createClient } from "thusdev-fetch"

const api = createClient({
  baseURL: "https://api.example.com",
  timeout: 10000,
  retry: 3
})
```

## Response types

`responseType` accepts `auto`, `json`, `text`, `arrayBuffer`, `blob`, or `stream`.

```ts
const stream = await api.get<ReadableStream<Uint8Array>>("/large-file", {
  responseType: "stream"
})
```

## Security controls

Security options include host allowlists, protocol restrictions, private-network blocking, request and response size limits, explicit redirect permission, and redirect limits. Private and loopback destinations are blocked by default.

## Retries

Retries use exponential backoff with jitter by default. Unsafe methods are not retried unless explicitly enabled. `Retry-After` can be honored for server-provided retry timing.

## Observability

Lifecycle hooks and metrics expose request starts, completions, failures, retries, duration, and aggregate counts without requiring an external telemetry dependency.
