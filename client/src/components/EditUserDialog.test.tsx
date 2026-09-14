import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditUserDialog } from "./EditUserDialog";
import { ApiError } from "../utils/apiError";
import type { User } from "../types";

const baseUser: User = {
  id: "u1",
  name: "Alice Johnson",
  email: "alice@example.com",
  role: "admin"
};

function renderDialog(user: User = baseUser, onSave = vi.fn().mockResolvedValue(undefined), onClose = vi.fn()) {
  render(<EditUserDialog user={user} open onClose={onClose} onSave={onSave} />);
  return { onSave, onClose };
}

const save = () => fireEvent.click(screen.getByRole("button", { name: "Save" }));
const nameInput = () => screen.getByLabelText("Name") as HTMLInputElement;
const emailInput = () => screen.getByLabelText("Email") as HTMLInputElement;
const roleSelect = () => screen.getByLabelText("Role") as HTMLSelectElement;
const avatarInput = () => screen.getByLabelText("Avatar URL") as HTMLInputElement;

/**
 * A promise whose resolution the test controls, so an in-flight request can be
 * asserted on without any real timer.
 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("EditUserDialog", () => {
  it("prefills every field from the user being edited", () => {
    renderDialog({ ...baseUser, avatar: "https://example.com/a.png" });

    expect(nameInput().value).toBe("Alice Johnson");
    expect(emailInput().value).toBe("alice@example.com");
    expect(roleSelect().value).toBe("admin");
    expect(avatarInput().value).toBe("https://example.com/a.png");
  });

  it("shows an empty avatar field for a user without one", () => {
    renderDialog();
    expect(avatarInput().value).toBe("");
  });

  it("prefills the avatar field from legacy avatarUrl for a seed user", () => {
    renderDialog({ ...baseUser, avatarUrl: "https://example.com/legacy.png" });
    expect(avatarInput().value).toBe("https://example.com/legacy.png");
  });

  it("prefers avatar over avatarUrl when both are present", () => {
    renderDialog({
      ...baseUser,
      avatar: "https://example.com/new.png",
      avatarUrl: "https://example.com/legacy.png"
    });
    expect(avatarInput().value).toBe("https://example.com/new.png");
  });

  it("sends the new avatar (not a no-op patch) when replacing a legacy avatarUrl", async () => {
    const { onSave } = renderDialog({ ...baseUser, avatarUrl: "https://example.com/legacy.png" });

    fireEvent.change(avatarInput(), { target: { value: "https://example.com/new.png" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ avatar: "https://example.com/new.png" });
  });

  it("sends avatar: null when clearing a field prefilled from legacy avatarUrl", async () => {
    const { onSave } = renderDialog({ ...baseUser, avatarUrl: "https://example.com/legacy.png" });

    fireEvent.change(avatarInput(), { target: { value: "" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ avatar: null });
  });

  it("sends no patch when the avatarUrl-derived field is left untouched", async () => {
    const { onSave } = renderDialog({ ...baseUser, avatarUrl: "https://example.com/legacy.png" });

    fireEvent.change(nameInput(), { target: { value: "Alice Cooper" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ name: "Alice Cooper" });
  });

  it("renders as an accessible modal with a labelled title", () => {
    renderDialog();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("heading", { name: "Edit user" })).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-labelledby", "edit-user-dialog-title");
  });

  it("moves focus to the first field when it opens", async () => {
    renderDialog();
    await waitFor(() => expect(document.activeElement).toBe(nameInput()));
  });

  it("closes on Cancel without saving", () => {
    const { onSave, onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("closes on Escape without saving", () => {
    const { onSave, onClose } = renderDialog();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("sends only the edited field on save", async () => {
    const { onSave } = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "Alice Cooper" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ name: "Alice Cooper" });
  });

  it("sends every edited field on a multi-field save", async () => {
    const { onSave } = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "Alice Cooper" } });
    fireEvent.change(emailInput(), { target: { value: "cooper@example.com" } });
    fireEvent.change(roleSelect(), { target: { value: "editor" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({
      name: "Alice Cooper",
      email: "cooper@example.com",
      role: "editor"
    });
  });

  it("sends an empty patch when nothing was edited", async () => {
    const { onSave } = renderDialog();

    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({});
  });

  it("sends avatar: null when the avatar field is emptied", async () => {
    const { onSave } = renderDialog({ ...baseUser, avatar: "https://example.com/old.png" });

    fireEvent.change(avatarInput(), { target: { value: "" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith({ avatar: null });
  });

  it("blocks the request and reports the problem for a client-invalid name", async () => {
    const { onSave } = renderDialog();

    fireEvent.change(nameInput(), { target: { value: "   " } });
    save();

    expect(await screen.findByText("Name is required")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(nameInput()).toHaveAttribute("aria-invalid", "true");
  });

  it("blocks the request and reports the problem for a client-invalid email", async () => {
    const { onSave } = renderDialog();

    // Passes the browser's own type="email" check but fails the API's format
    // rule (which requires a dot in the domain), so this exercises the app's
    // validation rather than the native one.
    fireEvent.change(emailInput(), { target: { value: "alice@localhost" } });
    save();

    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("prevents a double submit while the request is in flight", async () => {
    const pending = deferred<void>();
    const onSave = vi.fn().mockReturnValue(pending.promise);
    renderDialog(baseUser, onSave);

    fireEvent.change(nameInput(), { target: { value: "Alice Cooper" } });
    save();

    const savingButton = await screen.findByRole("button", { name: "Saving…" });
    expect(savingButton).toBeDisabled();

    // A second attempt while the request is in flight must not produce a
    // second request — neither through the (disabled) button nor by
    // submitting the form directly, e.g. with Enter.
    fireEvent.click(savingButton);
    fireEvent.submit(savingButton.closest("form")!);

    expect(onSave).toHaveBeenCalledTimes(1);

    pending.resolve();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });

  it("cannot be cancelled while a save is in flight", async () => {
    const pending = deferred<void>();
    const onSave = vi.fn().mockReturnValue(pending.promise);
    const { onClose } = renderDialog(baseUser, onSave);

    save();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    pending.resolve();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).toBeEnabled());
  });

  it("keeps the dialog open with the entered values after an API error", async () => {
    const onSave = vi.fn().mockRejectedValue(
      new ApiError("email is already in use", [{ field: "email", message: "email is already in use" }])
    );
    const { onClose } = renderDialog(baseUser, onSave);

    fireEvent.change(nameInput(), { target: { value: "Alice Cooper" } });
    fireEvent.change(emailInput(), { target: { value: "taken@example.com" } });
    save();

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));

    // Nothing was saved, so the form still shows exactly what was typed.
    expect(nameInput().value).toBe("Alice Cooper");
    expect(emailInput().value).toBe("taken@example.com");
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("edit-user-dialog")).toBeInTheDocument();
  });

  it("pins a field-level API error onto the matching control", async () => {
    const onSave = vi.fn().mockRejectedValue(
      new ApiError("email is already in use", [{ field: "email", message: "email is already in use" }])
    );
    renderDialog(baseUser, onSave);

    fireEvent.change(emailInput(), { target: { value: "taken@example.com" } });
    save();

    const fieldMessage = await screen.findByText("email is already in use", {
      selector: "#edit-user-email-error"
    });
    // Announced as an alert rather than being distinguishable only by colour.
    expect(fieldMessage).toHaveAttribute("role", "alert");
    await waitFor(() => expect(emailInput()).toHaveAttribute("aria-invalid", "true"));
    expect(emailInput().getAttribute("aria-describedby")).toContain("edit-user-email-error");
  });

  it("keeps the entered values after a network error", async () => {
    const onSave = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const { onClose } = renderDialog(baseUser, onSave);

    fireEvent.change(nameInput(), { target: { value: "Alice Cooper" } });
    save();

    expect(await screen.findByText("Failed to fetch")).toBeInTheDocument();
    expect(nameInput().value).toBe("Alice Cooper");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("re-enables saving so the user can retry after an error", async () => {
    const onSave = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("email is already in use", [{ field: "email", message: "email is already in use" }]))
      .mockResolvedValueOnce(undefined);
    renderDialog(baseUser, onSave);

    fireEvent.change(emailInput(), { target: { value: "taken@example.com" } });
    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText("email is already in use", { selector: "#edit-user-email-error" })
    ).toBeInTheDocument();

    fireEvent.change(emailInput(), { target: { value: "free@example.com" } });
    // Editing the field clears its stale error straight away.
    expect(document.getElementById("edit-user-email-error")).toBeNull();

    save();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave).toHaveBeenLastCalledWith({ email: "free@example.com" });
  });
});
