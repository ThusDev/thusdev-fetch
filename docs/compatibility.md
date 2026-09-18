# Compatibility

## Runtime

| Runtime | Status |
| --- | --- |
| Node.js 18 | Supported |
| Node.js 20 | Supported |
| Node.js 22 | Supported |
| Node.js 24 | Targeted and should be validated before release |
| Modern browsers with Fetch API | Supported for browser-safe features |

## TypeScript

The package is authored in strict TypeScript and publishes declarations. Validate the package with the TypeScript versions supported by your application before deployment.

## Browser and Node differences

The core client uses the platform Fetch API. Node-specific transport controls such as custom agents, HTTP/2, HTTP/3, and connection-pool tuning are intentionally not part of the core API. Use a dedicated transport adapter when an application requires those controls.

## Release validation

The CI matrix validates Node.js 18, 20, and 22. Validate Node.js 24 and representative browser bundles before claiming production compatibility for them.
