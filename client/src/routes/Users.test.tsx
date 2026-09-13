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
