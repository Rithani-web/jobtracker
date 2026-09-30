#!/usr/bin/env node
// PostToolUse hook: run `eslint --fix` on the .ts/.tsx file Claude just
// wrote or edited, so formatting/lint style settles without a follow-up ask.
//
// Exit codes: 0 = done (fixed, or nothing to do) — silent.
//             2 = eslint fixed what it could but unfixable errors remain;
//                 stderr shows them so Claude can fix them immediately.
// Any tooling failure (eslint missing, config error, crash, timeout) fails
// OPEN with exit 0 — a broken hook must never wedge the session.
//
// This repo has three eslint projects: the root Next.js app, backend/, and
// frontend/ (each with its own node_modules and flat config). The file is
// linted with the eslint that owns it.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const TIMEOUT_MS = 30000;

let raw;
try {
  raw = fs.readFileSync(0, "utf8");
} catch {
  process.exit(0);
}
let event;
try {
  event = JSON.parse(raw);
} catch {
  process.exit(0);
}

const file = (event.tool_input || {}).file_path || "";
if (!/\.(ts|tsx)$/i.test(file)) process.exit(0); // only TS sources — instant no-op otherwise

const root = event.cwd || process.cwd();
const rel = path.relative(root, file);
if (rel.startsWith("..")) process.exit(0); // file outside the project — not ours

// Which eslint owns this file? backend/ and frontend/ are standalone projects.
const parts = rel.split(path.sep);
const sub = ["backend", "frontend"].includes(parts[0]) ? parts[0] : "";
const projectRoot = sub ? path.join(root, sub) : root;
const eslintBin = path.join(projectRoot, "node_modules", "eslint", "bin", "eslint.js");
if (!fs.existsSync(eslintBin)) process.exit(0); // no local eslint — skip quietly

let res;
try {
  res = spawnSync(process.execPath, [eslintBin, "--fix", file], {
    cwd: projectRoot,
    timeout: TIMEOUT_MS,
    encoding: "utf8",
  });
} catch {
  process.exit(0);
}

// status 0 = clean (fixes applied if any); null = killed/timeout; >=2 = eslint
// fatal (bad config etc.) — all fail-open except the "errors remain" case.
if (!res || res.error || res.status === null || res.status >= 2) process.exit(0);

if (res.status === 1) {
  const out = `${res.stdout || ""}${res.stderr || ""}`.trim();
  const tail = out.split("\n").slice(-20).join("\n");
  console.error(`eslint --fix ran on ${file} but unfixable errors remain:\n${tail}`);
  process.exit(2);
}

process.exit(0);
