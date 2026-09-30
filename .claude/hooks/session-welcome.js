#!/usr/bin/env node
// SessionStart hook: prints a one-line welcome to the user.
//
// SessionStart stdout goes into the model's context, not the UI — the way to
// show the user a line is JSON output with a `systemMessage` field. So we
// emit JSON on stdout and print nothing human-readable ourselves.
//
// Exit codes: always 0 — a welcome message must never fail a session start.
"use strict";

process.stdout.write(
  JSON.stringify({
    systemMessage:
      "Welcome back to JobTracker. Hooks active: .env write protection, TS lint-fix.",
  }) + "\n",
);
