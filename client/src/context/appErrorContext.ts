import { createContext } from "react";

export type AppErrorState = {
  error?: string;
  setError: (message?: string) => void;
  clearError: () => void;
};

export const AppErrorContext = createContext<AppErrorState | null>(null);
