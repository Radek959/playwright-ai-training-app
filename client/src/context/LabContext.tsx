import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode
} from "react";

type LabFlags = {
  chaos: boolean;
  a11y: boolean;
  apiFlaky: boolean;
  refactorSelectors: boolean;
};

type LabState = LabFlags & {
  setFlag: <K extends keyof LabFlags>(key: K, value: boolean) => void;
  lastError?: string;
  setLastError: (err?: string) => void;
  refreshToken: number;
};

const LabContext = createContext<LabState | null>(null);

const STORAGE_KEY = "lab-flags";

const parseBool = (value: string | null) => value === "true" || value === "1" || value === "yes";

export const LabProvider = ({ children }: { children: ReactNode }) => {
  const [flags, setFlags] = useState<LabFlags>({
    chaos: false,
    a11y: false,
    apiFlaky: false,
    refactorSelectors: false
  });
  const [lastError, setLastError] = useState<string>();
  const [refreshToken, setRefreshToken] = useState<number>(Date.now());

  // hydrate from localStorage once
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<LabFlags>;
        setFlags((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // apply URL query flags (invisible control)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next: Partial<LabFlags> = {};
    if (params.has("lab_chaos")) next.chaos = parseBool(params.get("lab_chaos"));
    if (params.has("lab_a11y")) next.a11y = parseBool(params.get("lab_a11y"));
    if (params.has("lab_api_flaky")) next.apiFlaky = parseBool(params.get("lab_api_flaky"));
    if (params.has("lab_refactor_selectors")) next.refactorSelectors = parseBool(params.get("lab_refactor_selectors"));
    if (Object.keys(next).length) {
      setFlags((prev) => ({ ...prev, ...next }));
      setRefreshToken(Date.now());
    }
  }, []);

  // fetch lab state from API (invisible control via backend)
  useEffect(() => {
    const fetchLab = async () => {
      try {
        const res = await fetch("/api/lab/state");
        if (!res.ok) return;
        const data = (await res.json()) as Partial<LabFlags>;
        setFlags((prev) => {
          // Only update if data actually changed
          const hasChanges = Object.keys(data).some(
            (key) => data[key as keyof LabFlags] !== prev[key as keyof LabFlags]
          );
          if (hasChanges) {
            setRefreshToken(Date.now());
            return { ...prev, ...data };
          }
          return prev;
        });
      } catch {
        /* ignore */
      }
    };
    fetchLab();
    const id = setInterval(fetchLab, 10000);
    return () => clearInterval(id);
  }, []);

  // persist on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(flags));
    } catch {
      /* ignore */
    }
  }, [flags]);

  // push state to API when flags change locally
  useEffect(() => {
    const sync = async () => {
      try {
        await fetch("/api/lab/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(flags)
        });
      } catch {
        /* ignore */
      }
    };
    sync();
  }, [flags]);

  const value = useMemo<LabState>(
    () => ({
      ...flags,
      setFlag: (key, value) => {
        setFlags((prev) => ({ ...prev, [key]: value }));
        setRefreshToken(Date.now());
      },
      lastError,
      setLastError,
      refreshToken
    }),
    [flags, lastError, refreshToken]
  );

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>;
};

export const useLab = () => {
  const ctx = useContext(LabContext);
  if (!ctx) throw new Error("useLab must be used inside LabProvider");
  return ctx;
};
