import { useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { APPROVERS } from "../utils/approvers";
import { buildTaskWizardPayload } from "../utils/taskWizardPayload";
import type { TaskDraft } from "../utils/taskWizardPayload";
import type { Task, TaskPriority, TaskSeverity, TaskType, User } from "../types";

export type { TaskDraft };

type WizardStep = 1 | 2 | 3;

type Props = {
  users: User[];
  existingTasks: Task[];
  onComplete: (task: TaskDraft) => Promise<void>;
  onClose: () => void;
};

const TITLE_ID = "task-wizard-title";

const STEP_LABELS: Record<WizardStep, string> = {
  1: "Basic information",
  2: "Assignment and details",
  3: "Summary"
};

export function TaskWizard({ users, existingTasks, onComplete, onClose }: Props) {
  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<TaskDraft>({ taskType: "feature", status: "todo" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!draft.title || draft.title.length < 3) {
      newErrors.title = "Title must be at least 3 characters";
    }
    if (!draft.priority) {
      newErrors.priority = "Choose a priority";
    }
    if (!draft.taskType) {
      newErrors.taskType = "Choose a task type";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!draft.assigneeId) {
      newErrors.assigneeId = "You must assign this task";
    }
    if (draft.estimatedHours && draft.estimatedHours < 1) {
      newErrors.estimatedHours = "Minimum 1 hour";
    }
    // Contextual rule: High priority tasks must be estimated at <= 24h.
    if (draft.priority === "high" && draft.estimatedHours && draft.estimatedHours > 24) {
      newErrors.estimatedHours = "High priority tasks cannot exceed 24h";
    }
    // Bugs must have a severity.
    if (draft.taskType === "bug" && !draft.severity) {
      newErrors.severity = "Bugs require a severity level";
    }
    // Research tasks must have an hour estimate.
    if (draft.taskType === "research" && !draft.estimatedHours) {
      newErrors.estimatedHours = "Research tasks require a time estimate";
    }
    if (draft.requiresApproval && !draft.approver) {
      newErrors.approver = "Select an approver";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const nextStep = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step < 3) setStep((s) => (s + 1) as WizardStep);
  };

  const prevStep = () => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  const submit = async () => {
    if (isSubmitting) return;
    if (!validateStep1() || !validateStep2()) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onComplete(buildTaskWizardPayload(draft));
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create the task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepId = `wizard-step-${step}`;
  const errorId = (field: string) => `wizard-error-${field}`;

  return (
    <Dialog open onClose={onClose} titleId={TITLE_ID} initialFocusRef={firstFieldRef} testId="task-wizard">
      {/* Announces step changes to screen reader users without moving focus. */}
      <div aria-live="polite" className="sr-only">
        Step {step} of 3: {STEP_LABELS[step]}
      </div>

      <h2 id={TITLE_ID} className="sr-only">
        Create task — step {step} of 3: {STEP_LABELS[step]}
      </h2>

      {/* Progress Bar */}
      <div className="flex gap-2 mb-6" role="presentation">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded ${s <= step ? "bg-blue-600" : "bg-gray-200"}`}
            data-testid={`progress-step-${s}`}
          />
        ))}
      </div>

      <div id={stepId}>
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold mb-4">Step 1: Basic information</h3>

            <div>
              <label htmlFor="task-type-select" className="block text-sm font-semibold mb-1">
                Task type
              </label>
              <select
                id="task-type-select"
                ref={firstFieldRef}
                data-testid="task-type-select"
                className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={draft.taskType || "feature"}
                onChange={(e) => setDraft({ ...draft, taskType: e.target.value as TaskType })}
                aria-invalid={Boolean(errors.taskType)}
                aria-describedby={errors.taskType ? errorId("taskType") : undefined}
              >
                <option value="feature">Feature</option>
                <option value="bug">Bug</option>
                <option value="research">Research</option>
              </select>
              {errors.taskType && (
                <p id={errorId("taskType")} className="text-red-600 text-sm mt-1" role="alert">
                  {errors.taskType}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="task-title-input" className="block text-sm font-semibold mb-1">
                Task title *
              </label>
              <input
                id="task-title-input"
                data-testid="task-title-input"
                className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={draft.title || ""}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Enter a title..."
                aria-invalid={Boolean(errors.title)}
                aria-describedby={errors.title ? errorId("title") : undefined}
                required
              />
              {errors.title && (
                <p id={errorId("title")} className="text-red-600 text-sm mt-1" role="alert">
                  {errors.title}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="task-description-input" className="block text-sm font-semibold mb-1">
                Description
              </label>
              <textarea
                id="task-description-input"
                data-testid="task-description-input"
                className="w-full border rounded px-3 py-2 h-24 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={draft.description || ""}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Describe the task..."
              />
            </div>

            <div>
              <label htmlFor="task-priority-select" className="block text-sm font-semibold mb-1">
                Priority *
              </label>
              <select
                id="task-priority-select"
                data-testid="task-priority-select"
                className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={draft.priority || ""}
                onChange={(e) => setDraft({ ...draft, priority: e.target.value as TaskPriority })}
                aria-invalid={Boolean(errors.priority)}
                aria-describedby={errors.priority ? errorId("priority") : undefined}
                required
              >
                <option value="">Choose...</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              {errors.priority && (
                <p id={errorId("priority")} className="text-red-600 text-sm mt-1" role="alert">
                  {errors.priority}
                </p>
              )}
            </div>

            {draft.priority === "high" && (
              <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm" data-testid="high-priority-warning" role="status">
                High priority tasks should be completed within 24h
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold mb-4">Step 2: Assignment and details</h3>

            <div>
              <label htmlFor="task-assignee-select" className="block text-sm font-semibold mb-1">
                Assign to *
              </label>
              <select
                id="task-assignee-select"
                data-testid="task-assignee-select"
                className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={draft.assigneeId || ""}
                onChange={(e) => setDraft({ ...draft, assigneeId: e.target.value })}
                aria-invalid={Boolean(errors.assigneeId)}
                aria-describedby={errors.assigneeId ? errorId("assigneeId") : undefined}
                required
              >
                <option value="">Choose a user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              {errors.assigneeId && (
                <p id={errorId("assigneeId")} className="text-red-600 text-sm mt-1" role="alert">
                  {errors.assigneeId}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="task-hours-input" className="block text-sm font-semibold mb-1">
                Estimated time (hours) {draft.taskType === "research" && "*"}
              </label>
              <input
                id="task-hours-input"
                type="number"
                min="1"
                data-testid="task-hours-input"
                className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={draft.estimatedHours || ""}
                onChange={(e) =>
                  setDraft({ ...draft, estimatedHours: e.target.value === "" ? undefined : Number(e.target.value) })
                }
                aria-invalid={Boolean(errors.estimatedHours)}
                aria-describedby={errors.estimatedHours ? errorId("estimatedHours") : undefined}
              />
              {errors.estimatedHours && (
                <p id={errorId("estimatedHours")} className="text-red-600 text-sm mt-1" role="alert">
                  {errors.estimatedHours}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="task-due-date-input" className="block text-sm font-semibold mb-1">
                Due date
              </label>
              <input
                id="task-due-date-input"
                type="date"
                autoComplete="off"
                data-testid="task-due-date-input"
                className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                value={draft.dueDate || ""}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              />
            </div>

            {/* Conditional: severity for Bug */}
            {draft.taskType === "bug" && (
              <div data-testid="severity-field">
                <label htmlFor="task-severity-select" className="block text-sm font-semibold mb-1">
                  Severity *
                </label>
                <select
                  id="task-severity-select"
                  className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  value={draft.severity || ""}
                  onChange={(e) => setDraft({ ...draft, severity: e.target.value as TaskSeverity })}
                  data-testid="task-severity-select"
                  aria-invalid={Boolean(errors.severity)}
                  aria-describedby={errors.severity ? errorId("severity") : undefined}
                  required
                >
                  <option value="">Choose...</option>
                  <option value="critical">Critical</option>
                  <option value="major">Major</option>
                  <option value="minor">Minor</option>
                </select>
                {errors.severity && (
                  <p id={errorId("severity")} className="text-red-600 text-sm mt-1" role="alert">
                    {errors.severity}
                  </p>
                )}
              </div>
            )}

            {/* Checkbox: requires approval */}
            <div>
              <label htmlFor="requires-approval-checkbox" className="flex items-center gap-2">
                <input
                  id="requires-approval-checkbox"
                  type="checkbox"
                  checked={draft.requiresApproval || false}
                  onChange={(e) => setDraft({ ...draft, requiresApproval: e.target.checked })}
                  data-testid="requires-approval-checkbox"
                />
                <span className="text-sm">Requires manager approval</span>
              </label>
            </div>

            {/* Conditional: approver */}
            {draft.requiresApproval && (
              <div data-testid="approver-field">
                <label htmlFor="task-approver-select" className="block text-sm font-semibold mb-1">
                  Approver *
                </label>
                <select
                  id="task-approver-select"
                  className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                  value={draft.approver || ""}
                  onChange={(e) => setDraft({ ...draft, approver: e.target.value })}
                  data-testid="task-approver-select"
                  aria-invalid={Boolean(errors.approver)}
                  aria-describedby={errors.approver ? errorId("approver") : undefined}
                  required
                >
                  <option value="">Choose...</option>
                  {Object.entries(APPROVERS).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                {errors.approver && (
                  <p id={errorId("approver")} className="text-red-600 text-sm mt-1" role="alert">
                    {errors.approver}
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="task-tags-input" className="block text-sm font-semibold mb-1">
                Tags (comma separated)
              </label>
              <input
                id="task-tags-input"
                className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                placeholder="backend, urgent, api"
                value={draft.tags?.join(", ") || ""}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
                data-testid="task-tags-input"
              />
            </div>

            <div>
              <label htmlFor="task-dependencies-input" className="block text-sm font-semibold mb-1">
                Dependencies (IDs of other tasks)
              </label>
              <input
                id="task-dependencies-input"
                className="w-full border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                placeholder="task-123, task-456"
                value={draft.dependencies?.join(", ") || ""}
                onChange={(e) =>
                  setDraft({ ...draft, dependencies: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })
                }
                data-testid="task-dependencies-input"
              />
              <p className="text-xs text-gray-600 mt-1">
                Available tasks: {existingTasks.map((t) => t.id).join(", ") || "none"}
              </p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-2xl font-bold mb-4">Step 3: Summary</h3>

            <div className="bg-gray-50 rounded p-4 space-y-3" data-testid="wizard-summary">
              <div>
                <span className="font-semibold">Type:</span> <span className="text-gray-700">{draft.taskType}</span>
              </div>
              <div>
                <span className="font-semibold">Title:</span> <span className="text-gray-700">{draft.title}</span>
              </div>
              <div>
                <span className="font-semibold">Priority:</span> <span className="text-gray-700">{draft.priority}</span>
              </div>
              <div>
                <span className="font-semibold">Assigned to:</span>{" "}
                <span className="text-gray-700">{users.find((u) => u.id === draft.assigneeId)?.name || "—"}</span>
              </div>
              <div>
                <span className="font-semibold">Estimated time:</span>{" "}
                <span className="text-gray-700">{draft.estimatedHours || "—"}h</span>
              </div>
              <div>
                <span className="font-semibold">Due date:</span> <span className="text-gray-700">{draft.dueDate || "—"}</span>
              </div>
              {draft.taskType === "bug" && (
                <div>
                  <span className="font-semibold">Severity:</span> <span className="text-gray-700">{draft.severity}</span>
                </div>
              )}
                {draft.requiresApproval && (
                  <div>
                    <span className="font-semibold">Approver:</span> <span className="text-gray-700">{draft.approver ? (APPROVERS[draft.approver] ? `${APPROVERS[draft.approver]} (${draft.approver})` : draft.approver) : "—"}</span>
                  </div>
                )}
              {draft.tags && draft.tags.length > 0 && (
                <div>
                  <span className="font-semibold">Tags:</span> <span className="text-gray-700">{draft.tags.join(", ")}</span>
                </div>
              )}
              {draft.dependencies && draft.dependencies.length > 0 && (
                <div>
                  <span className="font-semibold">Dependencies:</span>{" "}
                  <span className="text-gray-700">{draft.dependencies.join(", ")}</span>
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-300 rounded p-3 text-sm">
              Double-check the data before saving. Some fields cannot be edited after the task is created.
            </div>

            {submitError && (
              <div className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700" data-testid="wizard-submit-error" role="alert">
                {submitError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6 pt-4 border-t">
        <button
          type="button"
          onClick={prevStep}
          disabled={step === 1 || isSubmitting}
          className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          data-testid="wizard-prev-btn"
        >
          ← Back
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={isSubmitting}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          data-testid="wizard-cancel-btn"
        >
          Cancel
        </button>

        {step < 3 ? (
          <button
            type="button"
            onClick={nextStep}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
            data-testid="wizard-next-btn"
          >
            Next →
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={isSubmitting}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-800"
            data-testid="wizard-submit-btn"
          >
            {isSubmitting ? "Saving…" : "Create task"}
          </button>
        )}
      </div>
    </Dialog>
  );
}
