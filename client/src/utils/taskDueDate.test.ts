import { afterEach, describe, expect, it } from "vitest";
import { formatDueDateUtc, getTaskDueStatus, isTaskDueSoon, isTaskOverdue } from "./taskDueDate";

// This browser-targeted project's tsconfig has no Node types; process.env is
// still available at runtime under Vitest (a Node process), so this test
// file (only) declares the minimal shape it needs to toggle TZ.
declare const process: { env: Record<string, string | undefined> };

const NOW = Date.UTC(2026, 5, 15, 12, 30, 0); // 2026-06-15T12:30:00Z
const DAY_MS = 24 * 60 * 60 * 1000;

function isoDaysFromNow(days: number, hour = 0): string {
  return new Date(NOW + days * DAY_MS).toISOString().slice(0, 10) + `T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

// Mirrors formatDueDateUtc's own formatting call, so the expectation tracks
// the runtime's locale (e.g. CI) instead of hardcoding an en-US string.
function expectedUtcDisplay(dateStr: string): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).format(
    new Date(dateStr)
  );
}

describe("getTaskDueStatus", () => {
  it("classifies a due date from yesterday as overdue", () => {
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(-1), status: "todo" }, NOW)).toBe("overdue");
  });

  it("classifies a due date of today as soon", () => {
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(0), status: "todo" }, NOW)).toBe("soon");
  });

  it("classifies a due date three days from now as soon", () => {
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(3), status: "todo" }, NOW)).toBe("soon");
  });

  it("classifies a due date four days from now as scheduled (no warning)", () => {
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(4), status: "todo" }, NOW)).toBe("scheduled");
  });

  it("does not warn on a done task even if its due date is in the past", () => {
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(-5), status: "done" }, NOW)).toBe("scheduled");
  });

  it("returns none for a task without a dueDate", () => {
    expect(getTaskDueStatus({ dueDate: undefined, status: "todo" }, NOW)).toBe("none");
  });

  it("returns none for an invalid dueDate", () => {
    expect(getTaskDueStatus({ dueDate: "not-a-date", status: "todo" }, NOW)).toBe("none");
  });

  it("ignores time-of-day within the same UTC day for both dueDate and now", () => {
    const lateNow = Date.UTC(2026, 5, 15, 23, 59, 59);
    const earlyNow = Date.UTC(2026, 5, 15, 0, 0, 1);
    // A due date later today (23:00Z) is still "soon" whether `now` is early
    // or late in that same UTC day.
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(0, 23), status: "todo" }, lateNow)).toBe("soon");
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(0, 23), status: "todo" }, earlyNow)).toBe("soon");
    // A due date recorded at 00:00Z yesterday is overdue regardless of what
    // time today `now` falls at.
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(-1, 0), status: "todo" }, lateNow)).toBe("overdue");
    expect(getTaskDueStatus({ dueDate: isoDaysFromNow(-1, 0), status: "todo" }, earlyNow)).toBe("overdue");
  });

  it("handles the month/year boundary correctly", () => {
    const endOfYear = Date.UTC(2025, 11, 31, 10, 0, 0); // 2025-12-31T10:00Z
    // Due "yesterday" from Jan 1 is Dec 31 of the previous year -> overdue.
    expect(getTaskDueStatus({ dueDate: "2025-12-31T23:00:00.000Z", status: "todo" }, Date.UTC(2026, 0, 1, 1, 0, 0))).toBe(
      "overdue"
    );
    // Due today (Dec 31) relative to a `now` also on Dec 31 -> soon.
    expect(getTaskDueStatus({ dueDate: "2025-12-31T23:00:00.000Z", status: "todo" }, endOfYear)).toBe("soon");
    // Due Jan 1 relative to `now` on Dec 31 (within the 3-day window) -> soon.
    expect(getTaskDueStatus({ dueDate: "2026-01-01T00:00:00.000Z", status: "todo" }, endOfYear)).toBe("soon");
  });
});

describe("isTaskOverdue / isTaskDueSoon", () => {
  it("mirror getTaskDueStatus", () => {
    expect(isTaskOverdue({ dueDate: isoDaysFromNow(-1), status: "todo" }, NOW)).toBe(true);
    expect(isTaskOverdue({ dueDate: isoDaysFromNow(1), status: "todo" }, NOW)).toBe(false);
    expect(isTaskDueSoon({ dueDate: isoDaysFromNow(2), status: "todo" }, NOW)).toBe(true);
    expect(isTaskDueSoon({ dueDate: isoDaysFromNow(-1), status: "todo" }, NOW)).toBe(false);
  });
});

describe("formatDueDateUtc", () => {
  const originalTZ = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTZ;
  });

  it("returns null for a missing or invalid dueDate", () => {
    expect(formatDueDateUtc(undefined)).toBeNull();
    expect(formatDueDateUtc("not-a-date")).toBeNull();
  });

  it("keeps the full ISO timestamp for the <time> dateTime attribute", () => {
    expect(formatDueDateUtc("2026-06-15T00:00:00.000Z")?.iso).toBe("2026-06-15T00:00:00.000Z");
  });

  it("formats a midnight-UTC dueDate as the same calendar day getTaskDueStatus classifies against", () => {
    const dueDate = "2026-06-15T00:00:00.000Z";
    // Classified relative to a `now` that is also June 15 UTC -> "soon".
    expect(getTaskDueStatus({ dueDate, status: "todo" }, Date.UTC(2026, 5, 15))).toBe("soon");
    expect(formatDueDateUtc(dueDate)?.display).toBe(expectedUtcDisplay(dueDate));
  });

  it("formats the same UTC calendar day regardless of the local timezone (west or east of UTC)", () => {
    const dueDate = "2026-06-15T00:00:00.000Z";

    process.env.TZ = "Pacific/Kiritimati"; // UTC+14, east of UTC
    const eastResult = formatDueDateUtc(dueDate);

    process.env.TZ = "Etc/GMT+12"; // UTC-12, west of UTC
    const westResult = formatDueDateUtc(dueDate);

    // A local-time based formatter (toLocaleDateString/toLocaleString) would
    // shift this date by a day in one of these two zones; the UTC-forced
    // formatter must not.
    expect(eastResult).toEqual(westResult);
    expect(westResult?.display).toBe(expectedUtcDisplay(dueDate));
  });
});
