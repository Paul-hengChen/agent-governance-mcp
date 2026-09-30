# Review — T-E233D-01

covers: T-E233D-01, T-E233D-02, T-E233D-03, T-E233D-04, T-E233D-05, T-E233D-06, T-E233D-07, T-E233D-08, T-E233D-09, T-E233D-10, T-E233D-11, T-E233D-12, T-E233D-13

## Round 1 — APPROVED — by code-reviewer

## Summary
- Diff 6c61864..7634459 on feat/e233d-test-comments-b rewrites comments in 48 owned test files (1969 insertions, 2052 deletions across 53 paths), so that no comment leans on a bare ticket id as its only explanation. The other five paths are lane bookkeeping.
- I re-ran every mechanical check with scripts I wrote myself: `inv.mjs`, `bare.mjs`, `xref.mjs`, `lost.mjs`, `anchor.mjs`, `hyg.mjs`. I did not reuse the author's scripts, and I did not read the author's report: the code-reviewer clean-context rule excludes `qa_reports/`.
- I read about 40 rewritten blocks across 20 files, including 9 blocks with lowercase or suffixed id shapes. I also read every block that shrank by 8 or more lines.
- Verdict: APPROVED. The change is comment-only by construction, the scope is exact, and the rewrites are accurate and plain.

## AC Completeness
AC1 — implemented — `inv.mjs` transpiles each changed test file with `ts.transpileModule` (allowJs, removeComments, ESNext) at 6c61864, at 7634459 and in the working tree. All three outputs are byte-identical for every file: `invariance OK: 48 files`.
AC2 — implemented — `bare.mjs` uses TS comment ranges, joins adjacent line comments into blocks, and detects ids case-insensitively, including suffixed shapes (`[ECDR]\d+[a-z0-9]*(-seg)*`, `T-…`, parenthesised slugs). Result: `bare-id OK (363 id blocks)` at HEAD. At base the same script flagged 5 blocks, for example `e235b-relative-worktree.test.mjs:201`/`:220`, which were bare `// R5` / `// R6` banners. A line-level scan of the added lines for ids used as leading labels found only wrapped continuation lines. Human sample below.
AC3 — implemented — `xref.mjs` checks every token that another tracked file cites on the same line as an owned file's name: `xrefs OK (5206 tokens)`. The four labels the spec names (`T-QA-E128-01(a)`, `FM2`, `I1-I4`, `AC15`) are all still present. `lost.mjs` lists the tokens dropped per file (for example `lane-paths` T-E123A3-03, `feature-lease` T-D10-03, `error-code-contract` T-ECCT-02). I grepped each one repo-wide: none is cited against its owned file from outside it.
AC4 — implemented — the spec's `git diff -U0 … | grep` proof prints only 3 changed lines, and each changes only its trailing comment: `e213-shipped-ignored-shape` (worktree cleanup), and `e28-shrink-warning` `dispatch_pins` and `next_role`. I checked the e213 wording against the assertions above it (git refused the removal, so the worktree is still there): accurate. `anchor.mjs` adds a stronger check. The sequence of non-comment lines, with trailing comments stripped, is identical in all 48 files. Line counts match. No comment block was deleted outright, created in front of a different statement, or moved.
AC5 — implemented — the spec's name-filter proof prints nothing. `render-structure`, `context-budget` and `test/fixtures` are untouched. The changed test files match the 48 files in the task cut exactly (`comm` empty both ways).
AC7 — implemented — `hyg.mjs` builds its home-directory and URL pattern by string concatenation and runs it over the added lines: `hygiene OK`. Five tracked review/QA report paths remain as trailing pointers, and all five are tracked (`git ls-files`). `tw_*` names that remain are the real tools under test (for example `tw_gate_stats`, `tw_update_state`), which the spec allows. "Round cap" wording remains only where the test exercises the real `*_ROUND_CAP` constants.

