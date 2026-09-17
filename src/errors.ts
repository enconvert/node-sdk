/** Enconvert SDK exceptions. */

export class EnconvertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EnconvertError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class APIError extends EnconvertError {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(`[${statusCode}] ${message}`);
    this.name = "APIError";
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends APIError {
  constructor(message = "Invalid or missing API key") {
    super(401, message);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RateLimitError extends APIError {
  /** Seconds to wait, from the Retry-After header; undefined when absent. */
  readonly retryAfter?: number;

  constructor(message = "Rate limit exceeded", retryAfter?: number) {
    super(429, message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Plan or quota gate (HTTP 402). V2 endpoints raise this when the feature
 * is not enabled on the plan or the monthly quota is exhausted.
 */
export class QuotaError extends APIError {
  constructor(message = "Plan feature not enabled or quota exhausted") {
    super(402, message);
    this.name = "QuotaError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
