import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { connect } from "node:net";
import test from "node:test";
import { Effect } from "effect";
import { Config, UnavailableError, YouTube, resolveConfig } from "../src/index.js";

const listen = (server: Server): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        reject(new Error("Server did not receive a TCP port"));
        return;
      }
      resolve(address.port);
    });
  });

const close = (server: Server): Promise<void> =>
  new Promise((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );

test("proxy tunnels requests and sends configured authentication", async () => {
  const target = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("through proxy");
  });
  const targetPort = await listen(target);

  let connections = 0;
  let authorization: string | undefined;
  const proxy = createServer();
  proxy.on("connect", (request, clientSocket, head) => {
    connections += 1;
    authorization = request.headers["proxy-authorization"];

    const [host, rawPort] = (request.url ?? "").split(":");
    const upstream = connect(Number(rawPort), host, () => {
      clientSocket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length > 0) upstream.write(head);
      upstream.pipe(clientSocket);
      clientSocket.pipe(upstream);
    });
  });
  const proxyPort = await listen(proxy);

  try {
    const body = await Effect.runPromise(
      Effect.gen(function* () {
        const config = yield* Config;
        const response = yield* Effect.promise(() =>
          config.fetch(`http://127.0.0.1:${targetPort}/health`),
        );
        return yield* Effect.promise(() => response.text());
      }).pipe(
        Effect.provide(
          Config.layer({ proxy: `http://user:secret@127.0.0.1:${proxyPort}` }),
        ),
      ),
    );

    assert.equal(body, "through proxy");
    assert.equal(connections, 1);
    assert.equal(
      authorization,
      `Basic ${Buffer.from("user:secret").toString("base64")}`,
    );
  } finally {
    await Promise.all([close(proxy), close(target)]);
  }
});

test("proxy validates its URL and cannot be combined with fetch", () => {
  assert.throws(
    () => resolveConfig({ proxy: "socks5://127.0.0.1:1080" }),
    /http: or https:/,
  );
  assert.throws(
    () => resolveConfig({ proxy: "http://127.0.0.1:8080", fetch }),
    /proxy and fetch cannot be configured together/,
  );
});

test("transcript reports a player refusal as unavailable", async () => {
  const youtube = new YouTube({
    generateSessionLocally: true,
    retrieveInnertubeConfig: false,
    retries: 0,
    fetch: async () =>
      new Response(
        JSON.stringify({
          playabilityStatus: {
            status: "LOGIN_REQUIRED",
            reason: "Sign in to confirm you're not a bot",
          },
        }),
        { headers: { "content-type": "application/json" } },
      ),
  });

  try {
    await assert.rejects(
      youtube.transcript("hlSTGypn1dQ"),
      (error) =>
        error instanceof UnavailableError &&
        error.status === "LOGIN_REQUIRED" &&
        error.reason === "Sign in to confirm you're not a bot",
    );
  } finally {
    await youtube.close();
  }
});
