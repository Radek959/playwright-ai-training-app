#!/usr/bin/env node
// Detects TypeScript modules whose paths collide once case and the
// .ts/.tsx extension are ignored (e.g. "Example.ts" vs "example.tsx").
// On case-insensitive filesystems (Windows, default macOS) such pairs
// resolve to the same module non-deterministically, which can silently
// pick the wrong file at runtime.
import { readdirSync } from "node:fs";
import { dirname, join, relative, basename } from "node:path";
import { pathToFileURL } from "node:url";

const IGNORED_DIRS = new Set([
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".git",
  ".vite",
  ".cache",
  ".next",
  "out",
]);

const TS_EXTENSIONS = [".ts", ".tsx"];

function stripTsExtension(fileName) {
  for (const ext of TS_EXTENSIONS) {
    if (fileName.endsWith(ext)) {
      return fileName.slice(0, -ext.length);
    }
  }
  return null;
}

function collectTsFiles(rootDir) {
  const files = [];

  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;

      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const base = stripTsExtension(entry.name);
        if (base !== null) {
          files.push(fullPath);
        }
      }
    }
  };

  walk(rootDir);
  return files;
}

export function findCaseCollisions(rootDir) {
  const files = collectTsFiles(rootDir);
  const groups = new Map();

  for (const filePath of files) {
    const relPath = relative(rootDir, filePath).split("\\").join("/");
    const relDir = dirname(relPath);
    const base = stripTsExtension(basename(filePath));
    const key = `${relDir.toLowerCase()}/${base.toLowerCase()}`;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(relPath);
  }

  const collisions = [];
  for (const paths of groups.values()) {
    // Only a genuine collision when the paths differ (case and/or extension)
    // but normalize to the same key, and there's more than one real file.
    const unique = [...new Set(paths)];
    if (unique.length > 1) {
      collisions.push(unique.sort());
    }
  }

  return collisions.sort((a, b) => a[0].localeCompare(b[0]));
}

function main() {
  const rootDir = process.argv[2] ?? process.cwd();
  const collisions = findCaseCollisions(rootDir);

  if (collisions.length === 0) {
    console.log("No case-insensitive module collisions found.");
    return 0;
  }

  console.error("Found module paths that collide when case and .ts/.tsx extension are ignored:");
  for (const group of collisions) {
    console.error(`  - ${group.join("  <->  ")}`);
  }
  console.error(
    "\nThese modules resolve unpredictably on case-insensitive filesystems (e.g. Windows). Rename one of each pair to a unique name."
  );
  return 1;
}

// pathToFileURL (rather than a "file://" + path template) so the comparison
// also holds for Windows paths and for paths containing spaces or non-ASCII
// characters, which import.meta.url percent-encodes.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  process.exit(main());
}
