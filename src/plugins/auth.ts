import type { Plugin } from "../features/plugins";

export type AuthTokenProvider = () => string | undefined | Promise<string | undefined>;

export function createAuthPlugin(provider: AuthTokenProvider): Plugin {
  return {
    beforeRequest: async (config) => {
      const token = await provider();
      if (!token) return config;
      const headers = new Headers(config.headers);
      if (!headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
      return { ...config, headers };
    }
  };
}
