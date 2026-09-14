import type { User, UserRole, UserUpdateInput } from "../types";

/**
 * Form model for editing an existing user. Every value is kept in the shape an
 * HTML control produces (plain strings), so the form can bind directly to it
 * and validation/payload building can be written once rather than inline in
 * the component.
 */
export type UserFormValues = {
  name: string;
  email: string;
  role: UserRole;
  /** Raw text input; "" means "no avatar". */
  avatar: string;
};

export type UserFormField = keyof UserFormValues;

export type UserFormErrors = Partial<Record<UserFormField, string>>;

export const USER_FORM_MESSAGES = {
  name: "Name is required",
  emailRequired: "Email is required",
  emailFormat: "Enter a valid email address"
} as const;

// Kept deliberately identical to the server's EMAIL_RE in
// server/src/validation.ts, so a form that passes here is never rejected by
// the API for a format rule the UI could have caught first.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Builds the form state for an existing user (used when opening the edit dialog). */
export function userToFormValues(user: User): UserFormValues {
  return {
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar ?? ""
  };
}

/**
 * Client-side validation mirroring the server rules for a user: a non-blank
 * name and a non-blank, well-formed email. Email *uniqueness* is deliberately
 * not checked here — only the API knows the full set of users, so that one is
 * reported from its response instead of guessed locally.
 */
export function validateUserForm(values: UserFormValues): UserFormErrors {
  const errors: UserFormErrors = {};

  if (values.name.trim().length === 0) {
    errors.name = USER_FORM_MESSAGES.name;
  }

  const email = values.email.trim();
  if (email.length === 0) {
    errors.email = USER_FORM_MESSAGES.emailRequired;
  } else if (!EMAIL_RE.test(email)) {
    errors.email = USER_FORM_MESSAGES.emailFormat;
  }

  return errors;
}

/**
 * Builds the PUT /api/users/:id body by diffing the edited form against the
 * user as it was loaded. Only what actually changed is sent, so editing one
 * field can never overwrite a value the user did not touch, and an untouched
 * form produces an empty (no-op) patch.
 *
 * `name` and `email` are compared after trimming, because that is exactly what
 * the API stores — re-padding a field with spaces is not a change. A cleared
 * avatar is sent as the explicit `null` the API contract defines for clearing
 * (omitting it would mean "leave as is" instead).
 */
export function buildUserUpdatePayload(values: UserFormValues, original: User): UserUpdateInput {
  const patch: UserUpdateInput = {};

  const name = values.name.trim();
  if (name !== original.name) patch.name = name;

  const email = values.email.trim();
  if (email !== original.email) patch.email = email;

  if (values.role !== original.role) patch.role = values.role;

  const avatar = values.avatar.trim();
  const originalAvatar = original.avatar ?? "";
  if (avatar !== originalAvatar) {
    patch.avatar = avatar === "" ? null : avatar;
  }

  return patch;
}
