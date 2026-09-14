import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskEditModal } from "./TaskEditModal";
import { ApiError } from "../utils/apiError";
import type { Task, User } from "../types";

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Task with a dependency",
    status: "todo",
    priority: "medium",
    ...overrides
  };
}

const users: User[] = [
  { id: "u1", name: "Alice", email: "alice@example.com", role: "editor" },
  { id: "u2", name: "Bob", email: "bob@example.com", role: "viewer" }
];

const otherTasks: Task[] = [
  { id: "t2", title: "Second task", status: "todo", priority: "low" },
  { id: "t3", title: "Third task", status: "done", priority: "low" }
];

const richTask = makeTask({
  title: "Fully populated task",
  description: "Some description",
  status: "in-progress",
  priority: "medium",
  dueDate: "2026-05-01T00:00:00.000Z",
  assigneeId: "u1",
  taskType: "bug",
  severity: "critical",
  estimatedHours: 8,
  tags: ["backend", "urgent"],
  dependencies: ["t2"],
  requiresApproval: true,
  approver: "manager-a"
});

function renderModal(task: Task, onSave = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(
    <TaskEditModal
      task={task}
      open
      users={users}
      existingTasks={[task, ...otherTasks]}
      onClose={onClose}
      onSave={onSave}
    />
  );
  return { onSave, onClose };
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));

