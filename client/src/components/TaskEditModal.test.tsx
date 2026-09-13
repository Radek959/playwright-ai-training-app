import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskEditModal } from "./TaskEditModal";
import { ApiError } from "../utils/apiError";
import type { Task } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Task with a dependency",
    status: "todo",
    priority: "medium",
    ...overrides
  };
}

describe("TaskEditModal status handling on a rejected save", () => {
  it("reverts the status field to the task's real status after a blocking-dependency 409", async () => {
    const task = makeTask();
    const blockingError = new ApiError(
      "Cannot complete task with incomplete dependencies: Dep 1 (todo)",
      [],
      [{ id: "dep-1", title: "Dep 1", status: "todo" }]
    );
    const onSave = vi.fn().mockRejectedValue(blockingError);

    render(<TaskEditModal task={task} open users={[]} onClose={vi.fn()} onSave={onSave} />);

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    expect(statusSelect.value).toBe("todo");

    fireEvent.change(statusSelect, { target: { value: "done" } });
    expect(statusSelect.value).toBe("done");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    // The save was rejected because of incomplete dependencies, so the task
    // is still "todo" server-side — the field must not keep showing "done".
    await waitFor(() => expect(statusSelect.value).toBe("todo"));
    expect(
      screen.getByText("Cannot complete task with incomplete dependencies: Dep 1 (todo)")
    ).toBeInTheDocument();
  });

  it("keeps the entered title after a blocking-dependency 409, reverting only status", async () => {
    const task = makeTask();
    const blockingError = new ApiError("Cannot complete task with incomplete dependencies", [], [
      { id: "dep-1", title: "Dep 1", status: "in-progress" }
    ]);
    const onSave = vi.fn().mockRejectedValue(blockingError);

    render(<TaskEditModal task={task} open users={[]} onClose={vi.fn()} onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed while editing" } });
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("todo"));

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Renamed while editing");
  });

  it("does not revert status for a non-dependency validation error", async () => {
    const task = makeTask();
    const validationError = new ApiError("title must be at least 3 characters", [
      { field: "title", message: "title must be at least 3 characters" }
    ]);
    const onSave = vi.fn().mockRejectedValue(validationError);

    render(<TaskEditModal task={task} open users={[]} onClose={vi.fn()} onSave={onSave} />);

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getAllByText("title must be at least 3 characters").length).toBeGreaterThan(0));

    // No blocking-dependency info on this error, so the user's in-progress
    // edit to status is left alone rather than being silently discarded.
    expect(statusSelect.value).toBe("done");
  });

  it("allows retrying and succeeding once the blocking dependency is resolved", async () => {
    const task = makeTask();
    const blockingError = new ApiError("Cannot complete task with incomplete dependencies", [], [
      { id: "dep-1", title: "Dep 1", status: "todo" }
    ]);
    const onSave = vi.fn().mockRejectedValueOnce(blockingError).mockResolvedValueOnce(undefined);

    render(<TaskEditModal task={task} open users={[]} onClose={vi.fn()} onSave={onSave} />);

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(statusSelect.value).toBe("todo"));

    // Retry: pick "done" again now that the dependency has (hypothetically)
    // been completed, and this time the save succeeds.
    fireEvent.change(statusSelect, { target: { value: "done" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "done" })
    );
  });
});
