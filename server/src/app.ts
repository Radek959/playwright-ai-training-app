import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./swagger.json" assert { type: "json" };
import { tasksRouter } from "./routes/tasks.js";
import { usersRouter } from "./routes/users.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

const baseAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

function parseExtraOrigins(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

function getAllowedOrigins(): string[] {
  // Read ALLOWED_ORIGINS on every call (rather than once at module load) so
  // it can be reconfigured per-request in tests without recreating the app.
  const extraOrigins = parseExtraOrigins(process.env.ALLOWED_ORIGINS);
  return Array.from(new Set([...baseAllowedOrigins, ...extraOrigins]));
}

// Reject disallowed origins with a controlled 403 JSON response before the
// cors middleware runs, instead of letting it throw and fall through to
// Express's default error handler (which would return a 500 with a stack
// trace or HTML body).
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && !getAllowedOrigins().includes(origin)) {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, or swagger);
    // any other origin has already been validated by the middleware above.
    return callback(null, true);
  }
}));
app.use(express.json());

// Malformed JSON bodies should still come back as a controlled JSON 400,
// not Express's default HTML error page.
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      error: "Validation failed",
      details: [{ field: "body", message: "request body must be valid JSON" }]
    });
  }
  next(err);
});

// Serve static files (images for avatars and task covers)
app.use("/images", express.static(path.join(__dirname, "../public/images")));

app.use("/api/tasks", tasksRouter);
app.use("/api/users", usersRouter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
