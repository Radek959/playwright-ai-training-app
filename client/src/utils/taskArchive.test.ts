import { describe, expect, it } from "vitest";
import { isArchived } from "./taskArchive";
import type { Task } from "../types";

type ArchivableTask = Pick<Task, "status" | "completedAt" | "dueDate">;

const archivableTask = (overrides: Partial<ArchivableTask> = {}): ArchivableTask => ({
  status: "done",
  completedAt: undefined,
  dueDate: undefined,
  ...overrides
});

describe("isArchived", () => {
  const now = new Date("2026-02-01T00:00:00.000Z").getTime();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

  it("is never archived when the task is not done", () => {
    const task = archivableTask({
      status: "todo",
      completedAt: new Date(now - THIRTY_DAYS_MS * 2).toISOString()
    });
    expect(isArchived(task, now)).toBe(false);
  });

  it("is not archived when completed less than 30 days ago", () => {
    const completedAt = new Date(now - (THIRTY_DAYS_MS - 1000)).toISOString();
    expect(isArchived(archivableTask({ completedAt }), now)).toBe(false);
  });

  it("is not archived exactly at the 30 day boundary", () => {
    const completedAt = new Date(now - THIRTY_DAYS_MS).toISOString();
    expect(isArchived(archivableTask({ completedAt }), now)).toBe(false);
  });

  it("is archived just past the 30 day boundary", () => {
    const completedAt = new Date(now - THIRTY_DAYS_MS - 1000).toISOString();
    expect(isArchived(archivableTask({ completedAt }), now)).toBe(true);
  });

  it("falls back to dueDate when completedAt is missing", () => {
    const dueDate = new Date(now - THIRTY_DAYS_MS - 1000).toISOString();
    expect(isArchived(archivableTask({ completedAt: undefined, dueDate }), now)).toBe(true);
  });

  it("is not archived when neither completedAt nor dueDate is set", () => {
    expect(isArchived(archivableTask({ completedAt: undefined, dueDate: undefined }), now)).toBe(false);
  });

  it("is not archived when the reference date is unparseable", () => {
    expect(isArchived(archivableTask({ completedAt: "not-a-date" }), now)).toBe(false);
  });
});
