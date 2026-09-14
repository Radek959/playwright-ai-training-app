import { describe, expect, it } from "vitest";
import { effectiveAvatar } from "./avatar";

describe("effectiveAvatar", () => {
  it("prefers avatar over avatarUrl when both are set", () => {
    expect(effectiveAvatar({ avatar: "new.png", avatarUrl: "legacy.png" })).toBe("new.png");
  });

  it("falls back to avatarUrl when avatar is unset", () => {
    expect(effectiveAvatar({ avatarUrl: "legacy.png" })).toBe("legacy.png");
  });

  it("returns undefined when neither is set", () => {
    expect(effectiveAvatar({})).toBeUndefined();
  });

  it("returns undefined for a null or undefined user", () => {
    expect(effectiveAvatar(null)).toBeUndefined();
    expect(effectiveAvatar(undefined)).toBeUndefined();
  });

  it("ignores an empty-string avatar and falls back to avatarUrl", () => {
    expect(effectiveAvatar({ avatar: "", avatarUrl: "legacy.png" })).toBe("legacy.png");
  });
});
