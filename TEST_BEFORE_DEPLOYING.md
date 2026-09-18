# ThusDev Fetch — Pre-Deployment Test Plan

Use this checklist before publishing a release to npm or creating a production GitHub release. Mark every applicable item as PASS. Do not publish when a security-critical item is unresolved.

## 1. Source and repository

- [ ] Confirm the intended branch and commit are clean.
- [ ] Confirm no secrets, tokens, private URLs, credentials, `.env` files, or generated local data are committed.
- [ ] Confirm `node_modules` is not tracked or included in the release archive.
- [ ] Confirm the package repository, homepage, issue tracker, author, license, and version are correct.
- [ ] Confirm the version in `package.json` matches the release tag and changelog.
- [ ] Review all changed public APIs for semver compatibility.

## 2. Install and dependency integrity

- [ ] Run `npm ci` from a clean checkout.
- [ ] Run `npm audit --audit-level=high`.
- [ ] Review any audit findings manually; do not ignore high or critical findings without a documented reason.
- [ ] Confirm `package-lock.json` is committed and consistent with `package.json`.
- [ ] Confirm Dependabot is enabled.
- [ ] Confirm CodeQL and dependency review workflows are enabled.

## 3. Type safety

- [ ] Run `npm run typecheck`.
- [ ] Build with the minimum supported Node.js version.
- [ ] Build with the current CI Node.js versions.
- [ ] Validate declarations from `dist/*.d.ts`.
- [ ] Test ESM consumption.
- [ ] Test CommonJS consumption when the target application requires it.
- [ ] Test a representative TypeScript application with strict mode enabled.

## 4. Automated tests

- [ ] Run `npm test`.
- [ ] Confirm all tests pass.
- [ ] Confirm tests do not require the public internet.
- [ ] Confirm tests restore global state such as `fetch`, timers, and console methods.
- [ ] Test GET, POST, PUT, PATCH, DELETE, HEAD, and OPTIONS.
- [ ] Test JSON, text, FormData, Blob, ArrayBuffer, and URLSearchParams request bodies.
- [ ] Test JSON, text, ArrayBuffer, Blob, and stream responses.
- [ ] Test empty, 204, 205, and 304 responses.
- [ ] Test malformed JSON responses.
- [ ] Test network failures.
- [ ] Test timeout.
- [ ] Test caller cancellation.
- [ ] Test global deadline across retries.
- [ ] Test retry backoff and jitter.
- [ ] Test `Retry-After` seconds and HTTP-date forms.
- [ ] Confirm POST/PATCH are not retried by default.
- [ ] Confirm unsafe retries require explicit configuration.
- [ ] Test interceptor registration, execution order, and ejection.
- [ ] Test plugin registration, asynchronous lifecycle, and removal.
- [ ] Test lifecycle hooks and metrics.

## 5. Security tests

- [ ] Confirm `file:` is rejected.
- [ ] Confirm unsupported protocols are rejected.
- [ ] Confirm embedded URL credentials are rejected.
- [ ] Confirm localhost and loopback destinations are rejected by default.
- [ ] Confirm private IPv4 ranges are rejected by default.
- [ ] Confirm link-local IPv4 is rejected.
- [ ] Confirm private and loopback IPv6 is rejected.
- [ ] Confirm IPv4-mapped IPv6 private addresses are rejected.
- [ ] Test decimal, hexadecimal, and unusual URL host representations relevant to the runtime.
- [ ] Test trailing-dot hostnames.
- [ ] Test host allowlists with exact hosts and subdomains.
- [ ] Test an allowlist rejection for a lookalike domain such as `example.com.attacker.test`.
- [ ] Confirm redirects are disabled by default.
- [ ] If redirects are enabled, test a redirect to a private IP and confirm rejection.
- [ ] If redirects are enabled, test a redirect to an unallowed host and confirm rejection.
- [ ] Test redirect loops and maximum redirect count.
- [ ] Test request-size limits before transmission.
- [ ] Test response-size limits using both `Content-Length` and chunked streaming responses.
- [ ] Confirm debug output redacts authorization, cookies, API keys, tokens, passwords, and signatures.
- [ ] Confirm sensitive query parameters are redacted.
- [ ] Confirm response bodies are not written to logs by default.
- [ ] Test cache behavior for `private` and `no-store`.
- [ ] Test cache isolation when authentication is involved.
- [ ] Test cache invalidation.
- [ ] Review custom plugins for secret leakage.

## 6. SSRF and redirect review

