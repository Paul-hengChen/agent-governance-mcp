# QA review — e292-sister-repos (batched)

covers: T-E292-01, T-E292-02, T-E292-03, T-E343-01, T-E342-01, T-E292-04, T-E344-01

Verdict: PASS (see the final handoff write for the full-suite pass/total at the final HEAD).
Code review round 1 APPROVED (`review_reports/review_T-E292-01.md`). Spec: `specs/e292-sister-repos.md`.

## Expected-Red Diff

Manifest `qa_reports/expected-red_e292-sister-repos.txt` has one entry: `test/e178a-integrator-role.test.mjs | AC10: SOP execution stage — mailbox + cut pre-review formalized`.

- e178a AC10 (the one entry): confirmed red before the re-pin by the previous qa hop's targeted run (273/274, the only red was this entry) — its Stage 4 assertion pinned the old sentence `... §5 and §6 — the only copy.`, which `sop.stage4-layers` replaces. Disposition: expected, re-pinned to copy `sop.stage4-layers` (only that assertion changed; the other AC10 assertions and every other e178a test are unchanged). Now green.
- Unexplained reds: none. After the re-pin, the 15-file proof run (e178a, e177a-manifest, e289 x2, the six protected tests, e288, e297, e336, error-code-contract, context-budget, config-versioning) is 244/244, and the final full-suite run is recorded in the handoff write.

Phase 0.5: clean (1/1 manifest entry confirmed red, 0 unexplained reds).

## Review summary (Phase 1)

- Copy audit (3a): every `err.*`, `check.ext-diff`, `docs.*`, `sop.*` literal in the spec's Copy / Strings table is asserted verbatim by a test below (error messages by regex on the spec shape, `docs.*` / `sop.*` by byte-equal literal). No user-facing string in the diff is missing from the table.
- Visual audit (3b), Phase 1.5: skipped (no Visual Tokens, no Visual Baselines declared; feature has no visual literals).
- Observation (not a FAIL, code-reviewer territory): `TEMPLATE_POINTER_ABSENT` is evaluated only once the two-layer pointer resolved, so when the addendum or generic file is itself missing (`ADDENDUM_ABSENT` / `LANE_PROTOCOL_ABSENT`) a broken template is reported only after that is fixed; it is collected together with any independent missing source (mailbox root, base) — test pins that. The spec text ("collected together with any other missing-source error") is met by the independent sources.
- Observation: AC-E292-5's "detected like `## 接手步驟`" means a heading qualifier must follow the name directly (`## 外部依賴(b)` / `（…）`), no space, and fenced code is not parsed — same as every other section; tests pin the direct-qualifier form only.

## Spec-to-Test Map (Phase 3)

Phase 3 placement: test files created per the dispatch brief's pre-authorized named targets.

| AC | test file | tests |
|---|---|---|
| AC-E292-1 | `test/e292-config-sister-repos.test.mjs` | verbatim/order, contracts filtering, every invalid shape (name, path abs/win/drive/`~`, owns), first-name-wins, key absent/non-array/no valid entry, `parseSisterRepos` junk, `getConfigError` stays null |
| AC-E292-2 | same + proof command | `CURRENT_VERSIONS.config === 2`, v2 config not rewritten on load; diff proof below |
| AC-E292-3 | same | heading once, after the addendum section, before the next `---`, nine required phrases |
| AC-E292-4 | `test/e292-external-deps-validate.test.mjs` | open and closed manifest, three well-formed section shapes, byte-identical stdout/stderr and exit 0 |
| AC-E292-5 | same | 21 defects x open/closed -> exactly the listed code; per-row one code each; message copy; no-heading manifest never gets a code; reader contract |
| AC-E292-6 | same | render, check, check --cut, owners, handoff generate equal the section-removed output for four malformed sections; explicit check --cut test (reviewer request) |
| AC-E292-7 | `test/e292-handoff-sister-sha.test.mjs` | unchanged (7 and 40 char) silent, +1 checked; new commit DIFF (descendant), rewound DIFF, deleted branch `（缺）`; order after fact lines before summary, table order; no-section run unchanged |
| AC-E292-8 | same | unknown repo, no key, unusable config, missing/plain-dir not-git (no path echoed), every error together, malformed section, generate unchanged, sister repo read-only |
| AC-E292-9 | `test/e292-integrator-sop.test.mjs` + re-pinned `test/e178a-integrator-role.test.mjs` AC10 | each literal once in its named section; replaced wordings zero; e178a pin |
| AC-E342-1 | `test/e342-config-doc-wording.test.mjs` | both copies, old phrase absent, rule checked against real `render` behaviour (`..foo` accepted) |
| AC-E343-1..3 | `test/e343-render-pointer-guard.test.mjs` | template once, `replaceLanePointer` 0/1/2/3 occurrences and `$` literal, guard fires key-set, collected with `MAILBOX_ROOT_ABSENT`, no guard key-unset, default template unchanged |
| AC-E344-1, 2 | `test/e285-integrator-session-handoff.test.mjs` (two assertions appended) | `sop.idle-resume` once in Stage 4 as the bullet's last sentence; `sop.handoff-timing` once, old claim zero |

