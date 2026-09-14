import { describe, expect, it } from "vitest";
import {
  USER_FORM_MESSAGES,
  buildUserUpdatePayload,
  userToFormValues,
  validateUserForm,
  type UserFormValues
} from "./userFormModel";
import type { User } from "../types";

const baseUser: User = {
  id: "u1",
  name: "Alice Johnson",
  email: "alice@example.com",
  role: "admin"
};

const valuesFor = (user: User, overrides: Partial<UserFormValues> = {}): UserFormValues => ({
  ...userToFormValues(user),
  ...overrides
});

describe("userToFormValues", () => {
  it("prefills every editable field from the stored user", () => {
    expect(userToFormValues({ ...baseUser, avatar: "https://example.com/a.png" })).toEqual({
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "admin",
      avatar: "https://example.com/a.png"
    });
  });

  it("renders a missing avatar as an empty field rather than 'undefined'", () => {
    expect(userToFormValues(baseUser).avatar).toBe("");
  });

  it("prefills the avatar field from legacy avatarUrl for a seed user with no avatar", () => {
    expect(userToFormValues({ ...baseUser, avatarUrl: "https://example.com/legacy.png" }).avatar).toBe(
      "https://example.com/legacy.png"
    );
  });

  it("prefers avatar over avatarUrl when both are present", () => {
    expect(
      userToFormValues({
        ...baseUser,
        avatar: "https://example.com/new.png",
        avatarUrl: "https://example.com/legacy.png"
      }).avatar
    ).toBe("https://example.com/new.png");
  });
});

describe("validateUserForm", () => {
  it("accepts a fully valid form", () => {
    expect(validateUserForm(valuesFor(baseUser))).toEqual({});
  });

  it("rejects an empty name", () => {
    expect(validateUserForm(valuesFor(baseUser, { name: "" })).name).toBe(USER_FORM_MESSAGES.name);
  });

  it("rejects a whitespace-only name", () => {
    expect(validateUserForm(valuesFor(baseUser, { name: "   " })).name).toBe(USER_FORM_MESSAGES.name);
  });

  it("rejects an empty email", () => {
    expect(validateUserForm(valuesFor(baseUser, { email: "  " })).email).toBe(USER_FORM_MESSAGES.emailRequired);
  });

  it("rejects a malformed email", () => {
    expect(validateUserForm(valuesFor(baseUser, { email: "not-an-email" })).email).toBe(
      USER_FORM_MESSAGES.emailFormat
    );
  });

  it("accepts an email that only needs trimming", () => {
    expect(validateUserForm(valuesFor(baseUser, { email: "  alice@example.com  " })).email).toBeUndefined();
  });

  it("never reports an avatar error, since any string is a valid avatar", () => {
    expect(validateUserForm(valuesFor(baseUser, { avatar: "anything at all" })).avatar).toBeUndefined();
  });
});

describe("buildUserUpdatePayload", () => {
  it("produces an empty patch when nothing was edited", () => {
    expect(buildUserUpdatePayload(valuesFor(baseUser), baseUser)).toEqual({});
  });

  it("sends only the field that changed", () => {
    expect(buildUserUpdatePayload(valuesFor(baseUser, { name: "Alice Cooper" }), baseUser)).toEqual({
      name: "Alice Cooper"
    });
  });

  it("sends every field that changed in a multi-field edit", () => {
    const values = valuesFor(baseUser, {
      name: "Alice Cooper",
      email: "cooper@example.com",
      role: "editor",
      avatar: "https://example.com/new.png"
    });

    expect(buildUserUpdatePayload(values, baseUser)).toEqual({
      name: "Alice Cooper",
      email: "cooper@example.com",
      role: "editor",
      avatar: "https://example.com/new.png"
    });
  });

  it("trims name and email before comparing, so re-padding is not a change", () => {
    const values = valuesFor(baseUser, { name: "  Alice Johnson  ", email: "  alice@example.com  " });
    expect(buildUserUpdatePayload(values, baseUser)).toEqual({});
  });

  it("sends the trimmed value when a padded field genuinely changed", () => {
    const values = valuesFor(baseUser, { name: "  Alice Cooper  " });
    expect(buildUserUpdatePayload(values, baseUser)).toEqual({ name: "Alice Cooper" });
  });

  it("sends an explicit null to clear an existing avatar", () => {
    const user = { ...baseUser, avatar: "https://example.com/old.png" };
    expect(buildUserUpdatePayload(valuesFor(user, { avatar: "" }), user)).toEqual({ avatar: null });
  });

  it("treats a whitespace-only avatar field as clearing it", () => {
    const user = { ...baseUser, avatar: "https://example.com/old.png" };
    expect(buildUserUpdatePayload(valuesFor(user, { avatar: "   " }), user)).toEqual({ avatar: null });
  });

  it("omits avatar entirely when the user never had one and did not add one", () => {
    const patch = buildUserUpdatePayload(valuesFor(baseUser, { avatar: "" }), baseUser);
    expect("avatar" in patch).toBe(false);
  });

  it("sends a new avatar for a user that had none", () => {
    expect(buildUserUpdatePayload(valuesFor(baseUser, { avatar: "https://example.com/first.png" }), baseUser)).toEqual({
      avatar: "https://example.com/first.png"
    });
  });

  it("never includes an id, even though the form was built from a user that has one", () => {
    const patch = buildUserUpdatePayload(valuesFor(baseUser, { name: "Changed" }), baseUser);
    expect("id" in patch).toBe(false);
  });

  it("does not treat an untouched avatarUrl-derived field as a changed avatar", () => {
    const user = { ...baseUser, avatarUrl: "https://example.com/legacy.png" };
    // The form was prefilled from the effective avatar (avatarUrl, here); the
    // user never touched the field, so no patch should be produced for it.
    expect(buildUserUpdatePayload(valuesFor(user), user)).toEqual({});
  });

  it("sends the new avatar when it replaces a legacy avatarUrl", () => {
    const user = { ...baseUser, avatarUrl: "https://example.com/legacy.png" };
    const values = valuesFor(user, { avatar: "https://example.com/new.png" });
    expect(buildUserUpdatePayload(values, user)).toEqual({ avatar: "https://example.com/new.png" });
  });

  it("sends avatar: null when clearing a field prefilled from legacy avatarUrl", () => {
    const user = { ...baseUser, avatarUrl: "https://example.com/legacy.png" };
    expect(buildUserUpdatePayload(valuesFor(user, { avatar: "" }), user)).toEqual({ avatar: null });
  });
});
