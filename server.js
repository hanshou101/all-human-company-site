/*
  All-Human Company MVP server

  Goals:
  - Serve static files from ./site
  - Provide tiny JSON APIs used by the pages
  - Provide a minimal MCP-ish JSON-RPC endpoint at POST /mcp

  Design constraints:
  - No external dependencies
  - Avoid obvious security footguns (path traversal, unbounded body)
*/

const http = require("http");
const path = require("path");
const fs = require("fs");
const { URL } = require("url");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number.parseInt(process.env.PORT || "5173", 10);
const SITE_DIR = path.join(__dirname, "site");
const DATA_DIR = path.join(__dirname, "data");

const SERVER_INFO = {
  name: "all-human-company",
  version: "0.1.0",
};

const MAX_BODY_BYTES = 256 * 1024;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj, null, 2);
  send(res, status, { "content-type": "application/json; charset=utf-8" }, body);
}

function sendText(res, status, text) {
  send(res, status, { "content-type": "text/plain; charset=utf-8" }, text);
}

function safeJoin(base, requestPath) {
  // Prevent path traversal by resolving then checking prefix.
  const decoded = decodeURIComponent(requestPath);
  const cleaned = decoded.replace(/\0/g, "");
  const resolved = path.resolve(base, "." + cleaned);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    return null;
  }
  return resolved;
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks = [];
    req.on("data", (buf) => {
      total += buf.length;
      if (total > MAX_BODY_BYTES) {
        reject(new Error("Payload too large"));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function randomInt(min, max) {
  const a = Math.ceil(min);
  const b = Math.floor(max);
  return Math.floor(a + Math.random() * (b - a + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const QUOTES = [
  "To err is human.",
  "I need coffee before I can feel empathy.",
  "A bad day still has a smell.",
  "Inefficient by design.",
  "No GPU can carry legal responsibility.",
];

function heartbeatSnapshot() {
  // Synthetic values for MVP; keep stable-ish between requests.
  const bpm = randomInt(64, 92);
  const onlineHumans = randomInt(8, 47);
  const done = randomInt(2, 19);
  const caf = pick(["critical", "danger", "adequate", "running_on_fumes"]);
  return {
    heartbeat_bpm: bpm,
    online_humans: onlineHumans,
    tasks_completed_today: done,
    caffeine_level: caf,
    updated_at: nowIso(),
  };
}

function writeSubmission(kind, payload) {
  ensureDataDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const id = `${kind}-${stamp}-${Math.random().toString(16).slice(2, 8)}`;
  const filePath = path.join(DATA_DIR, `${id}.json`);
  const record = {
    id,
    kind,
    received_at: nowIso(),
    payload,
  };
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), "utf8");
  return { id };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function listTools() {
  return [
    {
      name: "allhuman_get_heartbeat",
      description: "Get a synthetic heartbeat/status snapshot for the All-Human Company.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          response_format: {
            type: "string",
            enum: ["markdown", "json"],
            default: "markdown",
          },
        },
      },
    },
    {
      name: "allhuman_get_quote",
      description: "Return a short human quote; good for playful liveness checks.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          response_format: {
            type: "string",
            enum: ["markdown", "json"],
            default: "markdown",
          },
        },
      },
    },
    {
      name: "allhuman_submit_join",
      description: "Submit a human application to join the All-Human Company (stored locally).",
      inputSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          nickname: { type: "string" },
          city: { type: "string" },
          time_window: { type: "string" },
          skills: { type: "string" },
          weird_task: { type: "string" },
          price_range: { type: "string" },
          contact: { type: "string" },
          reverse_turing: { type: "string" },
        },
        required: ["contact"],
      },
    },
    {
      name: "allhuman_submit_request",
      description: "Submit a task request from a buyer (stored locally).",
      inputSchema: {
        type: "object",
        additionalProperties: true,
        properties: {
          goal: { type: "string" },
          action: { type: "string" },
          location_time: { type: "string" },
          budget: { type: "string" },
          contact: { type: "string" },
        },
        required: ["goal", "contact"],
      },
    },
  ];
}

function toolCall(name, args) {
  const fmt = args && args.response_format ? String(args.response_format) : "markdown";
  if (name === "allhuman_get_heartbeat") {
    const snap = heartbeatSnapshot();
    const text =
      fmt === "json"
        ? JSON.stringify(snap, null, 2)
        : [
            `# All-Human Heartbeat`,
            `- **Humans Online**: ${snap.online_humans}`,
            `- **Biological HrtRt**: ${snap.heartbeat_bpm} bpm`,
            `- **Tasks Completed Today**: ${snap.tasks_completed_today}`,
            `- **Caffeine Level**: ${snap.caffeine_level}`,
            `- **Updated**: ${snap.updated_at}`,
          ].join("\n");
    return {
      content: [{ type: "text", text }],
      structuredContent: snap,
    };
  }

  if (name === "allhuman_get_quote") {
    const out = { quote: pick(QUOTES), at: nowIso() };
    const text = fmt === "json" ? JSON.stringify(out, null, 2) : `# Quote\n\n${out.quote}`;
    return {
      content: [{ type: "text", text }],
      structuredContent: out,
    };
  }

  if (name === "allhuman_submit_join") {
    const payload = args && typeof args === "object" ? args : {};
    if (!payload.contact || String(payload.contact).trim().length < 3) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: 'contact' is required." }],
      };
    }
    const id = writeSubmission("join", payload);
    return {
      content: [{ type: "text", text: `OK: received (id=${id.id})` }],
      structuredContent: id,
    };
  }

  if (name === "allhuman_submit_request") {
    const payload = args && typeof args === "object" ? args : {};
    if (!payload.goal || String(payload.goal).trim().length < 3) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: 'goal' is required." }],
      };
    }
    if (!payload.contact || String(payload.contact).trim().length < 3) {
      return {
        isError: true,
        content: [{ type: "text", text: "Error: 'contact' is required." }],
      };
    }
    const id = writeSubmission("request", payload);
    return {
      content: [{ type: "text", text: `OK: received (id=${id.id})` }],
      structuredContent: id,
    };
  }

  return {
    isError: true,
    content: [{ type: "text", text: `Error: unknown tool '${name}'.` }],
  };
}