Security smoke: boundary inputs covered in the config test (non-string/empty/oversized-shape/special characters, `~`, UNC, drive paths) and the not-git test (no absolute or configured path echoed).
Coverage: line coverage not measured by tooling in this repo (node --test, no c8); every new branch of `parseSisterRepos`, `readExternalDeps`, `compareExternalDeps`, `replaceLanePointer` and the render guard is exercised by name above.

## AC Execution Log

Raw outputs abbreviated; every command run from the worktree root. `$TMPDIR` is the host temp dir.

| AC | command | result |
|---|---|---|
| AC-E292-1, 3 | `node --test test/e292-config-sister-repos.test.mjs` | 8/8 pass |
| AC-E292-2 | `git diff --quiet a67d799...HEAD -- schema test/config-versioning.test.mjs; echo "exit=$?"` | `exit=0`; test asserts `CURRENT_VERSIONS.config === 2` (pass) |
| AC-E292-4, 5, 6 | `node --test test/e292-external-deps-validate.test.mjs` | 51/51 pass |
| AC-E292-7, 8 | `node --test test/e292-handoff-sister-sha.test.mjs` | 15/15 pass |
| AC-E292-9 | `node --test test/e292-integrator-sop.test.mjs test/e178a-integrator-role.test.mjs` | pass (run within the 45-test group with e285, e342, e289-config-key: 45/45) |
| AC-E342-1 | `node --test test/e342-config-doc-wording.test.mjs test/e289-config-key.test.mjs` | pass |
| AC-E343-1..3 | `node --test test/e343-render-pointer-guard.test.mjs test/e289-render-addendum.test.mjs` | 8/8 + e289 pass |
| AC-E344-1, 2 | `node --test test/e285-integrator-session-handoff.test.mjs` | pass (two new assertions included) |
| AC-HC-1 | `for f in specs/fanout-*.md; do ... validate ...; done` | 25 manifests: exit 0 with no codes for every one except `fanout-wave5.1.md` and `fanout-wave6.md` (exit 2, `DECISIONS_SECTION_ABSENT PINS_SECTION_ABSENT`) — matches the D6 table line for line (all post-v4 w1..w8 present: exit 0) |
| AC-HC-2 | D7 procedure: base `dist scripts package.json` of `a67d799` extracted to `$TMPDIR/e292-base` (node_modules symlinked), each pair run base vs head from the worktree root, stdout + stderr + exit compared | 31 pairs, 0 different: `validate` on all 25 `specs/fanout-*.md` and the 3 `test/fixtures/e177a/*.md`; the `render ... e177a --summary S --reading R1 --reading R2 --mailbox-root /m --primary /p` pair; `handoff specs/fanout-post-v4-w7.md` (exit 0); `handoff --check specs/fanout-post-v4-w7.md` (exit 1 on both sides, identical DIFF output). Base copy removed afterwards. |
| AC-HC-3 | `node --test test/e178a-integrator-role.test.mjs test/e177a-manifest.test.mjs test/e289-render-addendum.test.mjs`; `git diff --quiet a67d799...HEAD -- test/fixtures/e177a/render-e177a.golden.txt; echo "exit=$?"` | green (part of the 244/244 run); `exit=0` |
| AC-HC-4 | the ten named tests; `git diff --quiet a67d799...HEAD -- <six protected tests>; echo "exit=$?"` | green (244/244 with the HC-3 and HC-5 files); `exit=0` |
| AC-HC-5 | `node --test test/context-budget.test.mjs` plus compose-golden readers (`compose-equivalence`, `e130-lane-default`, `e296-manifest-tier`, `e90-golden-capture-completeness`, `skill-manifest`) | all green, no re-pin needed (integrator SOP is not in a composed bundle) |
| AC-HC-6 | `node scripts/fanout.mjs check specs/fanout-post-v4-w8.md e292; echo "exit=$?"` | `fanout check: e292 — 23 file(s) changed, 0 out of bounds`; `exit=0` (re-run after the commit that adds these tests) |
| AC-HC-7 | `node scripts/test-lock.mjs -- npm test` on the final committed HEAD, clean worktree | result in the handoff `qa_review` |

## Defects

None.
## 2026-10-19T07:37:50.342Z — PASS — by qa-engineer

PASS, all seven tasks (evidence qa_reports/review_T-E292-01.md, covers line). Every AC (AC-E292-1..9, AC-E342-1, AC-E343-1..3, AC-E344-1/2) has tests: six new files (e292 config, external-deps validate, handoff sister sha, integrator sop; e342 doc; e343 guard), e178a AC10 re-pinned to sop.stage4-layers, two E344 assertions appended to e285. Hard conditions AC-HC-1..6 proven by their commands (HC-1 matches D6; HC-2 31 pairs base vs head byte-identical; HC-3/4 diffs exit 0; HC-5 green no re-pin; HC-6 fanout check exit 0). AC-HC-7: full suite on committed clean HEAD b2d5e8b via test-lock: 3549/3551 pass, 0 fail, 2 skipped. Expected-red diff clean (1/1, e178a AC10 re-pinned). No defects.

