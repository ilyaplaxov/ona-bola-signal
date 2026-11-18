import type { Response } from "express";
import { z } from "zod";
import { HttpError } from "../http-error";
import { issueDetails } from "./error-handler";

/**
 * Sends a response after checking it against its shared contract schema. A mismatch is a server
 * bug, so it becomes a 500 (logged with the details), never a 400.
 */
export function sendJson<S extends z.ZodType>(
  res: Response,
  schema: S,
  data: z.input<S>,
  status = 200,
): void {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Response does not match its contract:\n${z.prettifyError(result.error)}`);
  }
  res.status(status).json(result.data);
}

/**
 * Parses untrusted input (req.body, req.query or req.params) with a shared contract schema.
 * Invalid input throws a 400 VALIDATION_FAILED error with field details. Express 5 forwards errors
 * thrown in async handlers to the error handler, so routes need no try/catch.
 *
 *   const { id } = parseInput(IdParams, req.params);
 *   const body = parseInput(SubmitMeasurementsRequest, req.body);
 */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(
      400,
      "VALIDATION_FAILED",
      "Request validation failed",
      issueDetails(result.error),
    );
  }
  return result.data;
}
