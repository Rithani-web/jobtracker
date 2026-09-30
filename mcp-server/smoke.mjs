#!/usr/bin/env node
// Smoke test for jobtracker-mcp: spawns the stdio server, performs an MCP
// handshake, lists tools, and calls the read tools against the live DB.
// Run: node mcp-server/smoke.mjs   (from the mcp-server/ directory)

import { spawn } from "node:child_process";

const child = spawn(process.execPath, ["dist/index.js"], { stdio: ["pipe", "pipe", "pipe"] });
child.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));

let counter = 0;
const pending = new Map();
let buf = "";
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx);
    buf = buf.slice(idx + 1);
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + "\n");
const withTimeout = (p, ms = 15000) =>
  Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

function rpc(method, params) {
  return new Promise((resolve) => {
    const id = ++counter;
    pending.set(id, resolve);
    send({ jsonrpc: "2.0", id, method, params });
  });
}

try {
  const init = await withTimeout(
    rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.0.0" },
    }),
  );
  console.log("handshake ok:", init.result.serverInfo.name, init.result.serverInfo.version);
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  const tools = await withTimeout(rpc("tools/list", {}));
  console.log("tools:", tools.result.tools.map((t) => t.name).join(", "));

  const sum = await withTimeout(rpc("tools/call", { name: "dashboard_summary", arguments: {} }));
  console.log("dashboard_summary:", sum.result.content[0].text.replace(/\s+/g, " ").slice(0, 300));

  const apps = await withTimeout(rpc("tools/call", { name: "list_applications", arguments: { limit: 5 } }));
  const rows = JSON.parse(apps.result.content[0].text);
  console.log(`list_applications: ${rows.length} row(s)` +
    (rows[0] ? `, first: ${rows[0].company} — ${rows[0].role} [${rows[0].status}]` : ""));
  console.log("SMOKE PASS");
} catch (e) {
  console.error("SMOKE FAIL:", e.message);
  process.exitCode = 1;
} finally {
  child.kill();
}
