#!/usr/bin/env node
// Status line: "dir | git branch | model"
//
// Claude Code pipes the session payload as JSON on stdin, e.g.:
//   { "model": { "id": "...", "display_name": "Sonnet" },
//     "workspace": { "current_dir": "...", "project_dir": "..." },
//     "cwd": "..." }
//
// Rules for a status line script:
// - Never trust process.cwd() — resolve everything from the payload.
// - Never crash: any failure degrades to "?" / a dropped segment.
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

let raw = "";
try {
  raw = fs.readFileSync(0, "utf8");
} catch {}
let d = {};
try {
  d = JSON.parse(raw || "{}");
} catch {}

const dir =
  (d.workspace && (d.workspace.current_dir || d.workspace.project_dir)) ||
  d.cwd ||
  "";
const dirName = dir ? path.basename(dir) : "?";

const model = (d.model && (d.model.display_name || d.model.id)) || "?";

let branch = "";
if (dir) {
  const run = (args) => {
    try {
      return execFileSync("git", ["-C", dir, ...args], {
        encoding: "utf8",
        timeout: 2000,
        stdio: ["ignore", "pipe", "ignore"], // keep git's stderr out of the UI
      }).trim();
    } catch {
      return "";
    }
  };
  branch = run(["branch", "--show-current"]);
  if (!branch) branch = run(["rev-parse", "--short", "HEAD"]); // detached HEAD
}

process.stdout.write([dirName, branch, model].filter(Boolean).join(" | "));
