#!/usr/bin/env node
// Runs an npm command inside client/ or server/ using the child process's cwd
// instead of npm's --prefix flag.
//
// On Windows with npm 10.9.x, `npm --prefix server install` does not install
// into server/: it re-installs the root package, whose postinstall runs
// install:all again, which calls npm --prefix once more. The loop repeats
// until npm fails with "'npm' is not recognized as an internal or external
// command", so a participant's very first `npm install` never completes.
// Reproduced on windows-latest + Node 22.23.2 (npm 10.9.8); the same command
// works on npm 11.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const [workspace, ...args] = process.argv.slice(2);

if (!workspace || args.length === 0) {
  console.error("usage: node scripts/npm-in.mjs <directory> <npm arguments...>");
  process.exit(1);
}

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cwd = join(repoRoot, workspace);

if (!existsSync(cwd)) {
  console.error(`No such directory: ${cwd}`);
  process.exit(1);
}

// shell: true so "npm" resolves to npm.cmd on Windows.
const result = spawnSync("npm", args, { cwd, stdio: "inherit", shell: true });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
