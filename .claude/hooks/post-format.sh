#!/usr/bin/env bash
# PostToolUse (Write|Edit) hook — auto-formats edited TypeScript files.
# Receives the hook payload as JSON on stdin (there is no ${file}
# interpolation; the path comes from tool_input.file_path). Only acts on
# .ts/.tsx — everything else is a silent no-op. Never blocks the edit:
# always exits 0; prettier/eslint problems stay visible in the normal
# lint pass instead of failing the tool call.

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
  if (/\.(ts|tsx)$/.test(file)) console.log(file);
});
' | while IFS= read -r file; do
  [ -f "$file" ] || continue
  npx --no-install prettier --write "$file" >/dev/null 2>&1
  npx --no-install eslint --fix "$file" >/dev/null 2>&1
done
exit 0
