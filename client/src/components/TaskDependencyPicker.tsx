import { useState } from "react";
import type { Task } from "../types";

type Props = {
  /** Prefix for the generated element ids/testids, e.g. "wizard" or "edit-task". */
  idPrefix: string;
  /** The tasks that may be referenced. */
  tasks: Task[];
  value: string[];
  onChange: (next: string[]) => void;
  /** The task being edited — it can never depend on itself. */
  excludeTaskId?: string;
  error?: string;
};

/**
 * Picks dependencies from the existing task list instead of asking the user to
 * type raw ids. Selecting is a labelled <select> plus an explicit "Add" button
 * (rather than adding on change) so keyboard users arrowing through the list
 * don't add every option they pass over; each selected dependency has its own
 * Remove button. The task itself and already-selected tasks are filtered out
 * of the options, so a self-reference or a duplicate cannot be produced.
 */
export function TaskDependencyPicker({ idPrefix, tasks, value, onChange, excludeTaskId, error }: Props) {
  const [pending, setPending] = useState("");

  const selectId = `${idPrefix}-dependency-select`;
  const errorId = `${idPrefix}-dependency-error`;
  const emptyId = `${idPrefix}-dependency-empty`;

  const selectable = tasks.filter((t) => t.id !== excludeTaskId && !value.includes(t.id));

  const titleOf = (id: string) => tasks.find((t) => t.id === id)?.title;

  const add = () => {
    if (!pending) return;
    if (pending === excludeTaskId) return;
    if (value.includes(pending)) return;
    onChange([...value, pending]);
    setPending("");
  };

  const remove = (id: string) => {
    onChange(value.filter((depId) => depId !== id));
  };

  return (
    <fieldset className="border border-gray-200 rounded p-3" data-testid={`${idPrefix}-dependencies`}>
      <legend className="text-sm font-semibold px-1">Dependencies</legend>

      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <label htmlFor={selectId} className="block text-sm font-medium mb-1">
            Add dependency
          </label>
          <select
            id={selectId}
            data-testid={selectId}
            className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            disabled={selectable.length === 0}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
          >
            <option value="">
              {selectable.length === 0 ? "No tasks available" : "Choose a task..."}
            </option>
            {selectable.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.id})
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={add}
          disabled={!pending}
          data-testid={`${idPrefix}-dependency-add`}
          className="px-4 py-2 border rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
        >
          Add
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className="text-red-600 text-sm mt-1">
          {error}
        </p>
      )}

      {value.length === 0 ? (
        <p id={emptyId} className="text-sm text-gray-600 mt-3">
          No dependencies selected
        </p>
      ) : (
        <ul className="mt-3 space-y-2" data-testid={`${idPrefix}-dependency-list`}>
          {value.map((id) => {
            const title = titleOf(id);
            return (
              <li
                key={id}
                data-testid={`${idPrefix}-dependency-${id}`}
                className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-100 rounded px-3 py-2"
              >
                <span className="text-sm">
                  <span className="font-medium text-gray-900">{title ?? id}</span>{" "}
                  <span className="text-gray-500 font-mono">({id})</span>
                </span>
                <button
                  type="button"
                  onClick={() => remove(id)}
                  aria-label={`Remove dependency ${title ?? id}`}
                  className="text-sm text-red-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded px-1"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
