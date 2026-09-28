# e229-history-independent-scope-tests

## Problem Statement

`test/e130-lane-default.test.mjs` (AC4's second test, AC14) and
`test/e178a-integrator-role.test.mjs` (AC3, AC4, AC6, AC15) pin specific
historical commit SHAs (`121ddc8`, `5896bdd`, `3c72a83`) and run `git diff`
against them. This makes the permanent suite depend on the full git history
being present: they fail with `fatal: bad revision` in any shallow clone (the
CI failure behind E228, fixed for CI by `fetch-depth: 0` in `0252e02`), in an
adopter fork that never received those objects, and — most importantly — in
the single-commit snapshot the human is about to create by deleting and
recreating this GitHub repository from the current tree (E104 option (iii),
decided 2026-09-27: no historical commit will exist afterward). The
coordinator's rehearsal (`git archive HEAD` → fresh single-commit repo →
`npm test`) measured 2811/2817 with exactly these 6 tests as the only
failures. This ticket makes each affected AC history-independent while
preserving the invariant it actually protects, without silently downgrading
any of them to a no-op.

## User Stories

- As a maintainer who deletes and recreates this repo from a single-commit
  snapshot (E104 option iii), I want the permanent test suite to stay green,
  so that the scope-containment tests don't become permanent CI red herrings.
- As an adopter who forks this repo, I want the suite to pass without needing
  this project's exact commit history, so that `npm test` is a meaningful
  gate in my fork too.
- As a qa-engineer maintaining these two files, I want the historically
  load-bearing assertions to keep being checked when history IS present, and
  to fail loudly (never silently pass) when it is not and the assertion is
  inherently about a historical diff.

## Acceptance Criteria

- **AC1** — Given `test/e130-lane-default.test.mjs`'s AC4 test
  `"AC4: zero code changes accompany this ticket outside content/** — git
  diff --stat over bin/ tools/ scripts/ from the fan-out base is empty"`
  (currently `execFileSync("git", ["diff", "--stat", "121ddc8..5896bdd", ...])`
  with no guard), when either `121ddc8` or `5896bdd` cannot be resolved as a
  commit in the repo (verify with `git rev-parse --verify <sha>^{commit}`,
  catching the thrown error rather than letting `execFileSync` itself throw
  `fatal: bad revision`), then the test calls the node:test context's
  `t.skip(reason)` (the test function must accept `(t)` for this) with a
  reason string, AND prints a `console.warn`/`console.error` notice
  containing the literal substring `HISTORY-DEPENDENT AC SKIPPED` plus which
  SHA was unresolvable and which invariant is going unchecked — never a bare
  `return` with no visible signal. When both SHAs ARE resolvable, behavior is
  unchanged (the existing `git diff --stat` assertion still runs and must
  still pass in this repo, since scope containment for e130's own commit
  range is a permanent historical fact about this repo specifically). This
  AC is inherently about a historical diff (a specific past lane's own commit
  range) — no current-tree reframing exists, per the direction's own
  carve-out.
  proof: `node --test --test-name-pattern="AC4: zero code changes" test/e130-lane-default.test.mjs`
  passes in this repo (SHAs present); a manual run against a `git archive
  HEAD` single-commit clone (see AC7) shows the same test name reported as
  `skipped` with the `HISTORY-DEPENDENT AC SKIPPED` notice on stderr/stdout,
  not a failure.

- **AC2** — Given `test/e130-lane-default.test.mjs`'s AC14 test (`"every path
  changed since 121ddc8 matches this lane's owned-files list"`), apply the
  identical guard-and-skip-loudly treatment as AC1 (same two SHAs, same
  `HISTORY-DEPENDENT AC SKIPPED` notice contract). Scope containment for a
  specific past lane's commit range cannot be reframed as a current-tree
  check (the file already explains why: a HEAD-relative range would fail on
  every unrelated later commit) — this is the other inherently-historical AC.
  proof: `node --test --test-name-pattern="AC14: every path changed" test/e130-lane-default.test.mjs`
  passes here; skips loudly (same notice contract as AC1) in a history-absent
  clone.

