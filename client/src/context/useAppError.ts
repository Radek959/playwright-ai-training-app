import { useContext } from "react";
import { AppErrorContext } from "./appErrorContext";

export const useAppError = () => {
  const ctx = useContext(AppErrorContext);
  if (!ctx) throw new Error("useAppError must be used inside AppErrorProvider");
  return ctx;
};
