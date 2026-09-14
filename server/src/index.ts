import { app } from "./app.js";

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const host = process.env.HOST || "127.0.0.1";

app.listen(port, host, () => {
  console.log(`API listening on http://${host}:${port}`);
});
