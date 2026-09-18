# Changelog

## 1.5.0

- Added bounded streaming response enforcement for `maxResponseSize`.
- Added stale-while-revalidate deduplication to prevent concurrent background revalidation storms.
- Added deterministic malformed-URL fuzz coverage.
- Added a complete command reference for testing, security validation, packaging and release operations.


## 1.4.0

- Added guarded manual redirect handling with destination validation and redirect limits.
- Added `responseType` support for JSON, text, ArrayBuffer, Blob, and streams.
- Added stricter host allowlist normalization.
- Added a complete pre-deployment verification checklist.
- Expanded compatibility, security, performance, and release documentation.


All notable changes to this project are documented here.

## [1.2.0] - 2026-09-18

### Added

- `createClient` factory for concise client creation.
- Memory cache for GET requests with TTL.
- ETag and Last-Modified conditional revalidation.
- Optional stale-while-revalidate cache behavior.
- Lifecycle hooks for request start, request end, and retry events.
- Request metrics with success, failure, retry, and duration counters.
- Retry-After support for transient HTTP failures.
- Safe retry policy that excludes non-idempotent methods by default.
- Explicit opt-in for retries of unsafe methods.
- Authentication and logging plugins.
- Release workflow with npm provenance.
- Benchmark command.
- Backward-compatible `ThusError` constructor overload.

### Improved

- Expanded request body support.
- Stronger retry controls and exponential backoff.
- Safer caching around Authorization headers.
- Expanded deterministic test coverage.
- Package metadata and release configuration.

## [1.1.0] - 2026-09-17

### Added

- TypeScript-first request and response types.
- Timeout and abort handling.
- Smart retries with exponential backoff and jitter.
- Request and response interceptors with ejection.
- Async plugin lifecycle with removal.
- Structured `ThusError` codes and metadata.
- Secure debug logging with sensitive-header redaction.
- Request timing.
- Deterministic mocked test suite.
- CI, security policy, contributing guide, and code of conduct.

[1.2.0]: https://github.com/ThusDev/thusdev-fetch/releases/tag/v1.2.0
[1.1.0]: https://github.com/ThusDev/thusdev-fetch/releases/tag/v1.1.0

## Security note

URL validation reduces common SSRF risks for direct destinations but cannot guarantee protection against DNS rebinding or a malicious upstream environment. Applications handling untrusted destinations should combine host allowlisting with network egress controls.
