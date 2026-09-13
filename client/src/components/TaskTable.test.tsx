import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { TaskTable } from "./TaskTable";
import { AppErrorProvider } from "../context/AppErrorContext";
import type { Task } from "../types";

function makeTask(id: string, title: string): Task {
  return { id, title, status: "todo", priority: "medium" };
}

function renderTable(
  tasks: Task[],
  overrides: Partial<Parameters<typeof TaskTable>[0]> = {}
) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onBulkDelete = vi.fn().mockResolvedValue([]);
  const onSortChange = vi.fn();
  const utils = render(
    <AppErrorProvider>
      <MemoryRouter>
        <TaskTable
          tasks={tasks}
          users={[]}
          sortKey="title"
          sortDir="asc"
          onSortChange={onSortChange}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onBulkDelete={onBulkDelete}
          {...overrides}
        />
      </MemoryRouter>
    </AppErrorProvider>
  );
  return { ...utils, onUpdate, onDelete, onBulkDelete, onSortChange };
}

describe("TaskTable selection safety", () => {
  it("drops a selected task from selection once it disappears from the tasks prop", () => {
    const taskA = makeTask("a", "Task A");
    const taskB = makeTask("b", "Task B");
    const { rerender } = renderTable([taskA, taskB]);

    fireEvent.click(screen.getByTestId("select-a"));
    expect(screen.getByTestId("selected-count")).toHaveTextContent("1");

    rerender(
      <AppErrorProvider>
        <MemoryRouter>
          <TaskTable
            tasks={[taskB]}
            users={[]}
            sortKey="title"
            sortDir="asc"
            onSortChange={vi.fn()}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
            onBulkDelete={vi.fn().mockResolvedValue([])}
          />
        </MemoryRouter>
      </AppErrorProvider>
    );

    expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument();
  });

  it("restricts onBulkDelete to currently visible ids when a selected task is no longer visible", async () => {
    const taskA = makeTask("a", "Task A");
    const taskB = makeTask("b", "Task B");
    const onBulkDelete = vi.fn().mockResolvedValue(["a"]);
    const { rerender } = renderTable([taskA, taskB], { onBulkDelete });

    fireEvent.click(screen.getByTestId("select-a"));
    fireEvent.click(screen.getByTestId("select-b"));
    expect(screen.getByTestId("selected-count")).toHaveTextContent("2");

    rerender(
      <AppErrorProvider>
        <MemoryRouter>
          <TaskTable
            tasks={[taskA]}
            users={[]}
            sortKey="title"
            sortDir="asc"
            onSortChange={vi.fn()}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
            onBulkDelete={onBulkDelete}
          />
        </MemoryRouter>
      </AppErrorProvider>
    );

    fireEvent.click(screen.getByTestId("bulk-delete-btn"));

    expect(onBulkDelete).toHaveBeenCalledTimes(1);
    expect(onBulkDelete).toHaveBeenCalledWith(["a"]);
    await waitFor(() => expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument());
  });

  it("does not call onBulkDelete when no selected id remains visible", () => {
    const taskA = makeTask("a", "Task A");
    const taskB = makeTask("b", "Task B");
    const onBulkDelete = vi.fn().mockResolvedValue([]);
    const { rerender } = renderTable([taskA, taskB], { onBulkDelete });

    fireEvent.click(screen.getByTestId("select-a"));

    rerender(
      <AppErrorProvider>
        <MemoryRouter>
          <TaskTable
            tasks={[taskB]}
            users={[]}
            sortKey="title"
            sortDir="asc"
            onSortChange={vi.fn()}
            onUpdate={vi.fn()}
            onDelete={vi.fn()}
            onBulkDelete={onBulkDelete}
          />
        </MemoryRouter>
      </AppErrorProvider>
    );

    // Selection for "a" was dropped once it left the visible set, so no bulk
    // actions bar (and no delete button) should even be rendered anymore.
    expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument();
    expect(onBulkDelete).not.toHaveBeenCalled();
  });

  it("selects only the currently visible rows via Select all", () => {
    const taskA = makeTask("a", "Task A");
    const taskB = makeTask("b", "Task B");
    renderTable([taskA, taskB]);

    fireEvent.click(screen.getByTestId("select-all-checkbox"));

    expect(screen.getByTestId("selected-count")).toHaveTextContent("2");
    expect((screen.getByTestId("select-a") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByTestId("select-b") as HTMLInputElement).checked).toBe(true);
  });

  it("updates the selected count and the indeterminate state of the header checkbox", () => {
    const taskA = makeTask("a", "Task A");
    const taskB = makeTask("b", "Task B");
    renderTable([taskA, taskB]);

    const selectAll = screen.getByTestId("select-all-checkbox") as HTMLInputElement;
    expect(selectAll.indeterminate).toBe(false);

    fireEvent.click(screen.getByTestId("select-a"));

    expect(screen.getByTestId("selected-count")).toHaveTextContent("1");
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.checked).toBe(false);

    fireEvent.click(screen.getByTestId("select-b"));

    expect(screen.getByTestId("selected-count")).toHaveTextContent("2");
    expect(selectAll.indeterminate).toBe(false);
    expect(selectAll.checked).toBe(true);
  });

  it("clears the selection entirely after a full bulk delete success", async () => {
    const taskA = makeTask("a", "Task A");
    const taskB = makeTask("b", "Task B");
    const onBulkDelete = vi.fn().mockResolvedValue(["a", "b"]);
    renderTable([taskA, taskB], { onBulkDelete });

    fireEvent.click(screen.getByTestId("select-all-checkbox"));
    fireEvent.click(screen.getByTestId("bulk-delete-btn"));

    expect(onBulkDelete).toHaveBeenCalledWith(["a", "b"]);
    await waitFor(() => expect(screen.queryByTestId("bulk-actions-bar")).not.toBeInTheDocument());
  });

  it("keeps only the still-visible, still-failed ids selected after a partial bulk delete failure", async () => {
    const taskA = makeTask("a", "Task A");
    const taskB = makeTask("b", "Task B");
    // "a" succeeds, "b" fails and stays visible.
    const onBulkDelete = vi.fn().mockResolvedValue(["a"]);
    renderTable([taskA, taskB], { onBulkDelete });

    fireEvent.click(screen.getByTestId("select-all-checkbox"));
    fireEvent.click(screen.getByTestId("bulk-delete-btn"));

    await waitFor(() => expect(screen.getByTestId("selected-count")).toHaveTextContent("1"));
    expect((screen.getByTestId("select-b") as HTMLInputElement).checked).toBe(true);
  });
});

