/**
 * Startup failure messages live here, separately from index.ts, so they can be
 * unit-tested: index.ts binds the port as a side effect of being imported, which
 * a test cannot exercise without actually occupying a port.
 */
export function formatStartupError(err: NodeJS.ErrnoException, port: number): string {
  if (err.code === "EADDRINUSE") {
    return (
      `\nPort ${port} is already in use, so the backend could not start.\n` +
      `Another process (often a leftover Node process from an earlier run) is using it.\n` +
      `Stop that process and run "npm run dev" again.\n` +
      `  Windows (PowerShell): netstat -ano | findstr :${port}   then   taskkill /PID <pid> /F\n` +
      `  macOS / Linux:        lsof -i :${port}                  then   kill <pid>\n`
    );
  }

  return `\nThe backend could not start: ${err.message}\n`;
}
