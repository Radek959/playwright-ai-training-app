/**
 * Task search: turning a raw query string into an ordered, capped list of
 * matching tasks.
 *
 * Deliberately free of any knowledge of Express or the in-memory stores: it
 * takes plain arrays and a string and returns a new array, mutating nothing it
 * is given, so the whole ranking and matching contract is unit-testable in
 * isolation.
 */

export type SearchableTask = {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  assigneeId?: string;
};

export type SearchableUser = {
  id: string;
  name: string;
};

/**
 * Queries shorter than this (after trimming) return no results at all, rather
 * than matching most of the dataset on one or two letters. Unchanged from the
 * endpoint's original behaviour.
 */
export const TASK_SEARCH_MIN_QUERY_LENGTH = 2;

/** Maximum number of results returned. Unchanged from the endpoint's original behaviour. */
export const TASK_SEARCH_RESULT_LIMIT = 10;

/**
 * Match ranks, best first. A task is assigned exactly one rank — the best one
 * it qualifies for — which is also what makes the result set inherently
 * duplicate-free: matching on several fields at once cannot produce several
 * entries.
 */
const RANK_EXACT_TITLE = 0;
const RANK_TITLE_PREFIX = 1;
const RANK_TITLE_OTHER = 2;
const RANK_OTHER_FIELD = 3;

const includesQuery = (value: string | undefined, query: string): boolean =>
  typeof value === "string" && value.toLowerCase().includes(query);

/**
 * Finds the tasks matching `rawQuery` and returns them ordered best match
 * first, capped at TASK_SEARCH_RESULT_LIMIT.
 *
 * Matching:
 * - the query is trimmed and compared case-insensitively, so "  Bug  " and
 *   "bug" search for exactly the same thing;
 * - an empty (or whitespace-only) query, or one shorter than
 *   TASK_SEARCH_MIN_QUERY_LENGTH after trimming, matches nothing;
 * - a task matches on a substring of its title, its description, any one of
 *   its tags, or the name of the user it is assigned to.
 *
 * Ordering (a deliberately simple, documented rule — the dataset is small
 * enough that anything more elaborate would be unjustifiable):
 *   1. the title is exactly the query,
 *   2. the title starts with the query,
 *   3. the title contains the query anywhere else,
 *   4. only the description, a tag, or the assignee's name matches.
 * Ties are broken by the task's position in the input array, which keeps the
 * order stable and the whole function deterministic: the same input always
 * produces the same output.
 */
export function searchTasks<T extends SearchableTask>(
  tasks: readonly T[],
  rawQuery: string,
  users: readonly SearchableUser[] = []
): T[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < TASK_SEARCH_MIN_QUERY_LENGTH) return [];

  const nameByUserId = new Map(users.map((user) => [user.id, user.name]));

  const matches: { task: T; rank: number; index: number }[] = [];

  tasks.forEach((task, index) => {
    const title = task.title.toLowerCase();

    let rank: number;
    if (title === query) {
      rank = RANK_EXACT_TITLE;
    } else if (title.startsWith(query)) {
      rank = RANK_TITLE_PREFIX;
    } else if (title.includes(query)) {
      rank = RANK_TITLE_OTHER;
    } else if (
      includesQuery(task.description, query) ||
      (task.tags ?? []).some((tag) => includesQuery(tag, query)) ||
      includesQuery(task.assigneeId ? nameByUserId.get(task.assigneeId) : undefined, query)
    ) {
      rank = RANK_OTHER_FIELD;
    } else {
      return;
    }

    matches.push({ task, rank, index });
  });

  matches.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.index - b.index));

  return matches.slice(0, TASK_SEARCH_RESULT_LIMIT).map((match) => match.task);
}
