import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Task } from "../types";

type Props = {
  placeholder?: string;
};

const LISTBOX_ID = "task-search-listbox";
const INPUT_LABEL_ID = "task-search-label";

/** Matches the server's own minimum (see TASK_SEARCH_MIN_QUERY_LENGTH). */
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

/**
 * What the widget currently knows about the typed query. Modelling it as one
 * value (rather than separate `results`/`loading`/`error` flags that can
 * disagree) is what guarantees the dropdown never shows a previous query's
 * results as if they belonged to the current one: moving to a new query
 * replaces the whole state instead of leaving stale results behind.
 */
type SearchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; results: Task[] };

/**
 * A transient navigation widget: typing looks tasks up through
 * GET /api/tasks/search and picking a result goes to that task's detail page.
 *
 * It deliberately does not filter the task list behind it and does not write
 * the typed text into the /tasks URL — the list's own filters own that state,
 * and a half-typed search term is not something anyone wants to share or
 * restore from a bookmark.
 */
export function TaskSearch({ placeholder = "Search tasks..." }: Props) {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({ status: "idle" });
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Bumped by "Try again" to re-run the effect for the same query.
  const [retryToken, setRetryToken] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Every request gets a number; only the most recently started one is allowed
  // to write state. Responses that arrive out of order (a slow request for an
  // older query resolving after a fast one for a newer query) are dropped
  // rather than overwriting newer results.
  const latestRequestRef = useRef(0);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  // Whitespace around the query is meaningless (the API trims it too), so the
  // effect keys off the trimmed value: padding an existing query with spaces
  // does not fire another request, and a query that is only whitespace never
  // fires one at all.
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (trimmedQuery.length < MIN_QUERY_LENGTH) {
      // Nothing worth asking for — and any older results stop being shown.
      latestRequestRef.current += 1;
      setState({ status: "idle" });
      return;
    }

    setState({ status: "loading" });
    const requestId = (latestRequestRef.current += 1);
    // Created synchronously so the effect cleanup below can abort it the
    // instant the query changes again, rather than waiting for the next
    // debounce window to elapse before cancelling the stale request.
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tasks/search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal
        });
        if (!res.ok) throw new Error(`Search failed: ${res.status}`);
        const data = await res.json();
        if (requestId !== latestRequestRef.current) return;
        setState({ status: "success", results: Array.isArray(data) ? (data as Task[]) : [] });
        setSelectedIndex(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        if (requestId !== latestRequestRef.current) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Search failed"
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmedQuery, retryToken]);

  const results = state.status === "success" ? state.results : [];

  const handleSelect = (task: Task) => {
    setQuery("");
    latestRequestRef.current += 1;
    setState({ status: "idle" });
    setFocused(false);
    inputRef.current?.blur();
    navigate(`/tasks/${task.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape must close the dropdown regardless of whether results have
    // loaded yet, so it is handled unconditionally before any
    // results-dependent logic below (which would otherwise no-op while
    // loading or when a "No results" message is showing).
    if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
      return;
    }

    if (!results.length) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    }
  };

  const retry = () => {
    setRetryToken((token) => token + 1);
    inputRef.current?.focus();
  };

  const showDropdown = focused && state.status !== "idle";
  const activeOptionId =
    showDropdown && results[selectedIndex] ? `search-result-${results[selectedIndex].id}` : undefined;

  const liveMessage =
    state.status === "loading"
      ? "Searching…"
      : state.status === "error"
        ? "Search failed"
        : state.status === "success"
          ? `${state.results.length} ${state.results.length === 1 ? "result" : "results"} found`
          : "";

  return (
    <div className="relative w-full" data-testid="task-search-container">
      <label htmlFor="task-search-input" id={INPUT_LABEL_ID} className="sr-only">
        Search tasks
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id="task-search-input"
          type="text"
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            // Cancel any pending close from a previous blur so a quick
            // refocus (e.g. Escape immediately followed by clicking back
            // into the input) doesn't get closed out from under it later.
            if (blurTimeoutRef.current) {
              clearTimeout(blurTimeoutRef.current);
              blurTimeoutRef.current = null;
            }
            setFocused(true);
          }}
          onBlur={() => {
            blurTimeoutRef.current = setTimeout(() => {
              blurTimeoutRef.current = null;
              setFocused(false);
            }, 200);
          }}
          onKeyDown={handleKeyDown}
          data-testid="task-search-input"
          className="w-full border rounded-lg px-4 py-2 pr-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />

        {/* Loading Spinner */}
        {state.status === "loading" && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="search-spinner" aria-hidden="true">
            <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {/* Search Icon */}
        {state.status !== "loading" && query.length === 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}

        {/* Clear Button */}
        {state.status !== "loading" && query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
            data-testid="search-clear-btn"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* State of the search, announced to assistive tech without visually duplicating the dropdown below */}
      <div className="sr-only" role="status" aria-live="polite">
        {showDropdown ? liveMessage : ""}
      </div>

      {/* Results Dropdown */}
      {showDropdown && (
        <div
          id={LISTBOX_ID}
          role="listbox"
          aria-labelledby={INPUT_LABEL_ID}
          className="absolute top-full left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg max-h-80 overflow-y-auto z-50"
          data-testid="search-results-dropdown"
        >
          {state.status === "loading" && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm" data-testid="search-loading">
              Searching…
            </div>
          )}

          {state.status === "error" && (
            // Kept inside the dropdown so the failure is reported where the
            // results would have been, instead of silently looking like a
            // search that simply found nothing.
            <div className="px-4 py-5 text-center text-sm" data-testid="search-error">
              <p role="alert" className="text-red-700">
                Could not load search results: {state.message}
              </p>
              <button
                type="button"
                // mousedown, like the result rows below, so the click lands
                // before the input's blur handler closes the dropdown.
                onMouseDown={(e) => {
                  e.preventDefault();
                  retry();
                }}
                data-testid="search-retry"
                className="mt-2 underline font-medium text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 rounded"
              >
                Try again
              </button>
            </div>
          )}

          {state.status === "success" && state.results.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500 text-sm" data-testid="search-no-results">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 mx-auto mb-2 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No results for &ldquo;{trimmedQuery}&rdquo;</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}

          {state.status === "success" && state.results.length > 0 && (
            <>
              <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50" aria-hidden="true">
                Found {state.results.length} {state.results.length === 1 ? "result" : "results"}
              </div>
              {state.results.map((task, index) => (
                <div
                  key={task.id}
                  id={`search-result-${task.id}`}
                  role="option"
                  aria-selected={index === selectedIndex}
                  // An explicit name, so the option is announced as the task it
                  // is rather than as the run-together text of its badges.
                  aria-label={`${task.title}, status ${task.status}, priority ${task.priority}`}
                  // Not part of the tab order: this combobox keeps real DOM focus on
                  // the input and drives selection via aria-activedescendant instead.
                  tabIndex={-1}
                  onMouseDown={(e) => {
                    // Use mousedown instead of click so selection happens before
                    // the input's blur handler would otherwise close the dropdown.
                    e.preventDefault();
                    handleSelect(task);
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  data-testid={`search-result-${task.id}`}
                  className={`cursor-pointer w-full text-left px-4 py-3 border-b last:border-b-0 transition-colors ${
                    index === selectedIndex ? "bg-blue-50 border-l-4 border-l-blue-600" : "hover:bg-gray-50"
                  }`}
                >
                  <div className="font-semibold text-gray-900">{task.title}</div>
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded ${
                        task.status === "done"
                          ? "bg-green-100 text-green-800"
                          : task.status === "in-progress"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {task.status}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded ${
                        task.priority === "high"
                          ? "bg-red-100 text-red-800"
                          : task.priority === "medium"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  {task.description && <div className="text-xs text-gray-600 mt-1 line-clamp-1">{task.description}</div>}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Helper Text */}
      {trimmedQuery.length > 0 && trimmedQuery.length < MIN_QUERY_LENGTH && (
        <div className="absolute top-full left-0 right-0 mt-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Type at least {MIN_QUERY_LENGTH} characters to start searching
        </div>
      )}
    </div>
  );
}
