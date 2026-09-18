# Security

ThusDev Fetch follows security-focused HTTP client practices and OWASP-aligned principles. It does not claim universal OWASP compliance because OWASP controls depend on the application and deployment environment.

## URL security

Requests accept only HTTP and HTTPS by default. Embedded URL credentials are rejected. Loopback and common private IPv4 destinations are blocked by default. Use `security.allowPrivateNetwork` only for trusted internal environments.

Use `security.allowedHosts` to enforce an explicit destination allowlist when requests are built from untrusted input.

## Redirects

Redirects default to `error`. Applications that need redirects should opt in deliberately. Redirects are handled manually when enabled so each destination can be validated before the next request. Use host allowlisting whenever destinations are not fully trusted. DNS rebinding and network egress controls still require application or infrastructure-level protection.

## Resource limits

Use `security.maxResponseSize` and `security.maxRequestSize` to reduce memory exhaustion risks. These limits are application-specific and should be chosen according to expected payload sizes.

## Secrets and logging

Built-in logging redacts authentication, cookie, API-key, proxy-authentication, and access-token headers. URLs are sanitized before debug output so common secret-bearing query parameters are redacted.

Do not log request or response bodies that may contain credentials, payment data, personal data, or other secrets.

## Cache safety

Memory caching is opt-in. Responses marked `private` or `no-store` are not stored. Authenticated requests should use an explicit, user-isolated cache key only when caching is intentionally safe.

## Retry safety

Retries are disabled by default. When enabled, only idempotent methods are retried unless unsafe-method retries are explicitly enabled. Payment and mutation APIs should use application-level idempotency keys where supported.

## Recommended deployment controls

- Prefer HTTPS.
- Validate and allowlist outbound hosts for untrusted URLs.
- Set request and response size limits.
- Keep debug logging disabled in production unless required.
- Avoid caching personalized or sensitive responses.
- Keep dependencies and Node.js versions current.
- Run dependency and static security checks in CI.
