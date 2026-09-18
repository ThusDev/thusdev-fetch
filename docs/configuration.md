# Configuration

```ts
import { createClient } from "thusdev-fetch";

const api = createClient({
  baseURL: "https://api.example.com",
  timeout: 5000,
  security: {
    allowedHosts: ["api.example.com"],
    maxRequestSize: 1024 * 1024,
    maxResponseSize: 5 * 1024 * 1024
  }
});
```

## Security options

- `allowedHosts`: exact hosts or subdomains that may be contacted.
- `allowedProtocols`: protocols permitted by the client. HTTP and HTTPS are the defaults.
- `allowPrivateNetwork`: permits loopback/private IPv4 literal destinations when explicitly enabled.
- `maxRequestSize`: maximum known request payload size in bytes.
- `maxResponseSize`: maximum response body size in bytes.

`redirect` defaults to `error` for safer behavior. Opt into another Fetch redirect mode only when it is appropriate for the application.
