import { ApiErrorBody, DEMO_ACTOR_HEADER, type ErrorCode } from "@ona-bola/shared";

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

let actorId: string | null = null;

/** The demo user chosen in the role switcher; sent with every request. */
export function setApiActor(id: string | null): void {
  actorId = id;
}

/** Fetches JSON from the API and validates it against a shared contract schema. */
export async function requestJson<T>(
  path: string,
  schema: Parser<T>,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (actorId) headers.set(DEMO_ACTOR_HEADER, actorId);

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
