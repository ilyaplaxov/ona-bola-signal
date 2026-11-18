import { ApiErrorBody, type ErrorCode } from "@ona-bola/shared";

/** A failed API call, carrying the shared error code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Anything with a parse method, such as a shared Zod schema. */
interface Parser<T> {
  parse(data: unknown): T;
}

/**
 * Fetches JSON from the API and validates it against a shared contract schema. Who is asking comes
 * from the httpOnly session cookie: the Vite proxy keeps the API on the page's own origin, so the
 * browser sends it by itself and no header or `credentials` option is needed.
 */
export async function requestJson<T>(
  path: string,
  schema: Parser<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  // A FormData body (file upload) sets its own multipart Content-Type with the boundary.
  if (init.body !== undefined && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = ApiErrorBody.safeParse(body);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(response.status, code, message, details);
    }
    throw new ApiError(
      response.status,
      "INTERNAL",
      `Request failed with status ${response.status}`,
    );
  }
  return schema.parse(body);
}

/** POST/PATCH with a JSON body. */
export function sendJson<T>(
  path: string,
  schema: Parser<T>,
  body: unknown,
  method: "POST" | "PATCH",
): Promise<T> {
  return requestJson(path, schema, {
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
