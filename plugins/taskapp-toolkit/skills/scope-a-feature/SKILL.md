---
name: scope-a-feature
description: Use when the user wants to add a feature — e.g. says "I want to add a feature", describes a new capability, or asks to scope/design something new for JobTracker. Forces a scope-first workflow: sharp clarifying questions, related-feature suggestions, a one-paragraph plan, and no code until explicit approval.
---

# Scope a feature

The user wants something new. Do NOT write code yet. Run these gates in order: deliver 1 and 2 together in one message, then stop and wait for the user's answers before continuing.

## 1. Clarify
Ask 6–10 sharp, non-obvious questions about the feature: who uses it and why; exact expected behavior; data-model changes (Supabase tables, columns, RLS implications); edge cases (empty, error, permission, timezone, concurrency); where it lives in the UI (which page, mobile behavior); and what "done" means. Use the AskUserQuestion tool in batches of up to 4, as many rounds as needed. Never invent answers — if something is ambiguous, ask.

## 2. Suggest
Recommend 3–5 features that would build on this one and on what JobTracker already has (applications, interviews, contacts, follow-ups, notes, dashboard metrics). Add 1–2 of your own ideas with a one-line value argument each. Mark the one you'd build first and why.

## 3. Restate
After the user answers, restate the whole plan in ONE paragraph: what will be built, which files/tables/pages it touches, and what is explicitly out of scope.

## 4. Gate
Ask "Approve?" and wait. Write zero code until the user explicitly approves. If they change anything — even a detail — fold it in, restate the affected part, and re-gate.