describe("TaskTable inline status editing", () => {
  it("shows the API error and keeps the previous status when a status change is rejected", async () => {
    const taskA = makeTask("a", "Task A");
    const onUpdate = vi.fn().mockRejectedValue(new Error("Cannot complete task with incomplete dependencies: Dep 1 (todo)"));
    renderTable([taskA], { onUpdate });

    const statusSelect = screen.getByTestId("edit-status-a") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "done" } });

    expect(onUpdate).toHaveBeenCalledWith("a", "status", "done");

    await waitFor(() =>
      expect(screen.getByTestId("error-a-status")).toHaveTextContent(
        "Cannot complete task with incomplete dependencies: Dep 1 (todo)"
      )
    );

    // The task prop never changed (the parent didn't apply the update), so
    // the select still reflects the task's real, previous status.
    expect(statusSelect.value).toBe("todo");
  });

  it("clears a previous status error and allows retrying once the update succeeds", async () => {
    const taskA = makeTask("a", "Task A");
    const onUpdate = vi.fn().mockRejectedValueOnce(new Error("Cannot complete task with incomplete dependencies"));
    onUpdate.mockResolvedValueOnce(undefined);
    renderTable([taskA], { onUpdate });

    const statusSelect = screen.getByTestId("edit-status-a") as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "done" } });
    await waitFor(() => expect(screen.getByTestId("error-a-status")).toBeInTheDocument());

    fireEvent.change(statusSelect, { target: { value: "done" } });
    await waitFor(() => expect(screen.queryByTestId("error-a-status")).not.toBeInTheDocument());

    expect(onUpdate).toHaveBeenCalledTimes(2);
  });
});

describe("TaskTable controlled sorting", () => {
  it("reports the clicked column key via onSortChange instead of sorting internally", () => {
    const taskA = makeTask("a", "Task A");
    const taskB = makeTask("b", "Task B");
    const { onSortChange } = renderTable([taskA, taskB]);

    fireEvent.click(screen.getByTestId("sort-header-priority"));

    expect(onSortChange).toHaveBeenCalledWith("priority");
    // sortKey prop is still "title" (the default), so clicking another
    // header must not reorder rows or move the indicator on its own — the
    // parent owns that decision and would pass new props back down.
    expect(screen.getByTestId("sort-header-priority").closest("th")).toHaveAttribute("aria-sort", "none");
    expect(screen.getByTestId("sort-header-title").closest("th")).toHaveAttribute("aria-sort", "ascending");
  });

  it("renders the sort indicator and aria-sort based on the sortKey/sortDir props", () => {
    renderTable([makeTask("a", "Task A")], { sortKey: "priority", sortDir: "desc" });

    const priorityHeader = screen.getByTestId("sort-header-priority").closest("th");
    expect(priorityHeader).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByTestId("sort-header-title").closest("th")).toHaveAttribute("aria-sort", "none");
  });
});

describe("TaskTable due-date presentation and editing", () => {
  it("shows an Overdue label (status only, no repeated date) next to the due-date cell without disturbing the editable input", () => {
    const overdue: Task = { id: "a", title: "Task A", status: "todo", priority: "medium", dueDate: "2020-01-01T00:00:00Z" };
    renderTable([overdue]);

    const label = screen.getByTestId("due-date-label");
    expect(label).toHaveTextContent("Overdue");
    // The editable input already shows the date, so the label must not
    // repeat it (no "Due:" text alongside "Overdue").
    expect(label.textContent).not.toMatch(/Due:/);

    const input = screen.getByTestId("edit-dueDate-a") as HTMLInputElement;
    expect(input.value).toBe("2020-01-01");
  });

  it("does not add a redundant label for a scheduled (non-overdue, non-soon) dueDate", () => {
    const scheduled: Task = {
      id: "a",
      title: "Task A",
      status: "todo",
      priority: "medium",
      dueDate: "2099-01-01T00:00:00Z"
    };
    renderTable([scheduled]);

    expect(screen.queryByTestId("due-date-label")).not.toBeInTheDocument();
    const input = screen.getByTestId("edit-dueDate-a") as HTMLInputElement;
    expect(input.value).toBe("2099-01-01");
  });

  it("still commits a dueDate edit through onUpdate (no regression)", async () => {
    const taskA = makeTask("a", "Task A");
    const { onUpdate } = renderTable([taskA]);

    const input = screen.getByTestId("edit-dueDate-a") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2030-06-01" } });

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith("a", "dueDate", new Date("2030-06-01").toISOString())
    );
  });

  it("keeps the default title-ascending sort order (no regression)", () => {
    const taskB = makeTask("b", "Bravo");
    const taskA = makeTask("a", "Alpha");
    renderTable([taskB, taskA]);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows.map((r) => r.getAttribute("data-testid"))).toEqual(["task-row-a", "task-row-b"]);
  });
});
