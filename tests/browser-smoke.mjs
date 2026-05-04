import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const chromeBinary = process.env.CHROME_BIN || "/usr/bin/google-chrome";

function maybeSkipUnsupportedChrome() {
  if (process.env.CHROME_BIN) {
    return;
  }

  const result = spawnSync(chromeBinary, ["--version"], { encoding: "utf8" });
  const versionText = `${result.stdout || ""}${result.stderr || ""}`;
  const match = /Google Chrome\s+([0-9]+)/.exec(versionText);

  if (match && Number(match[1]) >= 137) {
    console.log("Skipping browser smoke test: branded Google Chrome 137+ disables CLI extension loading. Set CHROME_BIN to Chrome for Testing or Chromium to run it.");
    process.exit(0);
  }
}

function makeUserDataDir() {
  if (chromeBinary.includes("/snap/bin/")) {
    const baseDir = path.join(os.homedir(), "snap", "chromium", "common", "codex-test-profiles");
    fs.mkdirSync(baseDir, { recursive: true });
    return fs.mkdtempSync(path.join(baseDir, "os-header-switcher-chrome-"));
  }

  return fs.mkdtempSync(path.join(os.tmpdir(), "os-header-switcher-chrome-"));
}

function runChrome(args) {
  return new Promise((resolve, reject) => {
    const chrome = spawn(chromeBinary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";

    chrome.stdout.on("data", (chunk) => {
      output += chunk;
    });
    chrome.stderr.on("data", (chunk) => {
      output += chunk;
    });
    chrome.on("error", reject);
    chrome.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Chrome exited with ${code}\n${output}`));
        return;
      }

      resolve(output);
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function launchChrome(args) {
  return new Promise((resolve, reject) => {
    const chrome = spawn(chromeBinary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    let resolved = false;

    const timer = setTimeout(() => {
      if (!resolved) {
        chrome.kill("SIGTERM");
        reject(new Error(`Timed out waiting for DevTools URL.\n${output}`));
      }
    }, 10000);

    function handleData(chunk) {
      output += chunk;
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(output);

      if (match && !resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve({
          process: chrome,
          wsUrl: new URL(match[1]),
          close: () => closeChrome(chrome)
        });
      }
    }

    chrome.stdout.on("data", handleData);
    chrome.stderr.on("data", handleData);
    chrome.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    chrome.on("close", (code) => {
      if (!resolved) {
        clearTimeout(timer);
        reject(new Error(`Chrome exited before DevTools became available: ${code}\n${output}`));
      }
    });
  });
}

function closeChrome(chrome) {
  if (chrome.exitCode !== null || chrome.signalCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.kill("SIGKILL");
    }, 5000);

    chrome.once("close", () => {
      clearTimeout(timer);
      resolve();
    });
    chrome.kill("SIGTERM");
  });
}

class CDPConnection {
  constructor(socket, initialBuffer = Buffer.alloc(0)) {
    this.socket = socket;
    this.buffer = initialBuffer;
    this.nextId = 1;
    this.pending = new Map();

    this.socket.on("data", (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.readFrames();
    });
    this.socket.on("close", () => {
      for (const { reject } of this.pending.values()) {
        reject(new Error("CDP socket closed."));
      }
      this.pending.clear();
    });

    this.readFrames();
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const message = { id, method, params };

    if (sessionId) {
      message.sessionId = sessionId;
    }

    this.socket.write(encodeWebSocketFrame(JSON.stringify(message)));

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
  }

  close() {
    this.socket.end();
  }

  readFrames() {
    while (this.buffer.length >= 2) {
      const firstByte = this.buffer[0];
      const secondByte = this.buffer[1];
      const opcode = firstByte & 0x0f;
      const masked = (secondByte & 0x80) !== 0;
      let payloadLength = secondByte & 0x7f;
      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < offset + 2) {
          return;
        }
        payloadLength = this.buffer.readUInt16BE(offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (this.buffer.length < offset + 8) {
          return;
        }
        payloadLength = Number(this.buffer.readBigUInt64BE(offset));
        offset += 8;
      }

      const maskOffset = masked ? 4 : 0;
      const frameLength = offset + maskOffset + payloadLength;

      if (this.buffer.length < frameLength) {
        return;
      }

      let payload = this.buffer.subarray(offset + maskOffset, frameLength);

      if (masked) {
        const mask = this.buffer.subarray(offset, offset + 4);
        payload = Buffer.from(payload, (byte, index) => byte ^ mask[index % 4]);
      }

      this.buffer = this.buffer.subarray(frameLength);

      if (opcode === 0x1) {
        this.handleMessage(JSON.parse(payload.toString("utf8")));
      } else if (opcode === 0x8) {
        this.socket.end();
      }
    }
  }

  handleMessage(message) {
    if (!message.id || !this.pending.has(message.id)) {
      return;
    }

    const { resolve, reject } = this.pending.get(message.id);
    this.pending.delete(message.id);

    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
      return;
    }

    resolve(message.result);
  }
}

function encodeWebSocketFrame(message) {
  const payload = Buffer.from(message);
  const mask = crypto.randomBytes(4);
  const header = [];

  header.push(0x81);

  if (payload.length < 126) {
    header.push(0x80 | payload.length);
  } else if (payload.length < 65536) {
    header.push(0x80 | 126, (payload.length >> 8) & 0xff, payload.length & 0xff);
  } else {
    throw new Error("CDP message too large.");
  }

  const maskedPayload = Buffer.alloc(payload.length);

  for (let index = 0; index < payload.length; index += 1) {
    maskedPayload[index] = payload[index] ^ mask[index % 4];
  }

  return Buffer.concat([Buffer.from(header), mask, maskedPayload]);
}

function connectWebSocket(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(Number(wsUrl.port), wsUrl.hostname);
    const key = crypto.randomBytes(16).toString("base64");
    let buffer = Buffer.alloc(0);

    socket.on("connect", () => {
      socket.write([
        `GET ${wsUrl.pathname} HTTP/1.1`,
        `Host: ${wsUrl.host}`,
        "Upgrade: websocket",
        "Connection: Upgrade",
        `Sec-WebSocket-Key: ${key}`,
        "Sec-WebSocket-Version: 13",
        "",
        ""
      ].join("\r\n"));
    });

    socket.on("data", function onHandshakeData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      const headerEnd = buffer.indexOf("\r\n\r\n");

      if (headerEnd === -1) {
        return;
      }

      const header = buffer.subarray(0, headerEnd).toString("utf8");

      if (!/^HTTP\/1\.1 101 /.test(header)) {
        reject(new Error(`WebSocket upgrade failed.\n${header}`));
        socket.destroy();
        return;
      }

      socket.off("data", onHandshakeData);
      resolve(new CDPConnection(socket, buffer.subarray(headerEnd + 4)));
    });

    socket.on("error", reject);
  });
}

function startEchoServer() {
  let capturedHeaders;

  const server = http.createServer((request, response) => {
    capturedHeaders = request.headers;
    response.writeHead(200, { "content-type": "text/html" });
    response.end("<!doctype html><title>ok</title><p>ok</p>");
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}/`,
        close: () => new Promise((closeResolve) => server.close(closeResolve)),
        getHeaders: () => capturedHeaders,
        reset: () => {
          capturedHeaders = undefined;
        }
      });
    });
  });
}

