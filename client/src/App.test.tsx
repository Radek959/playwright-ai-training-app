import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, MockInstance } from "vitest";
import App from "./App";
import { AppErrorProvider } from "./context/AppErrorContext";

let fetchSpy: MockInstance;

function renderApp(initialEntries: string[]) {
  return render(
    <AppErrorProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <App />
      </MemoryRouter>
    </AppErrorProvider>
  );
}

describe("App routing - unknown routes", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]))));
  });

  it("shows an accessible 'Page not found' screen for an unknown route, with links to Dashboard and Tasks", async () => {
    renderApp(["/this-page-does-not-exist"]);

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText(/does not exist/)).toBeInTheDocument();

    const dashboardLink = screen.getByRole("link", { name: "Go to Dashboard" });
    expect(dashboardLink).toHaveAttribute("href", "/");
    const tasksLink = screen.getByRole("link", { name: "Go to Tasks" });
    expect(tasksLink).toHaveAttribute("href", "/tasks");
  });

  it("keeps the app layout and navigation around the 404 screen", async () => {
    renderApp(["/nope"]);

    await screen.findByRole("heading", { name: "Page not found" });
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });

  it("does not show the 404 screen for a known route", async () => {
    renderApp(["/tasks"]);

    await screen.findByTestId("tab-content-active");
    expect(screen.queryByRole("heading", { name: "Page not found" })).not.toBeInTheDocument();
  });
});
