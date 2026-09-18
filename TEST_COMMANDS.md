# ThusDev Fetch — Test & Release Commands

This file is the operational command reference for validating, packaging and releasing `thusdev-fetch`.

## 1. Clean installation

```bash
git clone https://github.com/ThusDev/thusdev-fetch.git
cd thusdev-fetch
npm ci
```

Verify the installed dependency tree:

```bash
npm ls --depth=0
```

If the repository is being tested from a release archive, extract it into a clean directory first and run the same commands.

## 2. Static validation

TypeScript:

```bash
npm run typecheck
```

Production build:

```bash
npm run build
```

Run the automated test suite:

```bash
npm test
```

Run the complete local release gate:

```bash
npm run release:check
```

## 3. Security validation

Run the dependency audit locally:

```bash
npm audit --audit-level=high
```

Inspect outdated dependencies:

```bash
npm outdated
```

Inspect the package lock without changing it:

```bash
npm ci
```

The repository CI also runs CodeQL, dependency review, Dependabot checks and the configured npm audit workflow.

## 4. Package validation

Preview the npm package contents:

```bash
npm pack --dry-run
```

Create the release tarball locally:

```bash
npm pack
```

Inspect the tarball:

```bash
tar -tf thusdev-fetch-*.tgz
```

Verify that development-only files are absent:

```bash
tar -tf thusdev-fetch-*.tgz | grep -E 'node_modules|\.github|test/|benchmark/'
```

The command should produce no unwanted development content.

## 5. Clean-install smoke test from the npm tarball

Create a temporary consumer project outside the repository:

```bash
mkdir ../thusdev-fetch-consumer
cd ../thusdev-fetch-consumer
npm init -y
npm install ../thusdev-fetch-main/thusdev-fetch-*.tgz
```

ESM smoke test:

```bash
node --input-type=module -e "import { createClient } from 'thusdev-fetch'; console.log(typeof createClient)"
```

CommonJS compatibility check, when a CommonJS entry is intentionally provided by the package configuration:

```bash
node -e "const pkg = require('thusdev-fetch'); console.log(typeof pkg)"
```

If CommonJS is not part of the published contract, this command is expected to fail and should not be treated as a defect.

## 6. Runtime HTTP checks

The automated suite covers mocked requests. For a real smoke test, point the client at a controlled HTTPS endpoint owned by the project or organization.

Check:

- GET
- POST
- PUT
- PATCH
- DELETE
- HEAD
- OPTIONS
- JSON response
- text response
- ArrayBuffer response
- Blob response
- stream response
- custom headers
- JSON body
- FormData body
- URLSearchParams body
- timeout
- AbortSignal cancellation
- total deadline
- retry and Retry-After
- response size limit
- request size limit
- redirects

Never use production payment or destructive endpoints for retry tests.

## 7. Security test matrix

The automated tests include dangerous URL cases. Before deployment, additionally verify in an isolated environment:

```text
http://127.0.0.1
http://0.0.0.0
http://10.0.0.1
http://172.16.0.1
http://192.168.1.1
http://169.254.169.254
http://[::1]
http://[fc00::1]
http://[fd00::1]
http://[fe80::1]
http://[::ffff:127.0.0.1]
https://user:password@example.com
file:///etc/passwd
ftp://example.com
```

Also verify:

- allowed host exact match
- allowed subdomain match
- lookalike domain rejection
- private-network rejection
- redirect to a private address
- redirect to a disallowed host
- redirect chain exceeding `maxRedirects`
- malformed `Location` headers
- sensitive query redaction
- sensitive header redaction
- `Cache-Control: private`
- `Cache-Control: no-store`
- request and response size limits

## 8. DNS rebinding / SSRF validation

URL validation alone cannot prove that a hostname will never resolve to a private address. A dedicated isolated DNS test environment is required.

Test a hostname that resolves to a public address first and a private address during a subsequent lookup. Verify that the surrounding application or network egress policy blocks the private destination.

Recommended controls outside the library:

- outbound firewall rules
- cloud metadata endpoint protection
- DNS resolution policy
- proxy/egress gateway restrictions
- private-network segmentation
- allowlists for trusted upstreams

