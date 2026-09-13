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

app.use(cors());
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
