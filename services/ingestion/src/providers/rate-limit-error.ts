/**
 * Provider-agnostic rate-limit signal. OpenSky's credit exhaustion is one
 * implementation; a second provider can throw the same error without the
 * poller knowing which source it is talking to (PHASE4 W5).
 */
export class ProviderRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number, message?: string) {
    super(message ?? `Provider rate-limited; retry after ${retryAfterSeconds}s`);
    this.name = "ProviderRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** @deprecated Use ProviderRateLimitError. Kept as a named subclass for OpenSky logs. */
export class OpenSkyRateLimitError extends ProviderRateLimitError {
  constructor(retryAfterSeconds: number) {
    super(retryAfterSeconds, `OpenSky credits exhausted; retry after ${retryAfterSeconds}s`);
    this.name = "OpenSkyRateLimitError";
  }
}