describe("TaskEditModal extended fields", () => {
  it("pre-fills every extended field from the task being edited", () => {
    renderModal(richTask);

    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Fully populated task");
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("Some description");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("in-progress");
    expect((screen.getByLabelText("Priority") as HTMLSelectElement).value).toBe("medium");
    expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-05-01");
    expect((screen.getByLabelText("Assignee") as HTMLSelectElement).value).toBe("u1");
    expect((screen.getByLabelText("Task type") as HTMLSelectElement).value).toBe("bug");
    expect((screen.getByLabelText("Severity") as HTMLSelectElement).value).toBe("critical");
    expect((screen.getByLabelText("Estimated hours") as HTMLInputElement).value).toBe("8");
    expect((screen.getByLabelText("Tags (comma separated)") as HTMLInputElement).value).toBe("backend, urgent");
    expect((screen.getByLabelText("Requires manager approval") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Approver") as HTMLSelectElement).value).toBe("manager-a");
    expect(screen.getByTestId("edit-task-dependency-t2")).toBeInTheDocument();
  });

  it("sends only the changed field, leaving all other saved values alone", async () => {
    const { onSave } = renderModal(richTask);

    fireEvent.change(screen.getByLabelText("Estimated hours"), { target: { value: "12" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ estimatedHours: 12 });
  });

  it("clears severity, approver, estimate, tags and dependencies with the API's clearing values", async () => {
    const { onSave } = renderModal(richTask);

    fireEvent.change(screen.getByLabelText("Task type"), { target: { value: "feature" } });
    fireEvent.change(screen.getByLabelText("Estimated hours"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Tags (comma separated)"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText("Requires manager approval"));
    fireEvent.click(screen.getByRole("button", { name: "Remove dependency Second task" }));
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      taskType: "feature",
      severity: null,
      estimatedHours: null,
      tags: [],
      dependencies: [],
      requiresApproval: false,
      approver: null
    });
  });

  it("clears the assignee, description and due date with an explicit null", async () => {
    const { onSave } = renderModal(richTask);

    fireEvent.change(screen.getByLabelText("Assignee"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Description"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ assigneeId: null, description: null, dueDate: null });
  });

  it("hides severity and approver once their conditions no longer hold", () => {
    renderModal(richTask);

    expect(screen.getByTestId("edit-task-severity-field")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Task type"), { target: { value: "research" } });
    expect(screen.queryByTestId("edit-task-severity-field")).not.toBeInTheDocument();

    expect(screen.getByTestId("edit-task-approver-field")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Requires manager approval"));
    expect(screen.queryByTestId("edit-task-approver-field")).not.toBeInTheDocument();
  });
});

describe("TaskEditModal client-side validation", () => {
  it("blocks a bug without a severity", async () => {
    const { onSave } = renderModal(makeTask({ taskType: "feature" }));

    fireEvent.change(screen.getByLabelText("Task type"), { target: { value: "bug" } });
    save();

    expect(await screen.findByText("Bugs require a severity level")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks a research task without an estimate", async () => {
    const { onSave } = renderModal(makeTask());

    fireEvent.change(screen.getByLabelText("Task type"), { target: { value: "research" } });
    save();

    expect(await screen.findByText("Research tasks require a time estimate of at least 1 hour")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks a high priority task estimated at more than 24 hours", async () => {
    const { onSave } = renderModal(makeTask());

    fireEvent.change(screen.getByLabelText("Priority"), { target: { value: "high" } });
    fireEvent.change(screen.getByLabelText("Estimated hours"), { target: { value: "30" } });
    save();

    expect(await screen.findByText("High priority tasks cannot exceed 24h")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks a non-positive estimate", async () => {
    const { onSave } = renderModal(makeTask());

    fireEvent.change(screen.getByLabelText("Estimated hours"), { target: { value: "0" } });
    save();

    expect(await screen.findByText("Estimated hours must be a positive number")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks required approval without an approver", async () => {
    const { onSave } = renderModal(makeTask());

    fireEvent.click(screen.getByLabelText("Requires manager approval"));
    save();

    expect(await screen.findByText("Select an approver")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks a title shorter than 3 characters after trimming", async () => {
    const { onSave } = renderModal(makeTask());

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: " ab " } });
    save();

    expect(await screen.findByText("Title must be at least 3 characters")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("TaskEditModal dependency picker", () => {
  it("never offers the edited task itself or an already-selected dependency", () => {
    renderModal(richTask);

    const options = Array.from((screen.getByLabelText("Add dependency") as HTMLSelectElement).options).map((o) => o.value);
    expect(options).toEqual(["", "t3"]);
    expect(options).not.toContain("t1");
    expect(options).not.toContain("t2");
  });

  it("adds a dependency picked from the existing task list", async () => {
    const { onSave } = renderModal(richTask);

    fireEvent.change(screen.getByLabelText("Add dependency"), { target: { value: "t3" } });
    fireEvent.click(screen.getByTestId("edit-task-dependency-add"));
    expect(screen.getByTestId("edit-task-dependency-t3")).toBeInTheDocument();

    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ dependencies: ["t2", "t3"] });
  });

  it("shows each option with its title and id", () => {
    renderModal(richTask);
    const select = screen.getByLabelText("Add dependency") as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.textContent)).toContain("Third task (t3)");
  });
});

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

describe("TaskEditModal cyclic dependency handling", () => {
  const cycleError = (cycle: { id: string; title: string }[], message: string) =>
    new ApiError(message, [], [], [], undefined, undefined, cycle);

  it("explains a rejected self-dependency next to the dependency picker", async () => {
    const task = makeTask();
    const onSave = vi.fn().mockRejectedValue(
      cycleError(
        [{ id: "t1", title: "Task with a dependency" }],
        "Cannot save cyclic task dependencies: Task with a dependency → Task with a dependency"
      )
    );
    renderModal(task, onSave);

    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/A task cannot depend on itself: Task with a dependency → Task with a dependency/)
    ).toBeInTheDocument();
  });

  it("explains a rejected indirect cycle and lists the loop", async () => {
    const task = makeTask();
    const onSave = vi.fn().mockRejectedValue(
      cycleError(
        [
          { id: "t1", title: "Task with a dependency" },
          { id: "t2", title: "Second task" }
        ],
        "Cannot save cyclic task dependencies: Task with a dependency → Second task → Task with a dependency"
      )
    );
    renderModal(task, onSave);

    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const message = await screen.findByText(
      /These dependencies form a loop: Task with a dependency → Second task → Task with a dependency/
    );
    // The explanation is an alert, so it is announced rather than being
    // distinguishable only by its colour.
    expect(message).toHaveAttribute("role", "alert");
  });

  it("keeps the modal open with the entered values after a cycle conflict", async () => {
    const task = makeTask({ dependencies: [] });
    const onSave = vi
      .fn()
      .mockRejectedValue(
        cycleError(
          [
            { id: "t1", title: "Task with a dependency" },
            { id: "t2", title: "Second task" }
          ],
          "Cannot save cyclic task dependencies"
        )
      );
    renderModal(task, onSave);

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Renamed while editing" } });
    fireEvent.change(screen.getByLabelText("Add dependency"), { target: { value: "t2" } });
    fireEvent.click(screen.getByTestId("edit-task-dependency-add"));
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    // Nothing was saved, so the form keeps exactly what the user typed and
    // picked — including the dependency the API rejected — ready to be fixed.
    expect(screen.getByTestId("task-edit-modal")).toBeInTheDocument();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Renamed while editing");
    expect(screen.getByTestId("edit-task-dependency-t2")).toBeInTheDocument();
  });

  it("does not revert the status field for a cycle conflict", async () => {
    const task = makeTask();
    const onSave = vi
      .fn()
      .mockRejectedValue(
        cycleError([{ id: "t1", title: "Task with a dependency" }], "Cannot save cyclic task dependencies")
      );
    renderModal(task, onSave);

    const statusSelect = screen.getByLabelText("Status") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "in-progress" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    // The rejection is about the dependency graph, not about completing the
    // task, so the status the user picked is left alone.
    expect(statusSelect.value).toBe("in-progress");
  });

  it("succeeds on retry once the offending dependency is removed", async () => {
    const task = makeTask({ dependencies: ["t2"] });
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(
        cycleError(
          [
            { id: "t1", title: "Task with a dependency" },
            { id: "t2", title: "Second task" }
          ],
          "Cannot save cyclic task dependencies"
        )
      )
      .mockResolvedValueOnce(undefined);
    renderModal(task, onSave);

    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/These dependencies form a loop/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove dependency Second task" }));
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ dependencies: [] }));
    // The previous conflict message is gone once the retry is accepted.
    await waitFor(() => expect(screen.queryByText(/These dependencies form a loop/)).not.toBeInTheDocument());
  });
});