async function handleMcp(req, res) {
  let raw;
  try {
    raw = await readBody(req);
  } catch (e) {
    sendJson(res, 413, { error: e.message });
    return;
  }

  let msg;
  try {
    msg = JSON.parse(raw || "{}");
  } catch {
    sendJson(res, 400, { error: "Invalid JSON" });
    return;
  }

  // Minimal JSON-RPC 2.0
  if (!msg || msg.jsonrpc !== "2.0" || typeof msg.method !== "string") {
    sendJson(res, 200, jsonRpcError(msg ? msg.id : null, -32600, "Invalid Request"));
    return;
  }

  const id = msg.id;
  const method = msg.method;
  const params = msg.params;

  if (method === "initialize") {
    const result = {
      protocolVersion: "2025-11-25",
      serverInfo: SERVER_INFO,
      capabilities: {
        tools: {},
      },
    };
    sendJson(res, 200, jsonRpcResult(id, result));
    return;
  }

  if (method === "tools/list") {
    sendJson(res, 200, jsonRpcResult(id, { tools: listTools() }));
    return;
  }

  if (method === "tools/call") {
    const toolName = params && typeof params.name === "string" ? params.name : "";
    const args = params && typeof params.arguments === "object" ? params.arguments : {};
    if (!toolName) {
      sendJson(res, 200, jsonRpcResult(id, { isError: true, content: [{ type: "text", text: "Missing tool name" }] }));
      return;
    }
    const out = toolCall(toolName, args);
    sendJson(res, 200, jsonRpcResult(id, out));
    return;
  }

  // Notifications have no response.
  if (method.startsWith("notifications/")) {
    res.writeHead(204);
    res.end();
    return;
  }

  sendJson(res, 200, jsonRpcError(id, -32601, "Method not found"));
}

async function handleApi(req, res, pathname) {
  if (req.method === "GET" && pathname === "/api/heartbeat") {
    sendJson(res, 200, heartbeatSnapshot());
    return;
  }

  if (req.method === "GET" && pathname === "/api/quote") {
    sendJson(res, 200, { quote: pick(QUOTES), at: nowIso() });
    return;
  }

  if (req.method === "POST" && (pathname === "/api/join" || pathname === "/api/request")) {
    let raw;
    try {
      raw = await readBody(req);
    } catch (e) {
      sendJson(res, 413, { error: e.message });
      return;
    }
    let payload;
    try {
      payload = JSON.parse(raw || "{}");
    } catch {
      sendJson(res, 400, { error: "Invalid JSON" });
      return;
    }
    if (!payload || typeof payload !== "object") {
      sendJson(res, 400, { error: "Invalid payload" });
      return;
    }

    const kind = pathname === "/api/join" ? "join" : "request";
    // Minimal checks to keep junk down.
    if (typeof payload.contact !== "string" || payload.contact.trim().length < 3) {
      sendJson(res, 400, { error: "contact is required" });
      return;
    }
    if (kind === "request" && (typeof payload.goal !== "string" || payload.goal.trim().length < 3)) {
      sendJson(res, 400, { error: "goal is required" });
      return;
    }
    const id = writeSubmission(kind, payload);
    sendJson(res, 200, { ok: true, id: id.id });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
}

function serveStatic(req, res, pathname) {
  const wantedPath = pathname === "/" ? "/index.html" : pathname;
  let filePath = safeJoin(SITE_DIR, wantedPath);
  if (!filePath) {
    sendText(res, 403, "Forbidden");
    return;
  }

  // Directory -> index.html
  try {
    const st = fs.statSync(filePath);
    if (st.isDirectory()) {
      const idx = path.join(filePath, "index.html");
      if (fs.existsSync(idx)) filePath = idx;
    }
  } catch {
    // fallthrough
  }

  // Friendly extension-less routes: /join -> /join.html
  if ((!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) && !wantedPath.endsWith("/")) {
    const alt = safeJoin(SITE_DIR, wantedPath + ".html");
    if (alt && fs.existsSync(alt) && fs.statSync(alt).isFile()) {
      filePath = alt;
    }
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const notFound = path.join(SITE_DIR, "404.html");
    if (fs.existsSync(notFound)) {
      const body = fs.readFileSync(notFound);
      send(res, 404, { "content-type": "text/html; charset=utf-8" }, body);
      return;
    }
    sendText(res, 404, "Not found");
    return;
  }

  const body = fs.readFileSync(filePath);
  send(res, 200, { "content-type": contentTypeFor(filePath) }, body);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || "/", `http://${HOST}:${PORT}`);
  const pathname = u.pathname;

  // CORS for local testing / agent calls.
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === "/mcp" && req.method === "POST") {
    await handleMcp(req, res);
    return;
  }

  if (pathname.startsWith("/api/")) {
    await handleApi(req, res, pathname);
    return;
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  // Use stderr so stdio MCP would not be corrupted if adapted.
  console.error(`[all-human] listening on http://${HOST}:${PORT}`);
});
