import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, MockInstance } from "vitest";
import { CommentsSection } from "./CommentsSection";
import type { Comment, User } from "../types";

const mockUsers: User[] = [
  { id: "u1", name: "Alice Johnson", email: "alice@example.com", role: "admin" },
  { id: "u2", name: "Bob Smith", email: "bob@example.com", role: "editor" }
];

const mockComments: Comment[] = [
  { id: "c1", taskId: "task-1", content: "First comment", authorId: "u1", authorName: "Alice Johnson", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "c2", taskId: "task-1", content: "Second comment", authorName: "Former Team Member", createdAt: "2026-01-02T00:00:00.000Z" }
];

let fetchSpy: MockInstance;

function mockDefault(overrides: { commentsResponse?: () => Response; usersResponse?: () => Response } = {}) {
  fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
    const url = input.toString();
    if (init?.method === "POST" && url === "/api/tasks/task-1/comments") {
      return Promise.resolve(new Response(JSON.stringify({ ...JSON.parse(String(init.body)), id: "new-id", taskId: "task-1", authorName: "Alice Johnson", createdAt: "2026-01-03T00:00:00.000Z" }), { status: 201 }));
    }
    if (url === "/api/tasks/task-1/comments") {
      return Promise.resolve(overrides.commentsResponse?.() ?? new Response(JSON.stringify(mockComments)));
    }
    if (url === "/api/users") {
      return Promise.resolve(overrides.usersResponse?.() ?? new Response(JSON.stringify(mockUsers)));
    }
    return Promise.resolve(new Response(null, { status: 404 }));
  });
}

