# Review — T-E381-01

covers: T-E381-01, T-E381-02, T-E381-03

Round 1 — APPROVED — by code-reviewer (opus). Range reviewed: `2425e04...7e2700c` (three dots), `.current/e381/` bookkeeping ignored. Contract: `specs/e381-fanout-and-ledger-fixes.md` (no architecture spec; manifest ruling). This file holds the T-E381-01 (E381) review plus the lane-wide checks; T-E381-02 and T-E381-03 have their own reports beside it.

Same-model note: sr-engineer and this reviewer both ran on the opus tier, so blind spots may be shared. The edge-case probes below were written independently of the sr notes to offset that.

## Summary
- Adds exported `ownedPathTokens(cell)` beside `pathTokens` and switches only `parseManifest`'s `ownedTokens` to it (`tools/fanout-manifest.ts:427-495`, `:650`). `pathTokens`, `forbiddenTokens` (`:679`) and Cut `touches` (`:2007`) are untouched.
- Rule as implemented: list items split at `、` `，` `,` `；` `;` outside spans and outside parentheses; a glob span is dropped when it sits at paren depth > 0 or when its item's lead (text before the first depth-0 span) is non-blank after removing one `<label>：`/`<label>:` and then `新檔`. Non-glob spans are kept exactly as before.
- Every consumer of the owned set (`check` diff loop `:1774`, unmatched-owned `:1790`, `check --cut` `:2107-2108`, `owners` `:2231`, the owned report line `:1826`) reads `lane.ownedTokens`, so the narrower grant applies to all machine checks consistently; no consumer re-tokenizes the raw cell.
- Scope is contained: the diff touches only owned files (`tools/fanout-manifest.ts`, `tools/tasks-lane-migrate.ts`, the one `scripts/fanout.mjs` usage-comment line, the eight owned `dist/tools/{fanout-manifest,tasks-lane-migrate}.*` files, the expected-red manifest, the spec, `.current/e381/`). `fanout.mjs check specs/fanout-backlog-wave-a.md e381 --base 2425e04` reports 16 files, 0 out of bounds; `npm run build` on HEAD leaves only the uncommitted `.current/e381/` writes, so `dist/` is reproducible.
- Verdict: APPROVED.

## AC Completeness
AC-E381-1 — implemented — `tools/fanout-manifest.ts:455-495`; probe: the three AC cells give `["scripts/**","test/e9-x.test.mjs"]`, `["scripts/**"]`, and nothing from the `上列檔案對應的 \`dist/**\`` item.
AC-E381-2 — implemented — `:476-478` (depth tracking, ASCII and full-width); probe: both paren forms give `["specs/**"]`; a glob two deep, in mixed full-width/ASCII nesting, is dropped.
AC-E381-3 — implemented — `:439-443` (`isProseLead`), `:488-493`; probe: compose-golden glob with a parenthesised `；` qualifier kept, `qa：新檔 …` both globs kept, `新檔 \`tools/x.ts\`` kept, `\`tools/a.ts\` 與其 \`dist/tools/a.*\`` both kept, the parenthesised concrete `feature-rollup.mjs` kept.
AC-E381-4 — implemented — review-time one-liner prints `lanes 5 differ 0`; `validate` unaffected for wave A.
AC-E381-5 — implemented (code path) — `check` and `check --cut` both read `lane.ownedTokens` (`:1774`, `:2107-2108`); the resident test is qa's T-E381-04.
AC-E381-6 — implemented — `forbiddenTokens: pathTokens(forbidden)` unchanged (`:679`); `pathTokens` body unchanged (`:423-425`).
AC-L2 — implemented — `git diff --stat 2425e04...HEAD -- dist/` lists 8 files, all owned; rebuild leaves `dist/` clean.
AC-L1, AC-L3 (audit / bookkeeping parts) — qa scope (T-E381-07); the `fanout.mjs check … e381` part passes at review time.

