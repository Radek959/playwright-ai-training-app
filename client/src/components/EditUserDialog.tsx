import { FormEvent, useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { ApiError, mapFieldErrors } from "../utils/apiError";
import {
  buildUserUpdatePayload,
  userToFormValues,
  validateUserForm,
  type UserFormErrors,
  type UserFormValues
} from "../utils/userFormModel";
import type { User, UserRole, UserUpdateInput } from "../types";

type Props = {
  user: User;
  open: boolean;
  onClose: () => void;
  /** Rejects (throws) on failure so the dialog can stay open and show why. */
  onSave: (patch: UserUpdateInput) => Promise<void>;
};

const TITLE_ID = "edit-user-dialog-title";
const ERROR_ID = "edit-user-dialog-error";

// Every field this form can edit; an API error on any other field falls back
// to the generic banner instead of being pinned to an unrelated control.
const KNOWN_FIELDS = new Set(["name", "email", "role", "avatar"]);

const FIELD_ERROR_ID: Record<string, string> = {
  name: "edit-user-name-error",
  email: "edit-user-email-error",
  role: "edit-user-role-error",
  avatar: "edit-user-avatar-error"
};

/**
 * Edits an existing user from the user detail view. The dialog is only ever
 * mounted while open, so the form state starts from the user as currently
 * loaded; a rejected save keeps every entered value in place (nothing was
 * stored, so nothing may look stored) and the dialog stays open for a retry.
 */
export function EditUserDialog({ user, open, onClose, onSave }: Props) {
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [values, setValues] = useState<UserFormValues>(() => userToFormValues(user));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reopening the dialog (or opening it on a user that has since been
  // refreshed) starts from the stored values again, with no stale error from
  // a previous attempt. While it stays open, the user's own edits are never
  // overwritten.
  useEffect(() => {
    if (open) {
      setValues(userToFormValues(user));
      setSaveError(null);
      setFieldErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user.id]);

  const setValue = <K extends keyof UserFormValues>(field: K, value: UserFormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const describedBy = (field: string, includeBanner = false) =>
    [fieldErrors[field] ? FIELD_ERROR_ID[field] : null, includeBanner && saveError ? ERROR_ID : null]
      .filter(Boolean)
      .join(" ") || undefined;

  const fieldError = (field: string) =>
    fieldErrors[field] ? (
      <p id={FIELD_ERROR_ID[field]} role="alert" className="text-red-600 text-xs">
        {fieldErrors[field]}
      </p>
    ) : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    // Guards against a double submit: a second click (or Enter) while the
    // request is in flight is ignored outright, on top of the disabled button.
    if (isSaving) return;

    const clientErrors: UserFormErrors = validateUserForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors as Record<string, string>);
      setSaveError(null);
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      await onSave(buildUserUpdatePayload(values, user));
      // The caller closes the dialog on success; entered data is deliberately
      // left untouched here so a failure keeps it available for a retry.
    } catch (err) {
      if (err instanceof ApiError) {
        const { mapped } = mapFieldErrors(err.details, KNOWN_FIELDS);
        setFieldErrors(mapped);
      }
      setSaveError(err instanceof Error ? err.message : "Failed to save the user");
    } finally {
      setIsSaving(false);
    }
  };

  // Closing mid-request would leave a save in flight with no way to report
  // its outcome, so Cancel/Escape/overlay are all blocked while saving.
  const handleRequestClose = () => {
    if (isSaving) return;
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleRequestClose}
      titleId={TITLE_ID}
      initialFocusRef={nameInputRef}
      testId="edit-user-dialog"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" aria-busy={isSaving}>
        <div className="flex justify-between items-start gap-4">
          <h2 id={TITLE_ID} className="text-2xl font-bold text-gray-900">
            Edit user
          </h2>
          <button
            type="button"
            onClick={handleRequestClose}
            disabled={isSaving}
            aria-label="Close dialog"
            className="text-gray-400 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded p-1 -mt-1 -mr-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {saveError && (
          <div id={ERROR_ID} role="alert" className="bg-red-50 border border-red-300 rounded p-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-user-name" className="text-sm font-semibold text-slate-700">
            Name
          </label>
          <input
            id="edit-user-name"
            ref={nameInputRef}
            className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={values.name}
            onChange={(e) => setValue("name", e.target.value)}
            autoComplete="name"
            required
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={describedBy("name", true)}
          />
          {fieldError("name")}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-user-email" className="text-sm font-semibold text-slate-700">
            Email
          </label>
          <input
            id="edit-user-email"
            type="email"
            className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={values.email}
            onChange={(e) => setValue("email", e.target.value)}
            autoComplete="email"
            required
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={describedBy("email", true)}
          />
          {fieldError("email")}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-user-role" className="text-sm font-semibold text-slate-700">
            Role
          </label>
          <select
            id="edit-user-role"
            className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={values.role}
            onChange={(e) => setValue("role", e.target.value as UserRole)}
            aria-invalid={Boolean(fieldErrors.role)}
            aria-describedby={describedBy("role")}
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          {fieldError("role")}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="edit-user-avatar" className="text-sm font-semibold text-slate-700">
            Avatar URL
          </label>
          <input
            id="edit-user-avatar"
            type="url"
            className="border rounded px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
            value={values.avatar}
            onChange={(e) => setValue("avatar", e.target.value)}
            autoComplete="photo"
            aria-invalid={Boolean(fieldErrors.avatar)}
            aria-describedby={["edit-user-avatar-hint", describedBy("avatar")].filter(Boolean).join(" ")}
          />
          <p id="edit-user-avatar-hint" className="text-xs text-gray-600">
            Leave empty to remove the current avatar.
          </p>
          {fieldError("avatar")}
        </div>

        <div className="flex justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={handleRequestClose}
            disabled={isSaving}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
