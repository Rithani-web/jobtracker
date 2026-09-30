---
name: weekly-summary
description: Generates a weekly development recap for JobTracker from git history — commits made, files changed, features added, new TODO/FIXME debt — and saves it to reports/WEEKLY_[date].md. Use when the user runs /weekly-summary or asks what shipped this week.
disable-model-invocation: false
---

# /weekly-summary

When invoked, run this workflow automatically:

1. `git log --since="7 days ago" --oneline` — the week's commits
2. `git diff --stat HEAD~7` — churn; if `HEAD~7` doesn't resolve, diff against the last commit before the week's Monday instead, and skip gracefully if the repo is younger than a week
3. Count: commits made, files changed, features added (group commit subjects by area — don't pad the list with chore noise)
4. New TODO or FIXME comments added this week — scan added lines (`git log -p --since="7 days ago"` piped through a `^\+.*(TODO|FIXME)` match), with `file:line` for each
5. Generate and save to `reports/WEEKLY_[YYYY-MM-DD].md` (create `reports/` if missing; the date is the week's Monday):

```markdown
## JobTracker — Week of [date]
### Shipped this week
### Still in progress
### Known issues or TODOs
### Next 3 priorities
```

Fill the sections from the evidence. "Next 3 priorities" is a proposal — label it as such and derive it from open TODOs and unfinished work, not invention. Keep the whole report under ~40 lines; if the week was empty, say so in two lines instead of manufacturing content.
