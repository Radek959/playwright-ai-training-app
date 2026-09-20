import { app } from "./app.js";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || "127.0.0.1";

const server = app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});

// Without this handler a busy port produces an unhandled 'error' event: a raw
// stack trace that scrolls past the frontend's startup output, leaving the UI
// running against a backend that never started.
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `\nPort ${port} is already in use, so the backend could not start.\n` +
      `Another process (often a leftover Node process from an earlier run) is using it.\n` +
      `Stop that process and run "npm run dev" again.\n` +
      `  Windows (PowerShell): netstat -ano | findstr :${port}   then   taskkill /PID <pid> /F\n` +
      `  macOS / Linux:        lsof -i :${port}                  then   kill <pid>\n`
    );
  } else {
    console.error(`\nThe backend could not start: ${err.message}\n`);
  }
  process.exit(1);
});
