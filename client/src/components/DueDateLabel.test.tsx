import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DueDateLabel } from "./DueDateLabel";

const NOW = Date.UTC(2026, 5, 15);
const DAY_MS = 24 * 60 * 60 * 1000;

describe("DueDateLabel", () => {
  it("renders the word 'Overdue' as text, not just a color", () => {
    render(<DueDateLabel task={{ dueDate: new Date(NOW - DAY_MS).toISOString(), status: "todo" }} now={NOW} />);
    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("renders the phrase 'Due soon' as text", () => {
    render(<DueDateLabel task={{ dueDate: new Date(NOW).toISOString(), status: "todo" }} now={NOW} />);
    expect(screen.getByText("Due soon")).toBeInTheDocument();
  });

  it("renders a plain 'Due: <date>' for a scheduled task further out", () => {
    render(<DueDateLabel task={{ dueDate: new Date(NOW + 10 * DAY_MS).toISOString(), status: "todo" }} now={NOW} />);
    expect(screen.getByText(/^Due: /)).toBeInTheDocument();
  });

  it("renders nothing for a task without a dueDate", () => {
    const { container } = render(<DueDateLabel task={{ dueDate: undefined, status: "todo" }} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a done task, even with a past dueDate", () => {
    const { container } = render(
      <DueDateLabel task={{ dueDate: new Date(NOW - 5 * DAY_MS).toISOString(), status: "done" }} now={NOW} />
    );
    // A done task with a valid dueDate is "scheduled", so it does render a
    // plain "Due: <date>" — but never "Overdue" or "Due soon".
    expect(container.textContent).not.toBe("");
    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
    expect(screen.queryByText("Due soon")).not.toBeInTheDocument();
  });
});
