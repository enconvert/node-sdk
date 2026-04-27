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
  constructor(message = "Rate limit exceeded") {
    super(429, message);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
