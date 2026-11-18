import type { ErrorCode } from "@ona-bola/shared";

/** An error with an HTTP status and a shared error code. The error handler sends it as ApiErrorBody. */
export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