Do not run DNS rebinding tests against third-party infrastructure without authorization.

## 9. Cache validation

Verify:

- fresh TTL hit
- expired entry
- ETag revalidation
- Last-Modified revalidation
- stale-while-revalidate
- bounded cache size
- LRU-like eviction behavior
- explicit invalidation
- prefix invalidation
- private response is not cached
- no-store response is not cached
- authenticated responses are not cached unless an explicit cache key is supplied
- concurrent stale requests produce one background revalidation

## 10. Stream size validation

A bounded stream should fail once the cumulative number of bytes exceeds `maxResponseSize`.

The automated suite includes a stream-over-limit test. Also test with a real endpoint that emits multiple chunks and verify that the consumer receives an error instead of an unbounded response.

## 11. Fuzz / robustness checks

Run the built-in malformed URL fuzz test through the normal suite:

```bash
npm test
```

For an extended local fuzz run, generate additional inputs covering:

- empty URLs
- whitespace
- invalid schemes
- malformed IPv4
- malformed IPv6
- encoded credentials
- Unicode hostnames
- trailing dots
- unusual ports
- very long paths
- very long query strings
- repeated query parameters
- malformed redirect locations
- unusual header casing

Do not treat a fuzz run as a replacement for a professional security assessment.

## 12. Performance checks

Run the benchmark:

```bash
npm run benchmark:compare
```

Repeat with controlled payload sizes and concurrency when evaluating production performance.

Record at least:

- throughput
- average latency
- p95/p99 latency
- memory usage
- CPU usage
- error rate
- retry amplification
- cache hit ratio

Do not make universal claims such as “fastest HTTP client” from a single local benchmark.

## 13. Browser/framework compatibility

Run a real consumer smoke test for every environment listed as supported by the project documentation.

Recommended matrix:

- Node 18
- Node 20
- Node 22
- Node 24
- Vite
- React
- Vue
- Next.js
- Nuxt

Verify that the package uses only APIs available in each declared target environment.

## 14. Coverage

The project should maintain meaningful coverage of security-sensitive paths. If a coverage provider is installed in the project, run its configured command here.

Example with a locally installed `c8` workflow:

```bash
npx c8 npm test
```

Review uncovered branches in:

- URL validation
- redirect handling
- retry decisions
- timeout/deadline handling
- response-size enforcement
- cache policy
- stream limits
- error normalization

Do not use an ad-hoc coverage number as proof of security.

## 15. CI checks

On GitHub, confirm that the pull request passes:

- dependency installation
- typecheck
- tests
- build
- Node 18
- Node 20
- Node 22
- Node 24
- CodeQL
- dependency review
- npm audit workflow

Do not release while a security or build gate is failing.

## 16. Git release checks

Inspect the working tree:

```bash
git status --short
git diff --check
git diff
```

Inspect commits and tags:

```bash
git log --oneline -10
git tag --list --sort=-version:refname | head
```

Verify package metadata:

```bash
npm pkg get name version description repository license exports files
```

## 17. Version consistency

Verify the version in:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- README release references
- Git tag

Example:

```bash
npm pkg get version
npm ls thusdev-fetch --depth=0
```

## 18. Final release gate

Run all local gates:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run security:check
npm pack --dry-run
npm run benchmark:compare
```

Then inspect:

```bash
git diff --check
git status --short
```

The release is ready for publication only when the required automated and manual checks are complete and no unresolved security-critical finding remains.

## 19. Publishing

Publishing is intentionally not automated by this document. Before publishing, confirm the npm account, organization, provenance configuration and release permissions.

Dry-run package creation:

```bash
npm pack --dry-run
```

Publish only after the complete release gate succeeds:

```bash
npm publish
```

After publishing, verify the package from a clean consumer project rather than relying only on the local build.

## 20. Professional security review

Before claiming that the library has been independently audited, commission an authorized external security review covering at least:

- SSRF
- DNS rebinding
- redirect validation
- credential leakage
- cache poisoning
- request smuggling assumptions
- resource exhaustion
- retry safety
- prototype pollution through user-controlled data
- dependency vulnerabilities
- browser and Node runtime behavior
- denial-of-service scenarios

Record findings, remediation and retest evidence in the project's security process.
