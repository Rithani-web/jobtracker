#!/usr/bin/env bash
# PostToolUse (Write|Edit) hook — announces each file Claude edits.
# Receives the hook payload as JSON on stdin and emits a systemMessage
# that Claude Code displays: file name, timestamp, "JobTracker file updated".

input=$(cat)
printf '%s' "$input" | node -e '
let d = "";
process.stdin.on("data", (c) => (d += c));
process.stdin.on("end", () => {
  let file = "unknown";
  try {
    const j = JSON.parse(d);
    file =
      (j.tool_input && j.tool_input.file_path) ||
      (j.tool_response && j.tool_response.filePath) ||
      "unknown";
  } catch {}
  const name = String(file).split(/[\\/]/).pop() || "unknown";
  const ts = new Date().toLocaleString("en-US", { hour12: false });
  process.stdout.write(
    JSON.stringify({
      systemMessage: name + " — " + ts + "\nJobTracker file updated",
    }) + "\n",
  );
});
'