## Correctness
No findings. Rewrites I checked against the assertions below them:
- `qa-flow` T-QA-E128-01 header, (a), (b), (d), (e) and the hop_count note. The claims match the sweeps and the `computeNewRound` fixtures. "The exhaustive transition-matrix sweep further down" resolves to `T-E53-03(h)` at line 2602.
- `handoff-migration` v6→v15 chain comment. The fields it lists (next_role/resume_of/review_verdict, dispatch_pins, dispatched_at, dispatch_mode, evidence_schema, cut_approved_source, dispatch_mechanism(_tier) left undefined; hop_count and the three *_rounds_total seeded to 0) match the assertions line for line.
- `handoff-versioning` AC-1. The pointer to `docs/schema-versions.md` for per-version history resolves: rows v10–v15 are present.
- `lane-paths` e123b0 AC3. The claim that ids with a letter or digit suffix resolve to themselves matches the table rows for e123b0, e123b1 and e123b9.
- `feature-rollup`. `hop: 54, OVER BY 44` comes verbatim from the base text.
- `e32-e33-gate-hardening`, `e38-next-role-lookahead`, `e22-stale-notify` (I7–I9), `e24-exemptions`, `gates-expected-red` (I5b, two call sites), `p0-onboarding-lite-default` (AC1/AC2 E34/E100), `e239-init-subdir-exclude`, `e90-golden-capture-completeness`, `error-code-contract` (SUFFIX_RE, 33-entry pin, DR-8 union), `qa-visual-skill-split`, `e5-intake-tiering`, `lane-migrate`, `e23-evidence-schema`, `e31-config-nonfatal`, `feature-lease` (E13 marker, E9A, E17 blocks). Every description agrees with the assertions below it.

Deletions I judged, to see whether any removed an explanation of why a current assertion exists:
- `e5-intake-tiering` state-integrity note. It described a process event, not an assertion. Safe to delete.
- `error-code-contract` gate-count history. The reason for the pin survives: adding or dropping a gate must be a deliberate, visible change, and the newest entry is named and explained. The DR-8 block keeps why the union is hand-written, why it is pinned at 16, and why each class of member is in or out. It also removes a stale "12-member" figure from the header. The SUFFIX_RE block keeps why each suffix exists: otherwise the code is invisible to both harvests.
- `handoff-versioning` and `handoff-migration` schema-bump history. The current pins (v15, the nine-step chain, no-seed versus counter-seed) and their reasons survive.
- `qa-visual-skill-split` byte-cap history (net −100 lines). The reasons survive: the cap guards the context budget, and headroom is kept at 350–550 bytes because headroom is unreviewed growth. So do the latest raise with its measured size and the note that the 8660 figure is informational only.
- `e239`/E243 and `e90` repro transcripts. The bug each test guards against is still described concretely, including why the check is static rather than executed, and the dead-`else` false-positive case. Only the one-off repro narration is gone.

## Quality
- optional — `test/qa-visual-skill-split.test.mjs` "(Earlier raises: … d9 review_task_ids, e2 bugfix-mode branch …)". This parenthetical is a trailing history list that mixes id shapes. It is harmless, since each entry names what changed. It could be dropped outright, because the rule says to drop the story.
- optional — `test/e32-e33-gate-hardening.test.mjs:4-6` "the check has no exemption for the code-reviewer handoff". This is accurate, but a little compressed. "Even on the reviewer-to-QA handoff write" would match R1's shape more literally.

## Architecture
No architecture spec for this feature. No code or layering change: AC1 and `anchor.mjs` prove that no code line changed.

## Security
No findings. No home-directory paths, usernames or URLs were added (`hyg.mjs`). No string literals changed.

## Performance
No findings. The change is comment-only, so runtime is unchanged.

## Verdict
APPROVED — mechanical invariance, scope and cross-reference checks all pass on independent scripts, and the human-sampled rewrites are plain, accurate to the assertions, and keep every "why" behind a current assertion.