## Correctness
No required findings. Paren and clause handling probed directly against the built `dist/`:
- Full-width and ASCII parens are counted together, so mixed nesting such as `（a(\`y/**\`)b）` works; a stray close paren clamps at 0 (`:477`), so it cannot push later items negative.
- An unclosed open paren leaves the rest of the cell at depth > 0: separators stop splitting, later globs drop, later concrete paths stay (probe `\`a/**\`（unclosed、\`b/**\`、\`c.ts\`` gives `["a/**","c.ts"]`). That is the loud direction (an `OUT` line), as the spec intends.
- Separators and parens inside a backtick span are never scanned, because spans are cut out by the same `/\`([^\`]+)\`/g` regex `backtickSpans` uses (`:411` vs `:482`), and span text is trimmed the same way. Non-glob output is therefore identical to `pathTokens`.
- The lead is only accumulated before the first depth-0 span; a span inside a paren before that point is appended to the lead (`:485`), which makes the item prose-led. That is again the loud direction and is consistent with the spec's "text before its first depth-0 backtick span".

Historical manifests (all 39 `specs/fanout-*.md`, comparing `pathTokens(owned)` with `ownedTokens`): every dropped grant is a prose-led or parenthesised glob. Two drops are not named in the spec's planning-simulation list (see the first optional finding below).

- optional — The spec's planning-simulation list (Dependencies) does not name two historical drops this rule also makes: `specs/fanout-wave5.1.md` lane e179 `qa_reports/` and `review_reports/` (item "its `qa_reports/` + `review_reports/`", prose-led), and `specs/fanout-wave7.md` lane e177a `dist/tools/*.js` (inside "（薄殼，吃 `dist/tools/*.js`，…）"). Both are closed waves and both are already covered (implicit bookkeeping covers `qa_reports|review_reports/*e179*`; e177a also owns `dist/**`), so nothing goes red. Noted only so the record matches.
- optional — A role label with whitespace before the colon (`qa : \`t/**\``) counts as prose and drops the glob. This is what the approved rule says ("no whitespace before the colon"), and it errs loud; flagged only so qa can pin it if wanted.

Expected-red sampling (SOP 4a): `qa_reports/expected-red_e381-fanout-and-ledger-fixes.txt` exists with one entry, `test/e177a-manifest.test.mjs | AC1 wave7 parses`. The test is at `test/e177a-manifest.test.mjs:74`, and its expected list (`:88-96`) includes `.current/e177a/`, which the rule now drops (fixture item "自己的 spec／證據／`.current/e177a/`"). Targeted run (`test/e177a-*`, `e178b-*`, `e383-*`, `e125a-*`, `e386-*`, `e296-*`, `lane-paths`) gave 188 tests, 187 pass, 1 fail: exactly that entry.

## Quality
- optional — `agc check — comments` flags the `ownedPathTokens` doc block (`tools/fanout-manifest.ts:445`, 8 lines against a limit of 7). Kept: the spec requires that the doc comment state the rule and why only globs are dropped, and the block does only that. Trimming one line is fine but not needed.
- Helpers (`OWNED_ITEM_SEPARATORS`, `OPEN_PARENS`, `CLOSE_PARENS`, `ROLE_LABEL_RE`, `NEW_FILE_MARKER`, `isProseLead`) are named for what they do and sit next to `pathTokens`. Comments contain no local paths and no sensitive data.
- Strict typing: the local `Item` interface is fully typed and there is no `any`; `tsc` builds with zero errors.

## Architecture
No architecture spec (manifest ruling: no architect hop). The change is local to the tokenizer layer and fits the existing `pathTokens` / `isGlobToken` / `isPathToken` seams. `validate` semantics change only through `ownedTokens` (for example `OWNED_EMPTY` if a cell held only prose globs), which the spec's Out of Scope explicitly allows.

## Security
No findings. The function is pure string processing on manifest text; it adds no I/O or subprocess and does not cross a trust boundary.

## Performance
No findings. One linear pass over the cell plus one regex scan per cell; same complexity class as `pathTokens`.

## Verdict
APPROVED — `ownedPathTokens` implements D-E381 exactly as approved (owned cell only, globs only, depth- and prose-lead-based, with the label/`新檔` allowance), every owned-set consumer follows it, scope and `dist/` stay within the lane's owned set, and the only red is the declared expected-red.
