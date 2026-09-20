#!/usr/bin/env node
// Starts the application exactly the way a participant does (`npm run dev`),
// waits for both services, checks them, and always stops what it started.
//
// Written in Node rather than shell so the same check runs on Windows, macOS
// and Linux: the repository's other smoke test uses seq/curl/kill/pkill and
// therefore only works on the Linux runner, which left `npm run dev` - the
// single most important command in the README - unverified everywhere else.
import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The addresses the README gives participants. Deliberately "localhost" and
// not a hardcoded 127.0.0.1: the Vite dev server binds to whatever localhost
// resolves to, and on hosts that answer ::1 first (the GitHub Linux and macOS
// runners among them) it listens on IPv6 only, so an IPv4 probe is refused
// while the application is perfectly healthy for a browser.
const BACKEND_HEALTH = "http://localhost:3001/api/health";
const FRONTEND = "http://localhost:5173/";
// Overridable so the failure paths can be exercised without waiting minutes.
const START_TIMEOUT_MS = Number(process.env.SMOKE_START_TIMEOUT_MS ?? 120_000);
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SMOKE_SHUTDOWN_TIMEOUT_MS ?? 20_000);
const POLL_INTERVAL_MS = 1_000;

const isWindows = process.platform === "win32";

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Resolves with the response body once `url` answers 2xx, or rejects on timeout. */
export async function waitForHttpOk(url, { timeoutMs, intervalMs = POLL_INTERVAL_MS, onAttempt } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no attempt completed";

  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.text();
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.cause?.code ?? err.message;
    }
    onAttempt?.(lastError);
    await delay(intervalMs);
  }

  throw new Error(`${url} did not respond within ${timeoutMs}ms (last attempt: ${lastError})`);
}

/** True once `url` stops answering - used to prove nothing was left listening. */
export async function waitForPortClosed(url, { timeoutMs, intervalMs = POLL_INTERVAL_MS } = {}) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await fetch(url);
    } catch {
      return true;
    }
    await delay(intervalMs);
  }

  return false;
}

/**
 * Reports which interfaces the dev server actually accepts. Never fails the
 * run: browsers try both families, so IPv6-only is not a defect - but knowing
 * it explains why a test hardcoding 127.0.0.1 might not connect.
 */
async function reportInterfaces() {
  for (const url of ["http://127.0.0.1:5173/", "http://[::1]:5173/"]) {
    try {
      const res = await fetch(url);
      console.log(`  ${url} -> HTTP ${res.status}`);
    } catch (err) {
      console.log(`  ${url} -> ${err.cause?.code ?? err.message}`);
    }
  }
}

function stopTree(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;

  if (isWindows) {
    // Windows has no process groups to signal: taskkill /T walks the tree.
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }

  try {
    // Negative pid = the whole process group created by detached: true, so
    // npm-run-all's children (vite, tsx) go down with it rather than being
    // orphaned onto the ports.
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function main() {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
  const output = [];

  const child = spawn("npm", ["run", "dev"], {
    cwd: repoRoot,
    shell: isWindows,
    detached: !isWindows,
    stdio: ["ignore", "pipe", "pipe"]
  });

  const record = (chunk) => {
    const text = chunk.toString();
    output.push(text);
    process.stdout.write(text);
  };
  child.stdout.on("data", record);
  child.stderr.on("data", record);

  let exitedEarly = null;
  child.on("exit", (code, signal) => {
    exitedEarly = signal ? `signal ${signal}` : `exit code ${code}`;
  });

  try {
    console.log(`\nWaiting for the backend at ${BACKEND_HEALTH} ...`);
    const health = await waitForHttpOk(BACKEND_HEALTH, {
      timeoutMs: START_TIMEOUT_MS,
      onAttempt: () => {
        if (exitedEarly) throw new Error(`"npm run dev" stopped on its own (${exitedEarly})`);
      }
    });
    console.log(`Backend responded: ${health.trim()}`);

    if (!health.includes('"ok"')) {
      throw new Error(`Unexpected health payload: ${health.trim()}`);
    }

    console.log(`Waiting for the frontend at ${FRONTEND} ...`);
    const page = await waitForHttpOk(FRONTEND, { timeoutMs: START_TIMEOUT_MS });
    if (!page.includes("<div id=\"root\">")) {
      throw new Error("The frontend answered but did not serve the application shell");
    }
    console.log("Frontend responded with the application shell.");

    await reportInterfaces();
  } finally {
    console.log("\nStopping the application ...");
    stopTree(child);
  }

  const backendClosed = await waitForPortClosed(BACKEND_HEALTH, { timeoutMs: SHUTDOWN_TIMEOUT_MS });
  const frontendClosed = await waitForPortClosed(FRONTEND, { timeoutMs: SHUTDOWN_TIMEOUT_MS });

  if (!backendClosed || !frontendClosed) {
    const stuck = [!backendClosed && "3001", !frontendClosed && "5173"].filter(Boolean).join(" and ");
    throw new Error(
      `Port ${stuck} was still answering ${SHUTDOWN_TIMEOUT_MS}ms after stopping "npm run dev" - ` +
      "a leftover Node process would block the next start."
    );
  }

  console.log("Both ports were released. Smoke test passed.");
}

// pathToFileURL, not a "file://" + path template: the template breaks on
// Windows paths and on paths containing spaces or non-ASCII characters.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error(`\nSmoke test failed: ${err.message}`);
    process.exitCode = 1;
  });
}
