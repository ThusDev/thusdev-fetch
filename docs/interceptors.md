# Interceptors

Request and response interceptors can be asynchronous and can be ejected using their returned numeric identifier.

```ts
const id = api.interceptors.useRequest(async (config) => config);
api.interceptors.ejectRequest(id);
```
