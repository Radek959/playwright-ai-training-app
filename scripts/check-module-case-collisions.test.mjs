import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { findCaseCollisions } from "./check-module-case-collisions.mjs";

function makeTempDir() {
  return mkdtempSync(join(tmpdir(), "case-collision-test-"));
}

function writeFile(root, relPath) {
  const fullPath = join(root, relPath);
  mkdirSync(join(fullPath, ".."), { recursive: true });
  writeFileSync(fullPath, "export {};\n");
}

test("detects a case-differing collision", () => {
  const root = makeTempDir();
  try {
    writeFile(root, "src/context/AppErrorContext.tsx");
    writeFile(root, "src/context/appErrorContext.ts");

    const collisions = findCaseCollisions(root);

    assert.equal(collisions.length, 1);
    assert.deepEqual(collisions[0].sort(), [
      "src/context/AppErrorContext.tsx",
      "src/context/appErrorContext.ts",
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("detects a .ts vs .tsx collision with identical casing", () => {
  const root = makeTempDir();
  try {
    writeFile(root, "src/Example.ts");
    writeFile(root, "src/Example.tsx");

    const collisions = findCaseCollisions(root);

    assert.equal(collisions.length, 1);
    assert.deepEqual(collisions[0].sort(), ["src/Example.ts", "src/Example.tsx"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("does not flag genuinely different module names", () => {
  const root = makeTempDir();
  try {
    writeFile(root, "src/Foo.ts");
    writeFile(root, "src/Bar.tsx");
    writeFile(root, "src/nested/Foo.ts");

    const collisions = findCaseCollisions(root);

    assert.equal(collisions.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("ignores generated directories like node_modules and dist", () => {
  const root = makeTempDir();
  try {
    writeFile(root, "src/Example.ts");
    writeFile(root, "node_modules/some-pkg/example.ts");
    writeFile(root, "dist/example.ts");
    writeFile(root, "coverage/example.ts");

    const collisions = findCaseCollisions(root);

    assert.equal(collisions.length, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
