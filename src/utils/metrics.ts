export type RequestMetrics = {
  total: number;
  succeeded: number;
  failed: number;
  retried: number;
  totalDuration: number;
};

export class MetricsStore {
  private readonly state: RequestMetrics = {
    total: 0,
    succeeded: 0,
    failed: 0,
    retried: 0,
    totalDuration: 0
  };

  recordStart(): void {
    this.state.total += 1;
  }

  recordSuccess(duration: number): void {
    this.state.succeeded += 1;
    this.state.totalDuration += duration;
  }

  recordFailure(duration: number): void {
    this.state.failed += 1;
    this.state.totalDuration += duration;
  }

  recordRetry(): void {
    this.state.retried += 1;
  }

  snapshot(): RequestMetrics {
    return { ...this.state };
  }

  reset(): void {
    this.state.total = 0;
    this.state.succeeded = 0;
    this.state.failed = 0;
    this.state.retried = 0;
    this.state.totalDuration = 0;
  }
}
