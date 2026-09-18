import type { RequestConfig, ResponseData } from "../core/client";

export type Plugin = {
  beforeRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
  afterResponse?: (response: ResponseData) => ResponseData | Promise<ResponseData>;
};

export class PluginManager {
  private plugins: Plugin[] = [];

  use(plugin: Plugin): void {
    this.plugins.push(plugin);
  }

  remove(plugin: Plugin): void {
    this.plugins = this.plugins.filter((item) => item !== plugin);
  }

  async runBefore(config: RequestConfig): Promise<RequestConfig> {
    let current = config;
    for (const plugin of this.plugins) {
      if (plugin.beforeRequest) current = await plugin.beforeRequest(current);
    }
    return current;
  }

  async runAfter(response: ResponseData): Promise<ResponseData> {
    let current = response;
    for (const plugin of this.plugins) {
      if (plugin.afterResponse) current = await plugin.afterResponse(current);
    }
    return current;
  }
}