- [ ] Test direct access to cloud metadata IPs in a controlled environment.
- [ ] Test DNS names that resolve to private addresses using a controlled test resolver.
- [ ] Test DNS rebinding behavior where the runtime/application architecture permits it.
- [ ] Test redirect chains that move from a public host to a private destination.
- [ ] Test redirect chains that move between allowed and unallowed hosts.
- [ ] Do not treat URL parsing alone as complete SSRF protection. Review network egress controls at the application and infrastructure layers.

## 7. Resource exhaustion

- [ ] Test very large response bodies.
- [ ] Test slow/chunked responses.
- [ ] Test large request bodies.
- [ ] Test many concurrent requests.
- [ ] Test cache growth and eviction.
- [ ] Confirm stale-while-revalidate cannot create unbounded background requests.
- [ ] Confirm retries cannot create an uncontrolled request storm.
- [ ] Test cancellation during a large response.

## 8. Cache

- [ ] Test TTL expiration.
- [ ] Test LRU eviction.
- [ ] Test ETag revalidation.
- [ ] Test Last-Modified revalidation.
- [ ] Test 304 handling.
- [ ] Test `Cache-Control: no-store`.
- [ ] Test `Cache-Control: private`.
- [ ] Test authenticated responses.
- [ ] Test explicit cache keys.
- [ ] Test invalidation by prefix.

## 9. Performance

- [ ] Run `npm run benchmark`.
- [ ] Run benchmarks after a warm-up period.
- [ ] Record runtime and hardware.
- [ ] Compare against native Fetch only as an overhead baseline.
- [ ] Measure small, medium, and large responses.
- [ ] Measure concurrency 10, 100, and 1000.
- [ ] Measure memory for large responses.
- [ ] Measure cache hit/miss.
- [ ] Measure interceptor/plugin overhead.
- [ ] Investigate any unexpected regression before release.

## 10. Browser and framework validation

- [ ] Test a Vite browser application.
- [ ] Test a React application if the package is intended for React users.
- [ ] Test a Vue application if the package is intended for Vue users.
- [ ] Test a Next.js application when SSR is supported by the release target.
- [ ] Test a Nuxt application when SSR is supported by the release target.
- [ ] Verify browser CORS behavior is documented rather than incorrectly handled by the client.

## 11. Package validation

- [ ] Run `npm run build`.
- [ ] Run `npm pack --dry-run`.
- [ ] Inspect the generated tarball contents.
- [ ] Confirm only intended files are shipped.
- [ ] Install the generated tarball into a clean temporary project.
- [ ] Import the package from ESM.
- [ ] Verify the published entry point and declaration entry point.
- [ ] Verify the package works without the repository source tree.

## 12. Documentation

- [ ] README matches the actual public API.
- [ ] README examples execute successfully.
- [ ] CHANGELOG describes the release.
- [ ] Security documentation matches the implementation.
- [ ] Migration documentation covers breaking or behavior-changing changes.
- [ ] Compatibility documentation reflects tested runtimes.
- [ ] Performance claims are backed by reproducible benchmarks.
- [ ] No documentation claims absolute security or universal OWASP compliance.

## 13. Release

- [ ] Run `npm run release:check`.
- [ ] Review the complete Git diff.
- [ ] Create the Git tag only after all release checks pass.
- [ ] Verify GitHub Actions pass for the tag.
- [ ] Verify npm provenance is present.
- [ ] Install the published package from npm in a clean project.
- [ ] Run a smoke test against a controlled HTTP endpoint.
- [ ] Verify the GitHub Release notes and npm version match.
- [ ] Monitor issues and security reports after publication.

## 14. Manual production smoke test

Use a controlled endpoint and verify:

1. GET succeeds.
2. POST sends the expected body and content type.
3. Authentication headers are present but never logged.
4. Timeout terminates a hanging request.
5. Cancellation terminates an in-flight request.
6. A transient 503 retries according to configuration.
7. A 400/401/403/404 does not retry by default.
8. A large response is rejected at the configured limit.
9. A redirect is rejected unless explicitly enabled.
10. An enabled redirect is validated before the next request.
11. Cache hits avoid unnecessary network calls.
12. Cache revalidation handles 304 correctly.
13. Metrics and hooks report the expected lifecycle.

## Release decision

Publish only when:

- [ ] Automated tests pass.
- [ ] Typecheck passes.
- [ ] Build passes.
- [ ] Dependency/security checks pass or documented exceptions are approved.
- [ ] Package contents are verified.
- [ ] Documentation is synchronized.
- [ ] Security-critical manual tests pass.
- [ ] Performance regression review is complete.
- [ ] A clean-install smoke test passes.