- **AC3** — Given `test/e178a-integrator-role.test.mjs`'s AC3 test, remove
  the `execFileSync("git", ["diff", BASE_SHA, "--", "tools/registry.ts"])`
  call and its "purely additive" line-diff check entirely. Replace it with a
  current-tree assertion that `PROMPT_REGISTRY.slice(0, 11)` deep-equals a
  literal array hardcoded in the test, mirroring the 11 entries
  `tools/registry.ts` ships today in order (`sr-engineer`, `researcher`,
  `pm`, `qa-engineer`, `teamwork`, `teamwork-lite`, `architect`,
  `design-auditor`, `code-reviewer`, `doc-writer`, `release-engineer` — each
  with its current `description`/`skillFile`/`arguments`), plus keep the
  existing `PROMPT_REGISTRY.length === 12` and last-entry-is-`integrator`
  checks (already current-tree, unchanged) and the `prompts/integrator.ts`
  pattern checks (already current-tree, unchanged). This is a strictly
  stronger, fully history-independent replacement for "diff vs base is
  additive-only" — it pins the actual expected order and content directly,
  needs no git history at all, and never skips.
  proof: `node --test --test-name-pattern="AC3:" test/e178a-integrator-role.test.mjs`

- **AC4** — Given `test/e178a-integrator-role.test.mjs`'s AC4 test, remove
  the `execFileSync("git", ["diff", BASE_SHA, "--", "tools/role.ts",
  "tools/transitions.ts"])` byte-identical-to-base check. Keep (unchanged)
  the current-tree assertions already in the same test: `tools/role.ts` and
  `tools/transitions.ts` contain no occurrence of `integrator`, and the SOP
  names `tw_get_state`/`tw_detect_drift`/`tw_gate_stats`/`tw_sync` as its
  allowed read-only tools. D11 ("`integrator` is a prompt only — never a
  `tw_switch_role` / `agent_id` role") is fully captured by "neither file
  mentions `integrator`" — the historical byte-identity check added nothing
  D11 needs going forward. Fully history-independent, never skips.
  proof: `node --test --test-name-pattern="AC4: D11 holds" test/e178a-integrator-role.test.mjs`

- **AC5** — Given `test/e178a-integrator-role.test.mjs`'s AC6 test, split it
  into two tests. (a) A current-tree test keeping every existing substance
  assertion unchanged (base sanctioned-mutations sentence, the six FORBIDDEN
  entries, the exact integrator-only grant clause) — never skips, no git
  history needed. (b) A separate test, named distinctly (e.g. `"AC6
  (historical): const-15 §6 addition stays terse vs base"`), containing ONLY
  the `git diff BASE_SHA -- content/const-15-core-tail.md` added-lines-count
  check (`<= 6`). This sub-check is inherently a historical diff-size metric
  (there is no current-tree equivalent of "how many lines were added at
  ticket time") — apply the same guard-and-skip-loudly contract as AC1/AC2
  (verify `3c72a83` resolves via `git rev-parse --verify`, else `t.skip(...)`
  plus the `HISTORY-DEPENDENT AC SKIPPED` notice).
  proof: `node --test --test-name-pattern="AC6" test/e178a-integrator-role.test.mjs`
  — both the (a) and (b) tests reported, (a) always passing, (b) passing
  here and skipping loudly in a history-absent clone.

- **AC6** — Given `test/e178a-integrator-role.test.mjs`'s AC15 test, remove
  the `execFileSync("git", ["diff", BASE_SHA, "--", "tools/fanout-manifest.ts"])`
  comment-only-diff check. Replace the "template bytes unchanged" half with a
  current-tree assertion on the provenance comment directly above
  `PROMPT_TEMPLATE_3B` in `tools/fanout-manifest.ts` (today: "the single
  canonical copy (E178a)", naming `content/skill-integrator.md`, and stating
  the bytes are pinned by the E177a render golden) — assert it still names
  `content/skill-integrator.md` and still does NOT cite
  `.claude/commands/integrator.md`. Do **not** add a second copy of the
  `PROMPT_TEMPLATE_3B` literal into this test file: `test/e177a-manifest.test.mjs`'s
  `"AC6 render e177a"` test already pins the rendered template byte-for-byte
  against `test/fixtures/e177a/render-e177a.golden.txt` — a second hardcoded
  copy here would violate the single-copy rule (E177a / `skill-integrator`
  stage 3) that the provenance comment itself documents. Keep the existing
  current-tree assertions unchanged: `docs/lane-protocol.md` names
  `content/skill-integrator.md` near its top, neither `docs/lane-protocol.md`
  nor `tools/fanout-manifest.ts` cites `commands/integrator`, and
  `tools/fanout-manifest.ts` states it is "the single canonical copy". Fully
  history-independent, never skips.
  proof: `node --test --test-name-pattern="AC15:" test/e178a-integrator-role.test.mjs`

- **AC7** — Given the two files above are made history-independent per AC1-6,
  when the full suite is run against a single-commit snapshot of the current
  tree (the exact shape of the coming E104 option (iii) repo recreation),
  then it is green with zero failures (skips of the AC1/AC2/AC5b
  historical-only checks are expected and acceptable there; any other
  failure is not).
  proof:
  ```
  cd "${TMPDIR:-/tmp}" && rm -rf e229-snapshot-check && mkdir e229-snapshot-check && \
  (cd <lanes-root>/e229 && git archive HEAD) | tar -x -C e229-snapshot-check && \
  cd e229-snapshot-check && git init -q && git add -A && git commit -q -m snapshot && \
  ln -s <lanes-root>/e229/node_modules node_modules && \
  npm test
  ```
  reports 0 failures (AC1/AC2/AC5b report as `skipped` with the
  `HISTORY-DEPENDENT AC SKIPPED` notice, not as failed). Run this AFTER
  confirming `npm test` is still green in the lane itself (both must pass).

- **AC8** — Given `docs/lane-protocol.md` (the shared lane protocol qa
  authors read before writing permanent tests), when a qa-engineer looks for
  guidance on pinning commit SHAs in a test that is meant to stay in the
  permanent suite, then a short guard sentence exists (near the existing
  scope-containment / `fanout check` guidance, or in its own short
  paragraph) stating: a permanent test must not assert on a specific
  historical commit SHA unless the assertion is inherently about a
  historical diff (e.g. a specific past lane's own scope-containment check),
  in which case it MUST guard the SHA lookup and skip loudly (never
  silently) when the SHA is absent, per this ticket's own two examples in
  `test/e130-lane-default.test.mjs`. This is documentation-only — no
  `proof:` command applies; qa-engineer confirms by reading the added
  sentence.

## Copy / Strings

| string id | exact text (quote verbatim) | source |
|---|---|---|
| skip.notice | `HISTORY-DEPENDENT AC SKIPPED` | authored-here — the loud-notice substring AC1/AC2/AC5b's console output must contain, chosen to be greppable in CI logs |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Retiring these ACs entirely in favour of the fan-in `fanout check` record
  (the backlog row's alternative option) — the cut keeps the ACs and makes
  them history-independent instead, since they still catch real regressions
  today (both pinned commit ranges exist and both diffs currently pass).
- Rewriting `test/render-structure.test.mjs`'s `ffa4082` reference or any
  other test that already passes without history — per the dispatch
  instructions, do not touch tests outside the 6 named failures.
- Running the AC7 single-commit-snapshot check as a permanent, always-on
  suite member (it re-execs the entire suite inside a nested `git init`,
  which is slow and would need its own git plumbing) — it is a qa-executed
  proof at PASS time for this ticket, not a new file under `test/`.
- Any production code change — this ticket is test-authorship and a
  documentation line only (qa-engineer per Constitution §2; no `bin/`,
  `tools/`, `scripts/`, `prompts/`, `gates/` changes).
- Performing the E104 history rewrite or repo recreation itself — that
  remains human-owned per E104's own disposition; this ticket only makes the
  suite survive it.
- Touching `test/e177a-manifest.test.mjs` or
  `test/fixtures/e177a/render-e177a.golden.txt` — that golden already pins
  `PROMPT_TEMPLATE_3B`'s bytes (E177a / `skill-integrator` stage 3, single-copy
  rule); AC6 (this ticket) asserts only the provenance comment above the
  literal, never a second copy of the bytes, so the golden is not touched
  here.

## Dependencies / Prerequisites

- Depends on `git rev-parse --verify <sha>^{commit}` being available in
  every environment the suite runs in (already true — it's plain git,
  no network).
- The frozen literal in AC3 (registry first-11 entries) must be copied
  byte-for-byte from `tools/registry.ts` as it stands today (2026-09-27,
  `942f994`) — qa-engineer reads the live source rather than retyping from
  this spec, to avoid a transcription mismatch. AC6 does NOT freeze a second
  copy of `PROMPT_TEMPLATE_3B`'s bytes — `test/e177a-manifest.test.mjs`'s
  `"AC6 render e177a"` test already owns that pin against
  `test/fixtures/e177a/render-e177a.golden.txt` (single-copy rule, E177a /
  `skill-integrator` stage 3).
- No external references (URLs, Figma, tickets) found in this ticket's
  source material beyond the in-repo backlog row and test files already
  read during PM triage — Resource Audit Gate: zero hits, field omitted.
