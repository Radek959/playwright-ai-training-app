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

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

if (process.env.ALLOWED_ORIGINS) {
  const extraOrigins = process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  allowedOrigins.push(...extraOrigins);
}

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (like mobile apps, curl, or swagger)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error("Not allowed by CORS"));
    }
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
