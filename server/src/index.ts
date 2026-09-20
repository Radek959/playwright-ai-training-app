import { app } from "./app.js";
import { formatStartupError } from "./startupErrors.js";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || "127.0.0.1";

const server = app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});

// Without this handler a busy port produces an unhandled 'error' event: a raw
// stack trace that scrolls past the frontend's startup output, leaving the UI
// running against a backend that never started.
server.on("error", (err: NodeJS.ErrnoException) => {
  console.error(formatStartupError(err, port));
  process.exit(1);
});
