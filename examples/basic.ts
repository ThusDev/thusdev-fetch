import { createClient, createAuthPlugin } from "thusdev-fetch";

const api = createClient({
  baseURL: "https://api.example.com",
  timeout: 5000,
  retry: {
    attempts: 3,
    delay: 100,
    maxDelay: 2000,
    retryAfter: true
  },
  cacheOptions: {
    ttl: 30000
  }
});

api.plugins.use(createAuthPlugin(async () => globalThis.localStorage?.getItem("api-token") ?? undefined));

const user = await api.get<{ id: string; name: string }>("/users/1");
console.log(user.name);
