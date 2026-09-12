export type ApiFieldError = { field: string; message: string };

/**
 * Error thrown for a failed API response. Carries the structured
 * `details[]` the server returns for validation failures (each with a
 * `field` and `message`) alongside a human-readable summary message, so
 * callers can map errors onto individual form controls instead of only
 * showing a generic banner.
 */
export class ApiError extends Error {
  details: ApiFieldError[];

  constructor(message: string, details: ApiFieldError[] = []) {
    super(message);
    this.name = "ApiError";
    this.details = details;
  }
}

function isFieldError(value: unknown): value is ApiFieldError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).field === "string" &&
    typeof (value as Record<string, unknown>).message === "string"
  );
}

/**
 * Builds an ApiError from a failed fetch Response, preserving any
 * field-level validation details the server included.
 */
export async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  try {
    const data = await res.json();
    const details = Array.isArray(data?.details) ? data.details.filter(isFieldError) : [];
    const message =
      details.length > 0
        ? details.map((d: ApiFieldError) => d.message).join("; ")
        : typeof data?.error === "string"
        ? data.error
        : fallback;
    return new ApiError(message, details);
  } catch {
    return new ApiError(fallback, []);
  }
}

/**
 * Splits an error's field-level details into errors that map onto a known
 * set of form field names and messages that don't (so callers never force
 * unrelated/generic errors onto a specific control, e.g. Title).
 */
export function mapFieldErrors(
  details: ApiFieldError[],
  knownFields: ReadonlySet<string>
): { mapped: Record<string, string>; unmapped: string[] } {
  const mapped: Record<string, string> = {};
  const unmapped: string[] = [];
  for (const d of details) {
    if (knownFields.has(d.field)) {
      mapped[d.field] = d.message;
    } else {
      unmapped.push(d.message);
    }
  }
  return { mapped, unmapped };
}
