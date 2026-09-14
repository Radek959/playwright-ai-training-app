import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserAvatar } from "./UserAvatar";

describe("UserAvatar", () => {
  it("renders the image when a src is given", () => {
    render(<UserAvatar src="https://example.com/a.png" name="Alice Johnson" />);
    const img = screen.getByTestId("user-avatar-image") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/a.png");
  });

  it("renders initials when no src is given", () => {
    render(<UserAvatar name="Alice Johnson" />);
    expect(screen.getByTestId("user-avatar-fallback")).toHaveTextContent("AJ");
  });

  it("falls back to initials once the image fails to load", () => {
    render(<UserAvatar src="https://example.com/broken.png" name="Alice Johnson" />);
    fireEvent.error(screen.getByTestId("user-avatar-image"));
    expect(screen.getByTestId("user-avatar-fallback")).toBeInTheDocument();
  });

  it("attempts a new src again after a previous src failed to load", () => {
    const { rerender } = render(<UserAvatar src="https://example.com/broken.png" name="Alice Johnson" />);
    fireEvent.error(screen.getByTestId("user-avatar-image"));
    expect(screen.getByTestId("user-avatar-fallback")).toBeInTheDocument();

    // A different, valid src must not stay hidden behind the old failure.
    rerender(<UserAvatar src="https://example.com/valid.png" name="Alice Johnson" />);
    const img = screen.getByTestId("user-avatar-image") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/valid.png");
  });

  it("does not retry the same broken src on its own after it has failed", () => {
    const { rerender } = render(<UserAvatar src="https://example.com/broken.png" name="Alice Johnson" />);
    fireEvent.error(screen.getByTestId("user-avatar-image"));
    expect(screen.getByTestId("user-avatar-fallback")).toBeInTheDocument();

    // Re-rendering with the exact same src (identity unchanged) must keep
    // showing the fallback rather than looping back into another <img> attempt.
    rerender(<UserAvatar src="https://example.com/broken.png" name="Alice Johnson" />);
    expect(screen.getByTestId("user-avatar-fallback")).toBeInTheDocument();
  });

  it("falls back to initials when src becomes undefined after a failure", () => {
    const { rerender } = render(<UserAvatar src="https://example.com/broken.png" name="Alice Johnson" />);
    fireEvent.error(screen.getByTestId("user-avatar-image"));

    rerender(<UserAvatar name="Alice Johnson" />);
    expect(screen.getByTestId("user-avatar-fallback")).toBeInTheDocument();
  });
});
