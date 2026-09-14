import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import Users from "./Users";
import { AppErrorProvider } from "../context/AppErrorContext";
import { vi, describe, it, expect, beforeEach, MockInstance } from "vitest";

const mockUsers = [
  { id: "u1", name: "Alice Johnson", email: "alice@example.com", role: "admin" },
  { id: "u2", name: "Bob Smith", email: "bob@example.com", role: "editor" }
];

let fetchSpy: MockInstance;

function renderComponent(initialEntries: { pathname: string; state?: unknown }[] = [{ pathname: "/users" }]) {
  return render(
    <AppErrorProvider>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/users" element={<Users />} />
        </Routes>
      </MemoryRouter>
    </AppErrorProvider>
  );
}

describe("Users list", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
    fetchSpy.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockUsers))));
  });

  it("renders a 'View details' link for each user in both the mobile cards and the desktop table", async () => {
    renderComponent();

    await waitFor(() => expect(screen.getAllByText("Alice Johnson").length).toBeGreaterThan(0));

    const aliceLinks = screen.getAllByRole("link", { name: "View details for Alice Johnson" });
    // One in the mobile card layout, one in the desktop table layout.
    expect(aliceLinks).toHaveLength(2);
    aliceLinks.forEach((link) => expect(link).toHaveAttribute("href", "/users/u1"));

    const bobLinks = screen.getAllByRole("link", { name: "View details for Bob Smith" });
    expect(bobLinks).toHaveLength(2);
    bobLinks.forEach((link) => expect(link).toHaveAttribute("href", "/users/u2"));
  });

  it("shows an Actions column header instead of a fabricated account status", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getAllByText("Alice Johnson").length).toBeGreaterThan(0));

    expect(screen.getByRole("columnheader", { name: "Actions" })).toBeInTheDocument();
    expect(screen.queryByText("Active")).not.toBeInTheDocument();
  });

  it("shows a success message with role=status when navigated here after a deletion", async () => {
    renderComponent([{ pathname: "/users", state: { deletedUserName: "Charlie Davis" } }]);

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Charlie Davis deleted successfully"));
  });

  it("does not show a success message on a normal visit", async () => {
    renderComponent();
    await waitFor(() => expect(screen.getAllByText("Alice Johnson").length).toBeGreaterThan(0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows an accessible loading state before the fetch resolves, with no user rows yet", () => {
    fetchSpy.mockImplementation(() => new Promise(() => {})); // never resolves
    renderComponent();

    expect(screen.getByText("Loading users...")).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "User" })).not.toBeInTheDocument();
  });

  it("shows a genuine empty state only after a successful fetch of an empty list", async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(new Response(JSON.stringify([]))));
    renderComponent();

    await waitFor(() => expect(screen.getByText("No users yet")).toBeInTheDocument());
    expect(screen.queryByText("Loading users...")).not.toBeInTheDocument();
  });

  it("shows a local error with Retry on an HTTP failure, and recovers the list on retry", async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(new Response("Server error", { status: 500 })));
    renderComponent();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Failed to load users"));
    expect(screen.queryByText("No users yet")).not.toBeInTheDocument();

    fetchSpy.mockImplementation(() => Promise.resolve(new Response(JSON.stringify(mockUsers))));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getAllByText("Alice Johnson").length).toBeGreaterThan(0));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a local error with Retry on a network failure", async () => {
    fetchSpy.mockImplementation(() => Promise.reject(new Error("network down")));
    renderComponent();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("network down"));
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("shows a local error on a malformed (non-array) payload", async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ not: "a list" }))));
    renderComponent();

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.queryByText("No users yet")).not.toBeInTheDocument();
  });

  it("does not let a slow retry response overwrite a user created locally while it was in flight", async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(new Response("Server error", { status: 500 })));
    renderComponent();
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    let resolveRetry!: (value: Response) => void;
    fetchSpy.mockImplementation(() => new Promise<Response>((resolve) => (resolveRetry = resolve)));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("Loading users...")).toBeInTheDocument());

    // A new user is created locally while that retry request is still in flight.
    fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") {
        const created = { id: "u-new", name: "Dana Lee", email: "dana@example.com", role: "viewer" };
        return Promise.resolve(new Response(JSON.stringify(created), { status: 201 }));
      }
      return new Promise<Response>((resolve) => (resolveRetry = resolve));
    });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Dana Lee" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /add user/i }));
    await waitFor(() => expect(screen.getAllByText("Dana Lee").length).toBeGreaterThan(0));

    // The retry's stale response (a snapshot from before Dana was created)
    // finally resolves - Dana must still be in the list afterwards.
    resolveRetry(new Response(JSON.stringify(mockUsers)));
    await waitFor(() => expect(screen.getAllByText("Alice Johnson").length).toBeGreaterThan(0));
    expect(screen.getAllByText("Dana Lee").length).toBeGreaterThan(0);
  });

  it("does not update state after unmount when a fetch resolves late", async () => {
    let resolveFetch!: (value: Response) => void;
    fetchSpy.mockImplementation(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));
    const { unmount } = renderComponent();
    unmount();

    expect(() => resolveFetch(new Response(JSON.stringify(mockUsers)))).not.toThrow();
  });

  it("does not resurface the success message after navigating away and returning via back", async () => {
    function OtherPage() {
      const navigate = useNavigate();
      return <button onClick={() => navigate(-1)}>Go back</button>;
    }

    render(
      <AppErrorProvider>
        <MemoryRouter initialEntries={[{ pathname: "/users", state: { deletedUserName: "Charlie Davis" } }]}>
          <Link to="/other">Go to other page</Link>
          <Routes>
            <Route path="/users" element={<Users />} />
            <Route path="/other" element={<OtherPage />} />
          </Routes>
        </MemoryRouter>
      </AppErrorProvider>
    );

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Charlie Davis deleted successfully"));

    fireEvent.click(screen.getByText("Go to other page"));
    await waitFor(() => expect(screen.getByText("Go back")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Go back"));

    await waitFor(() => expect(screen.getAllByText("Alice Johnson").length).toBeGreaterThan(0));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
