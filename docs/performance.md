# Performance

ThusDev Fetch is designed as a low-overhead abstraction over the platform Fetch API. It does not claim to be faster than native Fetch.

Benchmark locally with:

```bash
npm run benchmark
```

For meaningful comparisons, run repeated measurements on the same machine and runtime, include warm-up runs, report median and tail latency, and test multiple payload sizes and concurrency levels. Network conditions, DNS, TLS, server latency, and runtime version can dominate results.

Recommended release benchmark matrix:

- GET 1 KB
- GET 100 KB
- GET 1 MB
- POST JSON
- concurrency 10, 100, and 1000
- cache hit and miss
- retry enabled and disabled
- interceptor enabled and disabled
- memory usage for large responses
