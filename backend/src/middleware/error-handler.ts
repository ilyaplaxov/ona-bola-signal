import type { ApiErrorBody } from "@ona-bola/shared";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";
import { HttpError } from "../http-error";

/** Turns validation issues into the `details` list of a VALIDATION_FAILED response. */
export function issueDetails(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

/** 404 for any /api route that no router handled. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", `No route for ${req.method} ${req.baseUrl}${req.path}`));
};

/** Sends every error in the shared ApiErrorBody shape. Must stay the last middleware. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, body } = toErrorResponse(err);
  res.status(status).json(body);
};

function toErrorResponse(err: unknown): { status: number; body: ApiErrorBody } {
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  }
  if (err instanceof z.ZodError) {
    return {
      status: 400,
      body: {
        error: {
          code: "VALIDATION_FAILED",
          message: "Request validation failed",
          details: issueDetails(err),
        },
      },
    };
  }
  const bodyStatus = bodyParserStatus(err);
  if (bodyStatus !== null) {
    const message =
      bodyStatus === 413 ? "Request body is too large" : "Request body is not valid JSON";
    return { status: bodyStatus, body: { error: { code: "VALIDATION_FAILED", message } } };
  }
  console.error(err);
  return { status: 500, body: { error: { code: "INTERNAL", message: "Unexpected server error" } } };
}

/** express.json() errors carry a 4xx `status` and a `type` such as "entity.parse.failed". */
function bodyParserStatus(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const { status, type } = err as { status?: unknown; type?: unknown };
  const isClientError = typeof status === "number" && status >= 400 && status < 500;
  return typeof type === "string" && isClientError ? status : null;
}
