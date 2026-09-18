export function explainError(status?: number): string {
  if (status === undefined) return "The request failed before a valid HTTP response was received.";
  if (status === 400) return "The server rejected the request as invalid.";
  if (status === 401) return "Authentication is required or the provided credentials are invalid.";
  if (status === 403) return "The authenticated client is not allowed to access this resource.";
  if (status === 404) return "The requested resource was not found.";
  if (status === 408) return "The server timed out while waiting for the request.";
  if (status === 409) return "The request conflicts with the current state of the resource.";
  if (status === 422) return "The request was well formed but could not be processed.";
  if (status === 429) return "The client has sent too many requests.";
  if (status >= 500) return "The server returned an error while processing the request.";
  return `The server returned HTTP ${status}.`;
}
