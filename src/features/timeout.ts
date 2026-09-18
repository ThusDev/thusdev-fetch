export function createTimeout(ms: number, controller: AbortController): ReturnType<typeof setTimeout> {
  return setTimeout(() => controller.abort(), ms);
}
