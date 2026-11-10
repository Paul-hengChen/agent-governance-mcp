# Review — T-E355-01

## Round 1 — APPROVED — by code-reviewer

Diff: `e748fc5..0928b7f` (feature `e262-sop-text-fixes`). Scope of this report: W3–W8 (`content/skill-integrator.md:142,151,156,164,175`) and W9 (`docs/lane-protocol-addendum.md` §5, five bullets after the `check:bookkeeping` bullet).

## Summary
- Replaces five repo-only facts in the shipped integrator SOP (CI trigger, full-suite command, retired findings file, post-merge server restart, load-sensitive list with its ticket family) with generic wording that defers to the repo addendum, and adds one addendum line per fact.
- Verbatim check: applying W3–W8 to the base reproduces `content/skill-integrator.md` byte-for-byte (old string count 1 each, 249 lines kept); inserting the W9 block after the `npm run check:bookkeeping` bullet reproduces `docs/lane-protocol-addendum.md` byte-for-byte (39 → 44 lines, §7 untouched).
- AC-E355-1 banned strings all count 0 in `content/skill-integrator.md`.
- Verdict: APPROVED.

## AC Completeness
AC-E355-1 — implemented — `feat/**`, `ci.yml`, `NEW-TICKETS.md`, `npm test`, `` load-sensitive in `docs/backlog.md` ``, `E238`, `E254`, `E278`, `primary MCP server`: each 0 in `content/skill-integrator.md`.
AC-E355-2 — implemented — W3 at :142 (5a lead), W4 at :151 (`new findings` row), W5 + W6 at :156, W7 at :164, W8 at :175; each new string once, inside its 5a / 5b slice.
AC-E355-3 — implemented — `docs/lane-protocol-addendum.md:30-38`: the existing four §5 bullets (:30-33) unchanged, then the five W9 bullets verbatim; heading list and §7 unchanged. Each generic phrase has its line: CI trigger (:34 ↔ W3), full-suite command (:35 ↔ W3/W5), retired findings file (:36 ↔ W4/W7), post-merge restart (:37 ↔ W8), load-sensitive list (:38 ↔ W6).
AC-E355-4 — implemented — the list names `test/e108-eject.test.mjs` tests starting `AC7` (two exist: `:380`, `:568`) and `test/verify-release.test.mjs` `VR-20 (E80)` (`:851`), and states the six E238 sites are off the list; neither test file is in the diff.
AC-E355-5 — implemented — 249 lines kept; `test/e410-task-alias-content-tail.test.mjs` green in my run.
AC-E355-6 — partial (qa-owned, by design) — the e178a AC13, e226 AC-E226-4, e295 AC9, e349 AC-E349-1/-2 pin moves are T-E355-02; all are listed in the expected-red manifest. Not a finding for this sr task.

## Correctness
No required findings.
- Addendum accuracy: `.github/workflows/ci.yml` `on.push.branches` is `[main, 'feat/**', 'integ/**', 'release/**']` — the W9 CI line is exact. The retired findings file line agrees with addendum §4 (`root 的 NEW-TICKETS.md 已退役`). The E238 exclusion agrees with the `docs/backlog.md` E238 row (six sites, five decoupled, usage-accounting ceiling confirmed unchanged) and E254 / E278 are closed into E238, so dropping the family from the flake rule loses no listed flake.
- W6 adds `no list, no re-run` — the safe default for an adopter repo without an addendum list.
- optional — `content/skill-integrator.md:156` still says `when \`gh\` is unavailable or Actions is down`, a GitHub-hosting assumption; the spec puts it explicitly out of scope, report-only.

## Quality
- optional — `docs/lane-protocol-addendum.md:35` (full-suite command `npm test`, wrapped in `test-lock`) restates the parenthetical already on `:31` (`全套一律 \`node scripts/test-lock.mjs -- npm test\``). Harmless duplication that the spec's W9 asked for so each SOP phrase has its own line.
- The SOP terms and the addendum terms line up: `retired findings file the addendum names` / `retired-findings-file check` ↔ `補充規則點名的退役發現檔`; `the repo's full-suite command` ↔ `repo 的全套指令`.

## Architecture
No architecture spec. Follows the E226 / E349 pattern: generic rule in `content/**`, repo fact in the addendum.

## Security
No findings. Constitution §6 hygiene: the SOP lines lose their repo-only facts; the addendum lines cite only repo-relative paths and ticket ids; no absolute local path, account or personal detail.

## Performance
No findings. `content/skill-integrator.md` is in no composition; no budget moves.

## Verdict
APPROVED — W3–W9 match the spec verbatim, the shipped SOP is free of the named repo facts, and every addendum line is accurate against the repo.
