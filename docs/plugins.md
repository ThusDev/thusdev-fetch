# Plugins

Plugins can transform requests before transport and responses after transport.

```ts
api.plugins.use({
  beforeRequest: async (config) => config,
  afterResponse: async (response) => response
});
```

Plugins should avoid logging or persisting sensitive request and response bodies.
