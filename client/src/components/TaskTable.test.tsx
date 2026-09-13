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
  const utils = render(
    <AppErrorProvider>
      <MemoryRouter>
        <TaskTable
          tasks={tasks}
          users={[]}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onBulkDelete={onBulkDelete}
          {...overrides}
        />
      </MemoryRouter>
    </AppErrorProvider>
  );
  return { ...utils, onUpdate, onDelete, onBulkDelete };
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
          <TaskTable tasks={[taskA]} users={[]} onUpdate={vi.fn()} onDelete={vi.fn()} onBulkDelete={onBulkDelete} />
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
          <TaskTable tasks={[taskB]} users={[]} onUpdate={vi.fn()} onDelete={vi.fn()} onBulkDelete={onBulkDelete} />
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