describe("CommentsSection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  it("shows a loading state before comments arrive", async () => {
    mockDefault();
    render(<CommentsSection taskId="task-1" />);
    expect(screen.getByTestId("comments-loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("comments-list")).toBeInTheDocument());
  });

  it("shows 'No comments yet' for an empty list", async () => {
    mockDefault({ commentsResponse: () => new Response(JSON.stringify([])) });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-empty")).toHaveTextContent("No comments yet"));
  });

  it("displays comments with author, timestamp and plain-text content", async () => {
    mockDefault();
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comment-c1")).toBeInTheDocument());
    expect(screen.getByTestId("comment-c1")).toHaveTextContent("Alice Johnson");
    expect(screen.getByTestId("comment-c1")).toHaveTextContent("First comment");
  });

  it("marks a comment with no authorId as 'Deleted user' while keeping its authorName", async () => {
    mockDefault();
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comment-c2")).toBeInTheDocument());
    expect(screen.getByTestId("comment-deleted-user-c2")).toHaveTextContent("Deleted user");
    expect(screen.getByTestId("comment-c2")).toHaveTextContent("Former Team Member");
    // The other (still-authored) comment must not carry the badge.
    expect(screen.queryByTestId("comment-deleted-user-c1")).not.toBeInTheDocument();
  });

  it("renders content as plain text, never as HTML", async () => {
    mockDefault({
      commentsResponse: () =>
        new Response(
          JSON.stringify([
            { id: "c-html", taskId: "task-1", content: "<b>bold</b>", authorId: "u1", authorName: "Alice Johnson", createdAt: "2026-01-01T00:00:00.000Z" }
          ])
        )
    });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comment-c-html")).toBeInTheDocument());
    expect(screen.getByTestId("comment-c-html").querySelector("b")).toBeNull();
    expect(screen.getByTestId("comment-c-html")).toHaveTextContent("<b>bold</b>");
  });

  it("submits the selected author and typed content, and appends the API's response", async () => {
    mockDefault({ commentsResponse: () => new Response(JSON.stringify([])) });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-empty")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("comment-author-select"), { target: { value: "u1" } });
    fireEvent.change(screen.getByTestId("comment-content-input"), { target: { value: "New comment" } });
    fireEvent.click(screen.getByTestId("add-comment-btn"));

    await waitFor(() => expect(screen.getByTestId("comment-new-id")).toBeInTheDocument());
    expect(screen.getByTestId("comment-new-id")).toHaveTextContent("New comment");

    const postCall = fetchSpy.mock.calls.find(
      (call) => call[0] === "/api/tasks/task-1/comments" && (call[1] as RequestInit)?.method === "POST"
    );
    expect(postCall).toBeDefined();
    expect(JSON.parse(String((postCall![1] as RequestInit).body))).toEqual({ authorId: "u1", content: "New comment" });
  });

  it("disables the select, textarea and button while submitting, showing 'Adding…'", async () => {
    let resolvePost!: (value: Response) => void;
    fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (init?.method === "POST") {
        return new Promise<Response>((resolve) => {
          resolvePost = resolve;
        });
      }
      if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-empty")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("comment-author-select"), { target: { value: "u1" } });
    fireEvent.change(screen.getByTestId("comment-content-input"), { target: { value: "New comment" } });
    fireEvent.click(screen.getByTestId("add-comment-btn"));

    await waitFor(() => expect(screen.getByTestId("add-comment-btn")).toHaveTextContent("Adding…"));
    expect(screen.getByTestId("add-comment-btn")).toBeDisabled();
    expect(screen.getByTestId("comment-author-select")).toBeDisabled();
    expect(screen.getByTestId("comment-content-input")).toBeDisabled();

    // A second click while still submitting must not fire a second POST.
    fireEvent.click(screen.getByTestId("add-comment-btn"));
    const postCalls = fetchSpy.mock.calls.filter((call) => (call[1] as RequestInit)?.method === "POST");
    expect(postCalls).toHaveLength(1);

    resolvePost(
      new Response(JSON.stringify({ id: "new-id", taskId: "task-1", content: "New comment", authorId: "u1", authorName: "Alice Johnson", createdAt: "2026-01-03T00:00:00.000Z" }), { status: 201 })
    );
    await waitFor(() => expect(screen.getByTestId("add-comment-btn")).toHaveTextContent("Add comment"));
  });

  it("keeps the typed content and selected author, and shows an error, when the save fails", async () => {
    fetchSpy.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();
      if (init?.method === "POST") {
        return Promise.resolve(new Response(JSON.stringify({ error: "Validation failed", details: [{ field: "content", message: "content is required" }] }), { status: 400 }));
      }
      if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-empty")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("comment-author-select"), { target: { value: "u1" } });
    fireEvent.change(screen.getByTestId("comment-content-input"), { target: { value: "Kept content" } });
    fireEvent.click(screen.getByTestId("add-comment-btn"));

    await waitFor(() => expect(screen.getByTestId("comment-form-error")).toBeInTheDocument());
    expect((screen.getByTestId("comment-content-input") as HTMLTextAreaElement).value).toBe("Kept content");
    expect((screen.getByTestId("comment-author-select") as HTMLSelectElement).value).toBe("u1");
  });

  it("clears the content but keeps the selected author after a successful submit", async () => {
    mockDefault({ commentsResponse: () => new Response(JSON.stringify([])) });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-empty")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("comment-author-select"), { target: { value: "u1" } });
    fireEvent.change(screen.getByTestId("comment-content-input"), { target: { value: "New comment" } });
    fireEvent.click(screen.getByTestId("add-comment-btn"));

    await waitFor(() => expect(screen.getByTestId("comment-new-id")).toBeInTheDocument());
    expect((screen.getByTestId("comment-content-input") as HTMLTextAreaElement).value).toBe("");
    expect((screen.getByTestId("comment-author-select") as HTMLSelectElement).value).toBe("u1");
  });

  it("shows a validation error and does not call the API for empty content", async () => {
    mockDefault({ commentsResponse: () => new Response(JSON.stringify([])) });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-empty")).toBeInTheDocument());

    fireEvent.change(screen.getByTestId("comment-author-select"), { target: { value: "u1" } });
    fireEvent.click(screen.getByTestId("add-comment-btn"));

    await waitFor(() => expect(screen.getByTestId("comment-form-error")).toHaveTextContent(/empty/i));
    const postCalls = fetchSpy.mock.calls.filter((call) => (call[1] as RequestInit)?.method === "POST");
    expect(postCalls).toHaveLength(0);
  });

  it("fetching comments independently: shows a Retry button on failure and recovers on retry", async () => {
    let failComments = true;
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-1/comments") {
        if (failComments) return Promise.resolve(new Response(null, { status: 500 }));
        return Promise.resolve(new Response(JSON.stringify(mockComments)));
      }
      if (url === "/api/users") return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-error")).toBeInTheDocument());
    // The form (which only depends on users) is unaffected by the comments error.
    expect(screen.getByTestId("add-comment-form")).toBeInTheDocument();

    failComments = false;
    fireEvent.click(screen.getByTestId("comments-retry-btn"));
    await waitFor(() => expect(screen.getByTestId("comments-list")).toBeInTheDocument());
  });

  it("disables the add-comment form and shows a message when fetching users fails, without hiding existing comments", async () => {
    mockDefault({ usersResponse: () => new Response(null, { status: 500 }) });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-authors-error")).toBeInTheDocument());
    expect(screen.queryByTestId("add-comment-form")).not.toBeInTheDocument();
    // Existing comments (identified by their authorName snapshot) are still visible.
    expect(screen.getByTestId("comment-c1")).toHaveTextContent("Alice Johnson");
  });

  it("recovers the add-comment form after retrying a failed users fetch, without a full reload", async () => {
    let failUsers = true;
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = input.toString();
      if (url === "/api/tasks/task-1/comments") return Promise.resolve(new Response(JSON.stringify([])));
      if (url === "/api/users") {
        if (failUsers) return Promise.resolve(new Response(null, { status: 500 }));
        return Promise.resolve(new Response(JSON.stringify(mockUsers)));
      }
      return Promise.resolve(new Response(null, { status: 404 }));
    });
    render(<CommentsSection taskId="task-1" />);
    await waitFor(() => expect(screen.getByTestId("comments-authors-error")).toBeInTheDocument());

    failUsers = false;
    fireEvent.click(screen.getByTestId("comments-authors-retry-btn"));
    await waitFor(() => expect(screen.getByTestId("add-comment-form")).toBeInTheDocument());
  });
});
