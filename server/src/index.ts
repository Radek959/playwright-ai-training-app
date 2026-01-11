import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import swaggerDoc from "./swagger.json" assert { type: "json" };
import { tasksRouter } from "./routes/tasks.js";
import { usersRouter } from "./routes/users.js";
import { labRouter } from "./routes/lab.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files (images for avatars and task covers)
app.use("/images", express.static(path.join(__dirname, "../public/images")));

app.use("/api/tasks", tasksRouter);
app.use("/api/users", usersRouter);
app.use("/api/lab", labRouter);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDoc));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`API listening on :${port}`);
});
