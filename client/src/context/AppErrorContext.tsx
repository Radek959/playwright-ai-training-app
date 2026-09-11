import { createContext, useContext, useState, ReactNode } from "react";

type AppErrorState = {
  error?: string;
  setError: (message?: string) => void;
  clearError: () => void;
};

const AppErrorContext = createContext<AppErrorState | null>(null);

export const AppErrorProvider = ({ children }: { children: ReactNode }) => {
  const [error, setError] = useState<string>();

  const value: AppErrorState = {
    error,
    setError,
    clearError: () => setError(undefined)
  };

  return <AppErrorContext.Provider value={value}>{children}</AppErrorContext.Provider>;
};

export const useAppError = () => {
  const ctx = useContext(AppErrorContext);
  if (!ctx) throw new Error("useAppError must be used inside AppErrorProvider");
  return ctx;
};
