import type { RequestConfig, ResponseData } from "../core/client";

export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;
export type ResponseInterceptor = (response: ResponseData) => ResponseData | Promise<ResponseData>;

type InterceptorEntry<T> = {
  id: number;
  handler: T;
};

export class InterceptorManager {
  private nextId = 0;
  private requestHandlers: InterceptorEntry<RequestInterceptor>[] = [];
  private responseHandlers: InterceptorEntry<ResponseInterceptor>[] = [];

  useRequest(handler: RequestInterceptor): number {
    const id = this.nextId++;
    this.requestHandlers.push({ id, handler });
    return id;
  }

  useResponse(handler: ResponseInterceptor): number {
    const id = this.nextId++;
    this.responseHandlers.push({ id, handler });
    return id;
  }

  ejectRequest(id: number): void {
    this.requestHandlers = this.requestHandlers.filter((entry) => entry.id !== id);
  }

  ejectResponse(id: number): void {
    this.responseHandlers = this.responseHandlers.filter((entry) => entry.id !== id);
  }

  async runRequest(config: RequestConfig): Promise<RequestConfig> {
    let current = config;
    for (const entry of this.requestHandlers) current = await entry.handler(current);
    return current;
  }

  async runResponse(response: ResponseData): Promise<ResponseData> {
    let current = response;
    for (const entry of this.responseHandlers) current = await entry.handler(current);
    return current;
  }
}
