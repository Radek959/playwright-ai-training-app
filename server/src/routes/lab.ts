import { Router } from "express";
import { labState, LabState } from "../data.js";

export const labRouter = Router();

labRouter.get("/state", (_req, res) => {
  res.json(labState);
});

labRouter.post("/state", (req, res) => {
  const { chaos, a11y, apiFlaky } = req.body as Partial<LabState>;
  if (typeof chaos === "boolean") labState.chaos = chaos;
  if (typeof a11y === "boolean") labState.a11y = a11y;
  if (typeof apiFlaky === "boolean") labState.apiFlaky = apiFlaky;
  res.json(labState);
});
