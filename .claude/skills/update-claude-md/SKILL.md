---
name: update-claude-md
description: Reviews recent code changes and proposes CLAUDE.md updates — always asking permission before editing. Use when the user asks to "update CLAUDE.md", "refresh project docs/memory", "document this change", or when the CLAUDE.md nudge hook fires after source changes.
---

# Update CLAUDE.md

Keep CLAUDE.md lean: only what a fresh session cannot re-derive from the code. Ask first, always.

## Workflow

1. **Identify what changed** — `git status` + `git diff` for uncommitted work, or this session's edits if the nudge hook fired mid-session.
2. **Derive candidates using the keep/cut test.** Add only: non-guessable commands (scripts, required env), gotchas and failure contracts ("X looks safe but breaks Y"), non-standard conventions that differ from tool defaults, safety rules. Never add: file trees, stack lists, standard commands from package.json, architecture tours — a session can `ls`/read those itself.
3. **Ask permission (mandatory).** Present the proposal as a short diff summary — "add these 2 lines, remove this block because…" — and WAIT for an explicit yes. No approval → no edit. If nothing qualifies for the keep/cut test, say "CLAUDE.md is already current" and stop.
4. **Apply** as ordinary working-tree edits (user reviews in `git diff`). Never commit unless asked.
5. **Pay the size budget.** Every addition should push something out or tighten a section; if CLAUDE.md approaches ~5k characters, cut derivable content to make room.
