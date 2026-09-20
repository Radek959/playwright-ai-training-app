import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { waitForHttpOk, waitForPortClosed } from "./ci-smoke.mjs";

/** Starts a throwaway server on a free port and returns its URL plus a stop(). */
function startServer(handler) {
  return new Promise((resolve) => {
    const server = createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/`,
        stop: () => new Promise((done) => server.close(done))
      });
    });
  });
}

describe("waitForHttpOk", () => {
  let ok;
  let failing;

  before(async () => {
    ok = await startServer((_req, res) => res.end('{"status":"ok"}'));
    failing = await startServer((_req, res) => {
      res.statusCode = 503;
      res.end("not ready");
    });
  });

  after(async () => {
    await ok.stop();
    await failing.stop();
  });

  test("returns the response body once the service answers", async () => {
    const body = await waitForHttpOk(ok.url, { timeoutMs: 2000, intervalMs: 10 });
    assert.equal(body, '{"status":"ok"}');
  });

  test("keeps waiting while the service answers with an error status, then times out", async () => {
    await assert.rejects(
      () => waitForHttpOk(failing.url, { timeoutMs: 150, intervalMs: 10 }),
      /did not respond within 150ms \(last attempt: HTTP 503\)/
    );
  });

  test("reports the connection error when nothing is listening at all", async () => {
    const closed = await startServer((_req, res) => res.end("gone"));
    await closed.stop();

    await assert.rejects(
      () => waitForHttpOk(closed.url, { timeoutMs: 150, intervalMs: 10 }),
      /ECONNREFUSED/
    );
  });
});

describe("waitForPortClosed", () => {
  test("is false while something is still listening", async () => {
    const server = await startServer((_req, res) => res.end("still here"));

    assert.equal(await waitForPortClosed(server.url, { timeoutMs: 100, intervalMs: 10 }), false);

    await server.stop();
  });

  test("is true once the port has been released", async () => {
    const server = await startServer((_req, res) => res.end("bye"));
    await server.stop();

    assert.equal(await waitForPortClosed(server.url, { timeoutMs: 1000, intervalMs: 10 }), true);
  });
});
