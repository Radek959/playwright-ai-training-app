/**
 * Cycle detection for the task dependency graph.
 *
 * Deliberately free of any knowledge of Express, the in-memory stores, or the
 * Task type: it takes a plain list of nodes and returns a plain answer, has no
 * side effects, and mutates nothing it is given. That keeps it unit-testable
 * in isolation and reusable for "would this change create a cycle?" checks
 * against a graph that has not been persisted yet.
 */

export type DependencyNode = {
  id: string;
  dependencies?: readonly string[];
};

/**
 * Walks the dependency edges reachable from `startId` depth-first and returns
 * the first cycle it finds, as the list of ids forming that cycle in traversal
 * order (the edge closing the cycle goes from the last id back to the first).
 * A task listing itself as a dependency yields a single-element cycle.
 *
 * Returns null when nothing reachable from `startId` cycles back onto the
 * path — including the common case of several tasks sharing one dependency,
 * which is a diamond, not a cycle.
 *
 * Ids that are not present in `nodes` are treated as having no dependencies,
 * so an unknown reference can never be reported as a cycle (it is a separate
 * validation concern). Traversal follows the order the dependencies are listed
 * in, so the result is deterministic for a given input.
 */
export function findDependencyCycle(nodes: readonly DependencyNode[], startId: string): string[] | null {
  const dependenciesById = new Map<string, readonly string[]>();
  for (const node of nodes) {
    dependenciesById.set(node.id, node.dependencies ?? []);
  }

  // Ids fully explored without finding a cycle through them; revisiting one is
  // pointless and keeps a wide diamond-shaped graph from being re-walked.
  const settled = new Set<string>();
  // The ids on the current DFS path, in order. An edge back onto one of these
  // is exactly what a cycle is.
  const path: string[] = [];
  const onPath = new Set<string>();

  const visit = (id: string): string[] | null => {
    if (onPath.has(id)) {
      return path.slice(path.indexOf(id));
    }
    if (settled.has(id)) return null;

    path.push(id);
    onPath.add(id);
    for (const dependencyId of dependenciesById.get(id) ?? []) {
      const cycle = visit(dependencyId);
      if (cycle) return cycle;
    }
    path.pop();
    onPath.delete(id);
    settled.add(id);
    return null;
  };

  return visit(startId);
}
