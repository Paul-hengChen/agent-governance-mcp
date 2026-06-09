# Review — T-LABEL-FIX

Task: `T-LABEL-FIX` — `bin/agc-init.mjs` caller result-mapping fix so a
pre-existing `CLAUDE.md` (no agc block) is reported under `Updated:` instead of
`Created:`. Reviewer: code-reviewer (opus), clean-context, verified against the
real diff + a self-run proof.

## Summary

- Single-hunk logic change in `bin/agc-init.mjs` (~L161-165): the upsert branch
  now routes both `"updated"` and `"appended"` results to the `updated` list;
  only `"created"` goes to `created`.
- The `writeClaudeBlock` helper (L71-97) return contract is UNCHANGED:
  `"created"` (fresh file) / `"updated"` (block replaced in place) / `"appended"`
  (block added after pre-existing prose).
- No test files touched by sr; the other working-tree changes (`.antigravityrules`,
  `AGENTS.md`, `CLAUDE.md`, `tasks.md`, `.current/handoff.md`) are pre-existing
  regeneration/state files traveling with the fix commit, not this task's edit.
- Proof re-run independently: pre-existing CLAUDE.md → `Updated:`; fresh dir →
  `Created:`; prose preserved, exactly one block.
- Gates green: build exit 0, check-version OK (3.29.0), tests 570/570.

## Correctness

The fix is correct. The diff hunk:

```diff
-      if (result === "updated") {
-        updated.push(rel);
+      if (result === "updated" || result === "appended") {
+        updated.push(rel); // both mean the file pre-existed
       } else {
-        created.push(rel); // "created" or "appended"
+        created.push(rel); // "created" — brand-new file
       }
```

`writeClaudeBlock` (`bin/agc-init.mjs:76-96`) returns `"created"` only when the
target did not exist (`!fs.existsSync`), and `"appended"` only when the file
existed but had no agc block. So mapping `"appended"` → `updated` is semantically
correct: the file pre-existed and the user's prose was retained. No off-by-one,
no missed branch — the three return values are exhaustively partitioned into the
two lists (`"created"`→created, `"updated"`/`"appended"`→updated).

Independent proof run:

```
SCENARIO 1: pre-existing CLAUDE.md (no agc block)
  Created: .current/handoff.md, .current/.config.json, tasks.md, AGENTS.md, .antigravityrules
  Updated: CLAUDE.md
  My Project: 1 | BEGIN agc-adapter: 1     # prose preserved, single block

SCENARIO 2: truly-fresh dir (regression check)
  Created: .current/handoff.md, .current/.config.json, tasks.md, CLAUDE.md, AGENTS.md, .antigravityrules
```

CLAUDE.md moves to `Updated:` for the pre-existing case and stays under `Created:`
for a fresh dir — no regression.

## Quality

Clean. The inline comments now accurately describe each branch (the old comment
`// "created" or "appended"` was the stale/misleading one and is gone). Naming and
style match surrounding code. No dead code, no duplication introduced.

## Architecture

Consistent with the adapter scaffolding design: `writeClaudeBlock` owns the
file-state decision and returns a discriminated result; the caller owns
presentation (which output list). The fix keeps that separation intact — the
helper was not changed, only the caller's interpretation of its result.

## Security

No new boundaries, no injection vectors, no secrets. File writes are confined to
`cwd` via `path.join` as before. Out of scope for this change.

## Performance

No change in complexity class. Single string comparison added to an existing
per-adapter loop; no new I/O, no hot-path regression.

## Verdict

APPROVED — the result-mapping fix is correct, the helper contract is unchanged,
proof scenarios pass both directions, and all gates are green.
