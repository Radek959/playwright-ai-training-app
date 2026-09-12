import { createContext, useContext, useMemo, useCallback, useState, ReactNode } from "react";

type AppErrorState = {
  error?: string;
  setError: (message?: string) => void;
  clearError: () => void;
};

const AppErrorContext = createContext<AppErrorState | null>(null);

export const AppErrorProvider = ({ children }: { children: ReactNode }) => {
  const [error, setError] = useState<string>();

  // clearError/value are memoized so their identity stays stable across
  // renders. Without this, every render (including the one triggered by
  // setError itself) produced a new clearError function; consumers that
  // depend on it in a useEffect dependency array (e.g. Tasks.tsx's initial
  // load effect) would then re-run right after an error was set and
  // immediately clear it again via their own success-path clearError() call.
  const clearError = useCallback(() => setError(undefined), []);

  const value = useMemo<AppErrorState>(
    () => ({ error, setError, clearError }),
    [error, clearError]
  );

  return <AppErrorContext.Provider value={value}>{children}</AppErrorContext.Provider>;
};

export const useAppError = () => {
  const ctx = useContext(AppErrorContext);
  if (!ctx) throw new Error("useAppError must be used inside AppErrorProvider");
  return ctx;
};
