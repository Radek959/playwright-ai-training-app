import { useState, useEffect, useRef } from "react";
import type { Task } from "../types";

type Props = {
  onSelect: (task: Task) => void;
  placeholder?: string;
};

const LISTBOX_ID = "task-search-listbox";
const INPUT_LABEL_ID = "task-search-label";

export function TaskSearch({ onSelect, placeholder = "Search tasks..." }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Created synchronously so the effect cleanup below can abort it the
    // instant the query changes again, rather than waiting for the next
    // debounce window to elapse before cancelling the stale request.
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/tasks/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal
        });
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        if (controller.signal.aborted) return;
        setResults(data);
        setSelectedIndex(0);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Search error:", error);
        setResults([]);
      } finally {
        // A stale/aborted request must never flip off the loading state
        // that belongs to a newer, still-pending query.
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    } else if (e.key === "Escape") {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleSelect = (task: Task) => {
    onSelect(task);
    setQuery("");
    setResults([]);
    setFocused(false);
    inputRef.current?.blur();
  };

  const showDropdown = focused && (results.length > 0 || (query.length >= 2 && !loading));
  const activeOptionId = showDropdown && results[selectedIndex] ? `search-result-${results[selectedIndex].id}` : undefined;

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
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          data-testid="task-search-input"
          className="w-full border rounded-lg px-4 py-2 pr-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        />

        {/* Loading Spinner */}
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="search-spinner" aria-hidden="true">
            <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {/* Search Icon */}
        {!loading && query.length === 0 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        )}

        {/* Clear Button */}
        {!loading && query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
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

      {/* Result count, announced to assistive tech without visually duplicating the header below */}
      <div className="sr-only" role="status" aria-live="polite">
        {showDropdown && !loading
          ? `${results.length} ${results.length === 1 ? "result" : "results"} found`
          : ""}
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
          {results.length > 0 ? (
            <>
              <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50" aria-hidden="true">
                Found {results.length} {results.length === 1 ? "result" : "results"}
              </div>
              {results.map((task, index) => (
                <div
                  key={task.id}
                  id={`search-result-${task.id}`}
                  role="option"
                  aria-selected={index === selectedIndex}
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
          ) : (
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
              <p>No results for &ldquo;{query}&rdquo;</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      )}

      {/* Helper Text */}
      {query.length === 1 && (
        <div className="absolute top-full left-0 right-0 mt-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
          Type at least 2 characters to start searching
        </div>
      )}
    </div>
  );
}
