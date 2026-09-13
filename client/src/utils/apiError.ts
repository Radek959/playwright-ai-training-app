export type ApiFieldError = { field: string; message: string };

export type BlockingDependency = { id: string; title: string; status: string };

export type ConflictingTaskStatus = "todo" | "in-progress";

export type ConflictingTask = { id: string; title: string; status: ConflictingTaskStatus };

/**
 * Error thrown for a failed API response. Carries the structured
 * `details[]` the server returns for validation failures (each with a
 * `field` and `message`) alongside a human-readable summary message, so
 * callers can map errors onto individual form controls instead of only
 * showing a generic banner. `blockingDependencies` is populated for the
 * 409 a task's `dependencies` rule returns, so callers can list the
 * specific tasks blocking completion instead of only the summary message.
 * `conflictingTasks` is populated for the 409 a user's active-tasks rule
 * returns, so callers can list the specific tasks blocking deletion
 * instead of only the summary message.
 */
export class ApiError extends Error {
  details: ApiFieldError[];
  blockingDependencies: BlockingDependency[];
  conflictingTasks: ConflictingTask[];

  constructor(
    message: string,
    details: ApiFieldError[] = [],
    blockingDependencies: BlockingDependency[] = [],
    conflictingTasks: ConflictingTask[] = []
  ) {
    super(message);
    this.name = "ApiError";
    this.details = details;
    this.blockingDependencies = blockingDependencies;
    this.conflictingTasks = conflictingTasks;
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

function isBlockingDependency(value: unknown): value is BlockingDependency {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).id === "string" &&
    typeof (value as Record<string, unknown>).title === "string" &&
    typeof (value as Record<string, unknown>).status === "string"
  );
}

function isConflictingTask(value: unknown): value is ConflictingTask {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    (candidate.status === "todo" || candidate.status === "in-progress")
  );
}

/**
 * Builds an ApiError from a failed fetch Response, preserving any
 * field-level validation details, blocking-dependency, or
 * conflicting-tasks info the server included.
 */
export async function toApiError(res: Response, fallback: string): Promise<ApiError> {
  try {
    const data = await res.json();
    const details = Array.isArray(data?.details) ? data.details.filter(isFieldError) : [];
    const blockingDependencies = Array.isArray(data?.blockingDependencies)
      ? data.blockingDependencies.filter(isBlockingDependency)
      : [];
    const conflictingTasks = Array.isArray(data?.conflictingTasks)
      ? data.conflictingTasks.filter(isConflictingTask)
      : [];
    const baseMessage =
      details.length > 0
        ? details.map((d: ApiFieldError) => d.message).join("; ")
        : typeof data?.error === "string"
        ? data.error
        : fallback;
    const message =
      blockingDependencies.length > 0
        ? `${baseMessage}: ${blockingDependencies.map((d: BlockingDependency) => `${d.title} (${d.status})`).join(", ")}`
        : baseMessage;
    return new ApiError(message, details, blockingDependencies, conflictingTasks);
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
