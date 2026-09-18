export function startTimer(): number {
  return Date.now();
}

export function endTimer(start: number): number {
  return Date.now() - start;
}
