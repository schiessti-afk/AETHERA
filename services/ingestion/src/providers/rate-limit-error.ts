export class OpenSkyRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(`OpenSky credits exhausted; retry after ${retryAfterSeconds}s`);
    this.name = "OpenSkyRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
