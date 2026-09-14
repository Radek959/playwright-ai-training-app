import { describe, expect, it } from "vitest";
import { findDependencyCycle } from "./taskDependencyGraph.js";

describe("findDependencyCycle", () => {
  it("returns null for a task with no dependencies", () => {
    expect(findDependencyCycle([{ id: "a" }], "a")).toBeNull();
    expect(findDependencyCycle([{ id: "a", dependencies: [] }], "a")).toBeNull();
  });

  it("detects a task depending on itself", () => {
    expect(findDependencyCycle([{ id: "a", dependencies: ["a"] }], "a")).toEqual(["a"]);
  });

  it("detects a two-task cycle", () => {
    const nodes = [
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["a"] }
    ];
    expect(findDependencyCycle(nodes, "a")).toEqual(["a", "b"]);
  });

  it("detects an indirect three-task cycle", () => {
    const nodes = [
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["c"] },
      { id: "c", dependencies: ["a"] }
    ];
    expect(findDependencyCycle(nodes, "a")).toEqual(["a", "b", "c"]);
  });

  it("detects a longer indirect cycle", () => {
    const nodes = [
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["c"] },
      { id: "c", dependencies: ["d"] },
      { id: "d", dependencies: ["e"] },
      { id: "e", dependencies: ["a"] }
    ];
    expect(findDependencyCycle(nodes, "a")).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("reports only the cycle itself when the start task merely leads into one", () => {
    const nodes = [
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["c"] },
      { id: "c", dependencies: ["b"] }
    ];
    expect(findDependencyCycle(nodes, "a")).toEqual(["b", "c"]);
  });

  it("accepts a valid chain of dependencies", () => {
    const nodes = [
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["c"] },
      { id: "c", dependencies: [] }
    ];
    expect(findDependencyCycle(nodes, "a")).toBeNull();
  });

  it("accepts several tasks sharing the same dependency", () => {
    const nodes = [
      { id: "a", dependencies: ["shared"] },
      { id: "b", dependencies: ["shared"] },
      { id: "c", dependencies: ["a", "b"] },
      { id: "shared", dependencies: [] }
    ];
    expect(findDependencyCycle(nodes, "c")).toBeNull();
    expect(findDependencyCycle(nodes, "a")).toBeNull();
  });

  it("accepts a diamond where one node is reached by two different paths", () => {
    const nodes = [
      { id: "top", dependencies: ["left", "right"] },
      { id: "left", dependencies: ["bottom"] },
      { id: "right", dependencies: ["bottom"] },
      { id: "bottom", dependencies: [] }
    ];
    expect(findDependencyCycle(nodes, "top")).toBeNull();
  });

  it("treats unknown dependency ids as leaves instead of cycles", () => {
    expect(findDependencyCycle([{ id: "a", dependencies: ["ghost"] }], "a")).toBeNull();
  });

  it("ignores cycles that are not reachable from the start task", () => {
    const nodes = [
      { id: "a", dependencies: [] },
      { id: "b", dependencies: ["c"] },
      { id: "c", dependencies: ["b"] }
    ];
    expect(findDependencyCycle(nodes, "a")).toBeNull();
  });

  it("returns the same cycle for the same input (deterministic traversal order)", () => {
    const nodes = [
      { id: "a", dependencies: ["b", "c"] },
      { id: "b", dependencies: [] },
      { id: "c", dependencies: ["a"] }
    ];
    expect(findDependencyCycle(nodes, "a")).toEqual(["a", "c"]);
    expect(findDependencyCycle(nodes, "a")).toEqual(["a", "c"]);
  });

  it("does not mutate the nodes it is given", () => {
    const nodes = [
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["a"] }
    ];
    const snapshot = JSON.parse(JSON.stringify(nodes));
    findDependencyCycle(nodes, "a");
    expect(nodes).toEqual(snapshot);
  });

  it("returns null for a start id that is not in the graph at all", () => {
    expect(findDependencyCycle([{ id: "a", dependencies: ["a"] }], "missing")).toBeNull();
  });
});
