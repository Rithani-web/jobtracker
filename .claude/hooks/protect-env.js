#!/usr/bin/env node
// PreToolUse hook: block Write/Edit/NotebookEdit calls whose target file path
// ends with .env.
//
// Claude Code pipes the hook event as JSON on stdin:
//   { "hook_event_name": "PreToolUse", "tool_name": "Write",
//     "tool_input": { "file_path": "...", ... } }
//
// Exit codes: 0 = allow (silent), 2 = block (stderr is shown to Claude),
// anything else = non-blocking error. We fail OPEN on bad input: a broken
// hook must not wedge the session, it just stops protecting.
"use strict";

const fs = require("node:fs");

let raw;
try {
  raw = fs.readFileSync(0, "utf8"); // fd 0 = stdin, synchronous
} catch {
  process.exit(0);
}

let event;
try {
  event = JSON.parse(raw);
} catch {
  process.exit(0);
}

const input = event.tool_input || {};
const target = input.file_path || input.notebook_path || "";
if (!target) process.exit(0); // e.g. Bash has no file target — not our concern

// Case-insensitive: Windows paths are case-insensitive, so ".ENV" must block too.
// NOTE: this matches ".env" exactly per spec — ".env.local" does NOT end with
// ".env". Widen SUFFIX matching here if env-variant files should also be blocked.
const SUFFIX = ".env";
if (target.toLowerCase().endsWith(SUFFIX)) {
  console.error(
    `Blocked: ${target} is an environment file. ` +
      "Env files hold secrets and must be edited manually by the user, not by Claude.",
  );
  process.exit(2);
}

process.exit(0);
