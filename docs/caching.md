# Caching

Caching is opt-in for GET requests. The in-memory cache is bounded and uses LRU-style eviction.

Responses with `Cache-Control: no-store` or `Cache-Control: private` are not stored.

For authenticated resources, use an explicit cache key that is isolated to the intended identity and only cache data that is safe to retain in process memory.
