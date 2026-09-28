# Review: integ/wave5 — `.claude/` Partition classification fix

Scope: integrator-scoped test fix on branch `integ/wave5`, requested by the
integrator for Wave 5 fan-in. NOT a governed task — no `tw_update_state`,
`tw_complete_task`, or `tw_add_task` calls were made per assignment
instruction 5. This file is the requested evidence record, not a
server-auto-recorded QA review.

## Failure

`npm test` → 2484/2485 (pre-fix). Failing test:

```
not ok — Partition (E66, T-E66-02): every top-level repo directory is
classified in exactly one of FEATURE_DIRS / NON_SOURCE_DIRS
  (test/release-staging.test.mjs ~:991)
uncovered: [".claude/"]
```

Cause: commit `e44ef39` (already on `main`) newly tracked
`.claude/commands/integrator.md` — an interim, repo-local slash-command SOP
for the human-invoked integrator role — via `git ls-files`. The Partition
test (test/release-staging.test.mjs:991) enumerates real tracked top-level
directories and asserts every one is classified in exactly one of
`FEATURE_DIRS` / `NON_SOURCE_DIRS` (test/release-staging.test.mjs:85,95).
`.claude/` was in neither list, so the test went uncovered.

Confirmed only `.claude/commands/integrator.md` is tracked under `.claude/`;
`.claude/settings.local.json` is untracked local config (`git ls-files |
grep '^\.claude/'` → one line).

## Classification chosen: NON_SOURCE_DIRS

Per the integrator's recommendation. Rationale (matches the pattern of the
existing `.current/` entry in the same list):

- `.claude/commands/integrator.md` is a repo-local Claude Code slash-command
  SOP for the human-invoked integrator role — tooling/session configuration,
  not shipped feature source. It is not referenced by `tsconfig.json`
  `include`, is not part of the npm-published `dist/` output, and is not
  read by any `tw_*` tool or gate.
- It is explicitly interim: it will be superseded by
  `content/skill-integrator.md` under backlog E178 (v4 Wave 7), at which
  point the integrator SOP becomes a normal role SOP living in `content/`
  (a FEATURE_DIRS location) and `.claude/commands/integrator.md` is expected
  to be retired.
- Did not choose FEATURE_DIRS: doing so would require editing the
  `content/` SOP enumeration sites (AC2/AC3 cross-reference sets, the
  git-add line in `content/skill-release-engineer.md`, `METADATA_PATHS`
  bookkeeping) to actually stage `.claude/` as release source — out of
  scope for an interim, soon-to-be-retired directory, and not requested by
  the integrator brief.

## Change made

Single list edit in `test/release-staging.test.mjs`, `NON_SOURCE_DIRS`
(no other test logic changed):

```diff
   ".current/", // only .current/.config.json ships — one of the five E65_METADATA_PATHS below, staged separately as a metadata path, not as this directory; the rest of the tree (handoff.md, telemetry.jsonl, metrics.jsonl, ...) is session bookkeeping committed outside the release commit (skill-release-engineer.md:173, citing commits cc3e0df/53a6392)
+  ".claude/", // repo-local Claude Code slash-command config (commands/integrator.md); interim until E178 moves the integrator SOP into content/skill-integrator.md (v4 Wave 7) — not shipped feature source
 ];
```

## Test results

### Targeted: `node --test test/release-staging.test.mjs`

```
# tests 80
# suites 0
# pass 80
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

All 80/80 pass, including the previously-failing Partition (E66, T-E66-02)
test.

### Full suite: `npm test` (single run)

```
# tests 2485
# suites 1
# pass 2483
# fail 2
# cancelled 0
# skipped 0
# todo 0
# duration_ms 110691.281834
```

2483/2485 pass. The 2 failures are BOTH pre-existing and unrelated to this
change — `test/check-md-tables.test.mjs` ("AC7 (real corpus...)" and
"CQ-9 (real corpus...)") fail because the current uncommitted working tree
of `docs/backlog.md` has two malformed table rows (7 cells vs. a 6-cell
header) at lines 195 and 302:

```
check:md-tables — 2 malformed table site(s) found:
  docs/backlog.md:195 — row has 7 cell(s), header declares 6
  docs/backlog.md:302 — row has 7 cell(s), header declares 6
```

`git status --short` at the time of this run shows `docs/backlog.md`,
`docs/install.md`, `docs/v4.0.0-execution-plan.md`, and
`docs/v4.0.0-new-tickets.md` already modified in the working tree before
this task started (concurrent lane / wave-5 fan-in edits, not touched by
this fix). This task's diff is confined to `test/release-staging.test.mjs`
(one added line). Not investigated further or fixed — out of scope for this
assignment (single list-edit fix only; `docs/backlog.md` table repair
belongs to whichever lane is editing it).

No `usage-accounting.test.mjs` timeout flake occurred on this run (its
tests — `t-usagepath`, `t-append-creates-file`, etc. — all passed inline in
the single full-suite run); no isolated re-run of that file was needed.

## Files touched

- `<repo-root>/test/release-staging.test.mjs` (1 line added to `NON_SOURCE_DIRS`)

## Not done (per assignment instruction 5)

No `tw_update_state`, `tw_complete_task`, or `tw_add_task` calls made. This
fix is recorded here for the integration commit, not as a governed task
completion.
