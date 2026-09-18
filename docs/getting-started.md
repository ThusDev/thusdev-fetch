# Getting Started

```bash
npm install thusdev-fetch
```

```ts
import { createClient } from "thusdev-fetch";

const api = createClient({ baseURL: "https://api.example.com" });
const user = await api.get<{ id: number; name: string }>("/users/1");
```
