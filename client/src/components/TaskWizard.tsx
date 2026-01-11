import { useState } from "react";
import { useLab } from "../context/LabContext";
import { getTestId } from "../utils/testIds";

type WizardStep = 1 | 2 | 3;

type TaskDraft = {
  title?: string;
  description?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  assignedTo?: string;
  estimatedHours?: number;
  tags?: string[];
  dependencies?: string[];
  taskType?: "bug" | "feature" | "research";
  severity?: string;
  requiresApproval?: boolean;
  approver?: string;
};

type User = { id: string; name: string };

type Props = {
  users: User[];
  existingTasks: any[];
  onComplete: (task: TaskDraft) => void;
  onClose: () => void;
};

export function TaskWizard({ users, existingTasks, onComplete, onClose }: Props) {
  const [step, setStep] = useState<WizardStep>(1);
  const [draft, setDraft] = useState<TaskDraft>({ taskType: "feature", status: "todo" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { refactorSelectors } = useLab();

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    if (!draft.title || draft.title.length < 3) {
      newErrors.title = "Tytuł musi mieć min. 3 znaki";
    }
    if (!draft.priority) {
      newErrors.priority = "Wybierz priorytet";
    }
    if (!draft.taskType) {
      newErrors.taskType = "Wybierz typ zadania";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};
    if (!draft.assignedTo) {
      newErrors.assignedTo = "Musisz przypisać zadanie";
    }
    if (draft.estimatedHours && draft.estimatedHours < 1) {
      newErrors.estimatedHours = "Minimum 1 godzina";
    }
    // Walidacja kontekstowa: High priority wymaga <= 24h
    if (draft.priority === "high" && draft.estimatedHours && draft.estimatedHours > 24) {
      newErrors.estimatedHours = "Zadania High nie mogą przekraczać 24h";
    }
    // Bug musi mieć severity
    if (draft.taskType === "bug" && !draft.severity) {
      newErrors.severity = "Bug wymaga poziomu severity";
    }
    // Research musi mieć estimatedHours
    if (draft.taskType === "research" && !draft.estimatedHours) {
      newErrors.estimatedHours = "Research wymaga szacunku czasu";
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

  const submit = () => {
    onComplete(draft);
    onClose();
  };

  const stepId = refactorSelectors ? `wizard-step-${step}-v2` : `wizard-step-${step}`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid={getTestId("task-wizard-overlay")}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        {/* Progress Bar */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded ${
                s <= step ? "bg-blue-600" : "bg-gray-200"
              }`}
              data-testid={getTestId(`progress-step-${s}`)}
            />
          ))}
        </div>

        <div id={stepId}>
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">Krok 1: Podstawowe informacje</h2>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Typ zadania</label>
                <select
                  data-testid={getTestId("task-type-select")}
                  className="w-full border rounded px-3 py-2"
                  value={draft.taskType || "feature"}
                  onChange={(e) => setDraft({ ...draft, taskType: e.target.value as any })}
                >
                  <option value="feature">Feature</option>
                  <option value="bug">Bug</option>
                  <option value="research">Research</option>
                </select>
                {errors.taskType && <p className="text-red-600 text-sm mt-1">{errors.taskType}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Tytuł zadania *</label>
                <input
                  data-testid={getTestId("task-title-input")}
                  className="w-full border rounded px-3 py-2"
                  value={draft.title || ""}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="Wpisz tytuł..."
                />
                {errors.title && <p className="text-red-600 text-sm mt-1">{errors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Opis</label>
                <textarea
                  data-testid={getTestId("task-description-input")}
                  className="w-full border rounded px-3 py-2 h-24"
                  value={draft.description || ""}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  placeholder="Opisz zadanie..."
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Priorytet *</label>
                <select
                  data-testid={getTestId("task-priority-select")}
                  className="w-full border rounded px-3 py-2"
                  value={draft.priority || ""}
                  onChange={(e) => setDraft({ ...draft, priority: e.target.value })}
                >
                  <option value="">Wybierz...</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                {errors.priority && <p className="text-red-600 text-sm mt-1">{errors.priority}</p>}
              </div>

              {draft.priority === "high" && (
                <div className="bg-yellow-50 border border-yellow-300 rounded p-3 text-sm" data-testid={getTestId("high-priority-warning")}>
                  ⚠️ Zadania High priority powinny być ukończone w ciągu 24h
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">Krok 2: Przypisanie i szczegóły</h2>
              
              <div>
                <label className="block text-sm font-semibold mb-1">Przypisz do *</label>
                <select
                  data-testid={getTestId("task-assignee-select")}
                  className="w-full border rounded px-3 py-2"
                  value={draft.assignedTo || ""}
                  onChange={(e) => setDraft({ ...draft, assignedTo: e.target.value })}
                >
                  <option value="">Wybierz użytkownika...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                {errors.assignedTo && <p className="text-red-600 text-sm mt-1">{errors.assignedTo}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  Szacowany czas (godziny) {draft.taskType === "research" && "*"}
                </label>
                <input
                  type="number"
                  min="1"
                  data-testid={getTestId("task-hours-input")}
                  className="w-full border rounded px-3 py-2"
                  value={draft.estimatedHours || ""}
                  onChange={(e) => setDraft({ ...draft, estimatedHours: Number(e.target.value) })}
                />
                {errors.estimatedHours && <p className="text-red-600 text-sm mt-1">{errors.estimatedHours}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Data końcowa</label>
                <input
                  type="date"
                  data-testid={getTestId("task-due-date-input")}
                  className="w-full border rounded px-3 py-2"
                  value={draft.dueDate || ""}
                  onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
                />
              </div>

              {/* Conditional: Severity dla Bug */}
              {draft.taskType === "bug" && (
                <div data-testid={getTestId("severity-field")}>
                  <label className="block text-sm font-semibold mb-1">Severity *</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={draft.severity || ""}
                    onChange={(e) => setDraft({ ...draft, severity: e.target.value })}
                    data-testid={getTestId("task-severity-select")}
                  >
                    <option value="">Wybierz...</option>
                    <option value="critical">Critical</option>
                    <option value="major">Major</option>
                    <option value="minor">Minor</option>
                  </select>
                  {errors.severity && <p className="text-red-600 text-sm mt-1">{errors.severity}</p>}
                </div>
              )}

              {/* Checkbox: Wymaga zatwierdzenia */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.requiresApproval || false}
                    onChange={(e) => setDraft({ ...draft, requiresApproval: e.target.checked })}
                    data-testid={getTestId("requires-approval-checkbox")}
                  />
                  <span className="text-sm">Wymaga zatwierdzenia managera</span>
                </label>
              </div>

              {/* Conditional: Approver */}
              {draft.requiresApproval && (
                <div data-testid={getTestId("approver-field")}>
                  <label className="block text-sm font-semibold mb-1">Zatwierdzający</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={draft.approver || ""}
                    onChange={(e) => setDraft({ ...draft, approver: e.target.value })}
                    data-testid={getTestId("task-approver-select")}
                  >
                    <option value="">Wybierz...</option>
                    <option value="manager-a">Manager A</option>
                    <option value="manager-b">Manager B</option>
                    <option value="manager-c">Manager C</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold mb-1">Tagi (oddziel przecinkami)</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="backend, urgent, api"
                  value={draft.tags?.join(", ") || ""}
                  onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
                  data-testid={getTestId("task-tags-input")}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">Zależności (IDs innych zadań)</label>
                <input
                  className="w-full border rounded px-3 py-2"
                  placeholder="task-123, task-456"
                  value={draft.dependencies?.join(", ") || ""}
                  onChange={(e) => setDraft({ ...draft, dependencies: e.target.value.split(",").map(t => t.trim()).filter(Boolean) })}
                  data-testid={getTestId("task-dependencies-input")}
                />
                <p className="text-xs text-gray-600 mt-1">
                  Dostępne zadania: {existingTasks.map(t => t.id).join(", ") || "brak"}
                </p>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">Krok 3: Podsumowanie</h2>
              
              <div className="bg-gray-50 rounded p-4 space-y-3" data-testid={getTestId("wizard-summary")}>
                <div>
                  <span className="font-semibold">Typ:</span>{" "}
                  <span className="text-gray-700">{draft.taskType}</span>
                </div>
                <div>
                  <span className="font-semibold">Tytuł:</span>{" "}
                  <span className="text-gray-700">{draft.title}</span>
                </div>
                <div>
                  <span className="font-semibold">Priorytet:</span>{" "}
                  <span className="text-gray-700">{draft.priority}</span>
                </div>
                <div>
                  <span className="font-semibold">Przypisane do:</span>{" "}
                  <span className="text-gray-700">
                    {users.find(u => u.id === draft.assignedTo)?.name || "—"}
                  </span>
                </div>
                <div>
                  <span className="font-semibold">Szacowany czas:</span>{" "}
                  <span className="text-gray-700">{draft.estimatedHours || "—"}h</span>
                </div>
                <div>
                  <span className="font-semibold">Termin:</span>{" "}
                  <span className="text-gray-700">{draft.dueDate || "—"}</span>
                </div>
                {draft.taskType === "bug" && (
                  <div>
                    <span className="font-semibold">Severity:</span>{" "}
                    <span className="text-gray-700">{draft.severity}</span>
                  </div>
                )}
                {draft.requiresApproval && (
                  <div>
                    <span className="font-semibold">Zatwierdzający:</span>{" "}
                    <span className="text-gray-700">{draft.approver || "—"}</span>
                  </div>
                )}
                {draft.tags && draft.tags.length > 0 && (
                  <div>
                    <span className="font-semibold">Tagi:</span>{" "}
                    <span className="text-gray-700">{draft.tags.join(", ")}</span>
                  </div>
                )}
                {draft.dependencies && draft.dependencies.length > 0 && (
                  <div>
                    <span className="font-semibold">Zależności:</span>{" "}
                    <span className="text-gray-700">{draft.dependencies.join(", ")}</span>
                  </div>
                )}
              </div>

              <div className="bg-blue-50 border border-blue-300 rounded p-3 text-sm">
                💡 Sprawdź poprawność danych przed zapisaniem. Po utworzeniu zadania niektóre pola będą niemożliwe do edycji.
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t">
          <button
            type="button"
            onClick={prevStep}
            disabled={step === 1}
            className="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid={getTestId("wizard-prev-btn")}
          >
            ← Wstecz
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
            data-testid={getTestId("wizard-cancel-btn")}
          >
            Anuluj
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={nextStep}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              data-testid={getTestId("wizard-next-btn")}
            >
              Dalej →
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              data-testid={getTestId("wizard-submit-btn")}
            >
              ✓ Utwórz zadanie
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
