---
description: Scaffold a REST endpoint via the api-designer agent
argument-hint: <endpoint description>
allowed-tools: Agent, Read, Edit, Write, Bash(npm run *)
---

Delegate endpoint scaffolding to the `api-designer` agent (`.claude/agents/api-designer.md`).

Task for the agent: $ARGUMENTS

Rules for the delegation:

1. Spawn the agent with the full endpoint description plus the surrounding context it needs (which router file, which table, expected status codes).
2. The agent owns `backend/src/**` — do not edit those files in the main thread while it runs.
3. When it completes, verify independently in the main thread: run `npm run type-check` and `npm run lint` from `backend/` yourself, and trust your own runs over the agent's self-report.
4. Report a summary table: files touched, endpoints added, gate results.
