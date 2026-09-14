import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DueDateLabel } from "./DueDateLabel";

const NOW = Date.UTC(2026, 5, 15);
const DAY_MS = 24 * 60 * 60 * 1000;

// Mirrors formatDueDateUtc's own formatting call, so the expectation tracks
// the runtime's locale (e.g. CI) instead of hardcoding an en-US string.
function utcDisplay(ms: number): string {
  return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC" }).format(
    new Date(ms)
  );
}

describe("DueDateLabel", () => {
  it("shows 'Overdue' together with the exact due date", () => {
    render(<DueDateLabel task={{ dueDate: new Date(NOW - DAY_MS).toISOString(), status: "todo" }} now={NOW} />);
    const label = screen.getByTestId("due-date-label");
    expect(label).toHaveAttribute("data-due-status", "overdue");
    expect(label).toHaveTextContent(`Overdue · Due: ${utcDisplay(NOW - DAY_MS)}`);
  });

  it("shows 'Due soon' together with the exact due date", () => {
    render(<DueDateLabel task={{ dueDate: new Date(NOW).toISOString(), status: "todo" }} now={NOW} />);
    const label = screen.getByTestId("due-date-label");
    expect(label).toHaveAttribute("data-due-status", "soon");
    expect(label).toHaveTextContent(`Due soon · Due: ${utcDisplay(NOW)}`);
  });

  it("renders a plain 'Due: <date>' for a scheduled task further out", () => {
    render(<DueDateLabel task={{ dueDate: new Date(NOW + 10 * DAY_MS).toISOString(), status: "todo" }} now={NOW} />);
    const label = screen.getByTestId("due-date-label");
    expect(label).toHaveAttribute("data-due-status", "scheduled");
    expect(label).toHaveTextContent(`Due: ${utcDisplay(NOW + 10 * DAY_MS)}`);
  });

  it("renders nothing for a task without a dueDate", () => {
    const { container } = render(<DueDateLabel task={{ dueDate: undefined, status: "todo" }} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a plain due date for a done task with a past dueDate, without an overdue/soon warning", () => {
    render(<DueDateLabel task={{ dueDate: new Date(NOW - 5 * DAY_MS).toISOString(), status: "done" }} now={NOW} />);
    // A done task with a valid dueDate is "scheduled" — no warning, but the
    // date itself is still shown.
    const label = screen.getByTestId("due-date-label");
    expect(label).toHaveAttribute("data-due-status", "scheduled");
    expect(label).toHaveTextContent(`Due: ${utcDisplay(NOW - 5 * DAY_MS)}`);
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Due soon/)).not.toBeInTheDocument();
  });

  describe("showDate={false} (used where the exact date is already shown elsewhere)", () => {
    it("shows only the status text for an overdue task, with no date", () => {
      render(<DueDateLabel task={{ dueDate: new Date(NOW - DAY_MS).toISOString(), status: "todo" }} now={NOW} showDate={false} />);
      const label = screen.getByTestId("due-date-label");
      expect(label).toHaveTextContent("Overdue");
      expect(label.textContent).not.toMatch(/Due:/);
    });

    it("shows only the status text for a due-soon task, with no date", () => {
      render(<DueDateLabel task={{ dueDate: new Date(NOW).toISOString(), status: "todo" }} now={NOW} showDate={false} />);
      const label = screen.getByTestId("due-date-label");
      expect(label).toHaveTextContent("Due soon");
      expect(label.textContent).not.toMatch(/Due:/);
    });

    it("renders nothing at all for a scheduled task, to avoid duplicating a date shown elsewhere", () => {
      const { container } = render(
        <DueDateLabel task={{ dueDate: new Date(NOW + 10 * DAY_MS).toISOString(), status: "todo" }} now={NOW} showDate={false} />
      );
      expect(container).toBeEmptyDOMElement();
    });
  });

  it("formats the UTC calendar day consistently regardless of an invalid dueDate", () => {
    const { container } = render(<DueDateLabel task={{ dueDate: "not-a-date", status: "todo" }} now={NOW} />);
    expect(container).toBeEmptyDOMElement();
  });
});
