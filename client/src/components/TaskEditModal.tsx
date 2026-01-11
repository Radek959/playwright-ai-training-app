import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLab } from "../context/LabContext";

type Task = {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  assigneeId?: string;
};

type User = { id: string; name: string };

type Props = {
  task: Task | null;
  open: boolean;
  users: User[];
  onClose: () => void;
  onSave: (updated: Partial<Task>) => Promise<void> | void;
};

export function TaskEditModal({ task, open, users, onClose, onSave }: Props) {
  const { a11y } = useLab();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shadowRoot = useRef<ShadowRoot | null>(null);
  const [ready, setReady] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<Task["status"]>("todo");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  useEffect(() => {
    if (!hostRef.current) {
      const host = document.createElement("div");
      host.setAttribute("data-lab-modal-host", "true");
      hostRef.current = host;
      document.body.appendChild(host);
      shadowRoot.current = host.attachShadow({ mode: "open" });
      setReady(true);
    }
    return () => {
      if (hostRef.current) {
        hostRef.current.remove();
      }
      hostRef.current = null;
      shadowRoot.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.dueDate ? task.dueDate.split("T")[0] : "");
      setAssigneeId(task.assigneeId ?? "");
    }
  }, [task]);

  const content = useMemo(() => {
    if (!open || !shadowRoot.current || !task || !ready) return null;
    const overlayStyle = {
      position: "fixed" as const,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      background: "rgba(15,23,42,0.45)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    };
    const cardStyle = {
      background: "#fff",
      borderRadius: "12px",
      padding: "20px",
      width: "min(720px, 92vw)",
      boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
      border: "1px solid #e2e8f0"
    };
    const deepWrap = (node: JSX.Element) => (
      <div data-layer="1">
        <div data-layer="2">
          <div data-layer="3">{node}</div>
        </div>
      </div>
    );

    const ButtonTag: any = a11y ? "span" : "button";

    return createPortal(
      <div style={{}}>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
          h1, h2, h3, label, span, button, input, select, textarea { color: #0f172a; }
          .lab-modal-title { font-size: 26px; font-weight: 800; margin-bottom: 8px; }
          .lab-subgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
          .lab-input { width: 100%; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 14px; transition: border 120ms ease, box-shadow 120ms ease; background: #fff; }
          .lab-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15); }
          .lab-label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 4px; color: #334155; }
          .lab-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
          .lab-btn { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px 14px; font-size: 14px; cursor: pointer; transition: all 140ms ease; }
          .lab-btn.secondary { background: #fff; color: #0f172a; }
          .lab-btn.secondary:hover { background: #f1f5f9; }
          .lab-btn.primary { background: #2563eb; color: #fff; border-color: #2563eb; }
          .lab-btn.primary:hover { background: #1d4ed8; }
          .lab-close { color: #64748b; font-size: 14px; }
          .lab-close:hover { color: #0f172a; }
        `}</style>
        <div style={{ position: "relative" }}>
          <div style={{}}>
            {deepWrap(
              <div style={{}}>
                <div style={{}}>
                  <div style={{}}>
                    <div style={{}}>
                      <div style={overlayStyle}>
                        <div style={cardStyle}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <h2 className="lab-modal-title">Edytuj zadanie</h2>
                            </div>
                            <div className="lab-subgrid">
                              <label>
                                <span className="lab-label">Tytuł</span>
                                <input
                                  className="lab-input"
                                  value={title}
                                  onChange={(e) => setTitle(e.target.value)}
                                />
                              </label>
                              <label>
                                <span className="lab-label">Priorytet</span>
                                <select
                                  className="lab-input"
                                  value={priority}
                                  onChange={(e) => setPriority(e.target.value as Task["priority"])}
                                >
                                  <option value="low">Low</option>
                                  <option value="medium">Medium</option>
                                  <option value="high">High</option>
                                </select>
                              </label>
                            </div>

                            <label>
                              <span className="lab-label">Opis</span>
                              <textarea
                                className="lab-input"
                                rows={3}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                              />
                            </label>

                            <div className="lab-subgrid">
                              <label>
                                <span className="lab-label">Status</span>
                                <select
                                  className="lab-input"
                                  value={status}
                                  onChange={(e) => setStatus(e.target.value as Task["status"])}
                                >
                                  <option value="todo">To Do</option>
                                  <option value="in-progress">In Progress</option>
                                  <option value="done">Done</option>
                                </select>
                              </label>
                              <label>
                                <span className="lab-label">Due date</span>
                                <input
                                  type="date"
                                  className="lab-input"
                                  value={dueDate}
                                  onChange={(e) => setDueDate(e.target.value)}
                                />
                              </label>
                              <label>
                                <span className="lab-label">Assignee</span>
                                <select
                                  className="lab-input"
                                  value={assigneeId}
                                  onChange={(e) => setAssigneeId(e.target.value)}
                                >
                                  <option value="">-- brak --</option>
                                  {users.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>

                            <div className="lab-actions">
                              <ButtonTag
                                onClick={onClose}
                                role={a11y ? "button" : undefined}
                                className={a11y ? "text-sm underline cursor-pointer" : "lab-btn secondary"}
                              >
                                Anuluj
                              </ButtonTag>
                              <ButtonTag
                                onClick={() => onSave({
                                  title,
                                  description,
                                  status,
                                  priority,
                                  dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
                                  assigneeId
                                })}
                                role={a11y ? "button" : undefined}
                                className={a11y ? "text-sm underline cursor-pointer" : "lab-btn primary"}
                              >
                                Zapisz
                              </ButtonTag>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>,
      shadowRoot.current
    );
  }, [open, task, a11y, ready, title, description, status, priority, dueDate, assigneeId, users, onClose, onSave]);

  return content;
}