#!/usr/bin/env bash
# PostToolUse (Write|Edit) hook — nudges Claude to OFFER a CLAUDE.md update
# after source-code changes. Emits additionalContext (shown to Claude in the
# session); Claude must then ASK THE USER before touching CLAUDE.md — the
# hook never edits anything itself.
#
# Noise controls: only source-ish files (.ts/.tsx/.sql/.mjs), never for
# CLAUDE.md/AGENTS.md edits or .claude*/ tooling edits, and throttled to at
# most one nudge per 30 minutes via a timestamp state file. Silent no-op
# otherwise, always exit 0.

input=$(cat)
printf '%s' "$input" | node -e '
let d = "";
process.stdin.on("data", (c) => (d += c));
process.stdin.on("end", () => {
  let file = "";
  try {
    const j = JSON.parse(d);
    file = (j.tool_input && j.tool_input.file_path) || "";
  } catch {}
  const norm = String(file).replace(/\\/g, "/");
  if (!/\.(ts|tsx|sql|mjs)$/.test(norm)) return;
  if (/\/(CLAUDE\.md|AGENTS\.md)$/i.test(norm)) return;
  if (/\/\.claude(-plugin)?\//.test(norm)) return;
  try {
    const fs = require("fs");
    const path = require("path");
    const state = path.join(process.cwd(), ".claude", "hooks", ".claude-md-nudge.state");
    const now = Date.now();
    if (fs.existsSync(state)) {
      const last = Number(fs.readFileSync(state, "utf8").trim());
      if (Number.isFinite(last) && now - last < 30 * 60 * 1000) return;
    }
    fs.writeFileSync(state, String(now));
    const name = norm.split("/").pop();
    process.stdout.write(JSON.stringify({
      additionalContext:
        "CLAUDE.md check: source file " + name + " changed. If this change " +
        "added or altered commands, gotchas, or conventions that a future " +
        "session could not re-derive from the code, ASK THE USER whether to " +
        "update CLAUDE.md and wait for approval before editing it. If nothing " +
        "qualifies, say nothing and move on."
    }) + "\n");
  } catch {}
});
'
exit 0
