import type { Plugin } from "../features/plugins";
import { logger, sanitizeHeaders } from "../utils/logger";

export function createLoggingPlugin(): Plugin {
  return {
    beforeRequest: async (config) => {
      logger.info(`${config.method ?? "GET"} ${config.url}`);
      logger.info(`Headers ${JSON.stringify(sanitizeHeaders(new Headers(config.headers)))}`);
      return config;
    },
    afterResponse: async (response) => {
      logger.success(`${response.status} ${response.url} (${response.duration}ms)`);
      return response;
    }
  };
}
