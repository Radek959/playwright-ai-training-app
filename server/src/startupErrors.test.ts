import { describe, it, expect } from "vitest";
import { formatStartupError } from "./startupErrors.js";

const busyPortError = (): NodeJS.ErrnoException =>
  Object.assign(new Error("listen EADDRINUSE: address already in use 127.0.0.1:3001"), {
    code: "EADDRINUSE"
  });

describe("formatStartupError", () => {
  it("explains a busy port instead of leaving the raw listen error", () => {
    const message = formatStartupError(busyPortError(), 3001);

    expect(message).toContain("Port 3001 is already in use");
    expect(message).toContain('run "npm run dev" again');
    expect(message).not.toContain("EADDRINUSE");
  });

  it("gives a way to free the port on both Windows and Unix-like systems", () => {
    const message = formatStartupError(busyPortError(), 3001);

    expect(message).toContain("netstat -ano | findstr :3001");
    expect(message).toContain("taskkill /PID <pid> /F");
    expect(message).toContain("lsof -i :3001");
  });

  it("uses the port it was actually given", () => {
    const message = formatStartupError(busyPortError(), 4321);

    expect(message).toContain("Port 4321 is already in use");
    expect(message).not.toContain("3001");
  });

  it("falls back to the underlying message for any other failure", () => {
    const err: NodeJS.ErrnoException = Object.assign(new Error("permission denied"), {
      code: "EACCES"
    });

    expect(formatStartupError(err, 3001)).toContain("The backend could not start: permission denied");
  });
});