function discoverExtensionId(userDataDir) {
  const preferencesPath = path.join(userDataDir, "Default", "Preferences");
  const preferences = JSON.parse(fs.readFileSync(preferencesPath, "utf8"));
  const extensionSettings = preferences.extensions?.settings || {};

  for (const [extensionId, settings] of Object.entries(extensionSettings)) {
    if (
      settings.manifest?.name === "OS Header Switcher" ||
      (settings.path && path.resolve(settings.path) === repoRoot)
    ) {
      return extensionId;
    }
  }

  const summary = Object.entries(extensionSettings).map(([extensionId, settings]) => ({
    extensionId,
    name: settings.manifest?.name,
    path: settings.path,
    location: settings.location
  }));

  throw new Error(`Unable to discover loaded extension id. Extension settings: ${JSON.stringify(summary)}`);
}

async function setTargetOS(extensionId, targetOS) {
  const chrome = await launchChrome([
    ...baseArgs,
    "--remote-debugging-port=0",
    "about:blank"
  ]);

  try {
    const cdp = await connectWebSocket(chrome.wsUrl);
    const { targetId } = await cdp.send("Target.createTarget", {
      url: `chrome-extension://${extensionId}/popup/popup.html`
    });
    const { sessionId } = await cdp.send("Target.attachToTarget", {
      targetId,
      flatten: true
    });
    await delay(1000);
    const expression = `(async () => {
      if (location.protocol !== "chrome-extension:" || !chrome.storage?.local) {
        throw new Error("Extension storage API is unavailable at " + location.href);
      }
      await chrome.storage.local.set({ targetOS: ${JSON.stringify(targetOS)} });
      const response = await chrome.runtime.sendMessage({ type: "sync-header-rule" });
      if (!response || !response.ok) {
        throw new Error(response && response.error || "Unable to update header rule.");
      }
      return response.targetOS;
    })()`;
    const result = await cdp.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);

    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }

    assert.equal(result.result.value, targetOS);
    cdp.close();
  } finally {
    await chrome.close();
  }
}

async function assertRequestHeaders(expectation) {
  server.reset();

  await runChrome([...baseArgs, "--dump-dom", server.url]);

  const headers = server.getHeaders();
  assert.ok(headers, "local server did not receive a request");
  assert.match(headers["user-agent"], expectation.userAgentOS);
  assert.match(headers["user-agent"], /Chrome\/[0-9]+(?:\.[0-9]+){0,3}/);
  assert.equal(headers["sec-ch-ua-platform"], expectation.platform);
}

maybeSkipUnsupportedChrome();

const userDataDir = makeUserDataDir();

const baseArgs = [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--disable-background-networking",
  "--disable-sync",
  `--user-data-dir=${userDataDir}`,
  `--disable-extensions-except=${repoRoot}`,
  `--load-extension=${repoRoot}`
];

const server = await startEchoServer();

try {
  await runChrome([...baseArgs, "--dump-dom", "about:blank"]);
  const extensionId = discoverExtensionId(userDataDir);

  await assertRequestHeaders({
    userAgentOS: /Windows NT 10\.0; Win64; x64/,
    platform: "\"Windows\""
  });

  await setTargetOS(extensionId, "macos");
  await assertRequestHeaders({
    userAgentOS: /Macintosh; Intel Mac OS X 10_15_7/,
    platform: "\"macOS\""
  });

  await setTargetOS(extensionId, "linux");
  await assertRequestHeaders({
    userAgentOS: /X11; Linux x86_64/,
    platform: "\"Linux\""
  });
} finally {
  await server.close();
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
