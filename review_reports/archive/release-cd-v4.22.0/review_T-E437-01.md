# Review — T-E437-01 (batched round, e437-prompt-content-hygiene)

covers: T-E437-01, T-E437-02, T-E438-01, T-E438-02, T-E438-03, T-E439-01, T-E439-02, T-E440-01

## Round 1 — APPROVED — by code-reviewer

Reviewer: code-reviewer (opus), Task-dispatched, clean context. Inputs: `git diff 41c301e...HEAD -- content templates` (da8a651..c0b9b23), `specs/e437-prompt-content-hygiene.md`, `prompts/text-transforms.ts` (`stripOriginTags`, `stripRationale`), and `qa_reports/expected-red_e437-prompt-content-hygiene.txt` (SOP 4a carve-out). Method: rendered every changed file at base and head through `applyTextTransforms` (dispatch, `fullDetail: false`) and full-detail (`fullDetail: true`), then diffed the renders character by character, so every claim below is checked on the text an agent actually reads. sr-engineer and reviewer both ran on opus; same-model bias is possible, so the checks below are mechanical where they can be.

## Summary
- 19 `content/**` files and `templates/claude-code-agents/lite.md` line 9 changed; no file outside the cut's `touches` sets. No `test/**`, `tools/**`, `dist/**`, `guards/**`, `CLAUDE.md`, `docs/backlog.md`, `content/const-01-core-head.md` or `content/skill-release-engineer.md` change; `lite.md` line 7 is byte-identical.
- E437: 13 sites changed as the table says. E438: 45 sites (15 in skill-integrator), 4 renames, 2 deletions. E439: site 1 deleted (R1 = b), sites 2–11 fenced. E440: 6 rewrites.
- Dispatch render: every changed line keeps its line number (no glued lines), every "rule left outside" sentence is present verbatim, every story and label is gone, and the counts of double spaces, space-before-punctuation and empty parentheses are the same at base and head.
- Full-detail render: E439 adds markers only, except the two sanctioned exceptions and one placement at site 8 that cannot be markers-only (see Correctness).
- Verdict: APPROVED.

## AC Completeness
AC-E437-1 — implemented — const-10:3, const-08:7, coord-02:1 (×2), skill-pm:108, skill-design-auditor:54, skill-qa-visual:12, 24, skill-doc-writer:15, skill-coordinator-lite:16, 43, lite.md:9 (×2); none of the listed repo-only paths remains at these sites; the three paths an agent opens carry `<agc install>/`.
AC-E437-2 — implemented — lite.md:9 reads `` follow the coordinator-lite SOP from `<agc install>/content/skill-coordinator-lite.md` (`<agc install>` = agc's install directory, not the workspace) `` and ends `…has no such check.`; line 7 untouched. Re-pins of the four named test files are qa's (T-E437-03).
AC-E437-3 — implemented — skill-qa-visual.md:24 quoted note is exactly `context-dependent property requires per-context baseline`.
AC-E438-1 — implemented — a scan of every stripped `content/*.md` (except constitution-rationale.md) for `E\d+`, `vX.Y.Z` and `[A-Z]{1,2}\d+` finds none of the 45 labels; what remains is vocabulary (H2, P0–P3, B0–B2, T01, AC1 in examples, `F0` placeholders, the forbidden release-engineer `E1,E2` placeholder).
AC-E438-2 — implemented — each wrapped label sits inside `<!-- origin:start -->…<!-- origin:end -->` with its leading separator, as the neighbouring fences do; sites 36, 45 deleted; 17, 39, 40, 42 renamed.
AC-E438-3 — implemented — `grep -rn "§1 v3.14.0 exception\|§1 v3.28.0\|sr-engineer R5" content templates` returns nothing; targets present in the stripped text: const-02:2 `Visual Widgets exception`, const-02:4 `Design-sourced assets`, skill-sr-engineer:23 `Scoped Render Self-Check`.
AC-E439-1 — implemented — all 11 stories absent from the dispatch render, each "rule left outside" present verbatim (checked string by string).
AC-E439-2 — implemented, with one unavoidable deviation at site 8 (Correctness C1) — every other E439 full-detail hunk is marker insertion only, plus the site-5 `;`→`.` / `design-auditor`→`Design-auditor` and the R1 = b deletion.
AC-E439-3 — implemented — `node --test test/render-structure.test.mjs` passes, no test edit.
AC-E440-1 — implemented — the six sites read as the rewritten-text column (site 2 deleted); `grep -n "pre-v3.20.0\|is REMOVED\|is retired\|no remaining routing convention" content/*.md` returns nothing.
AC-E440-2 — implemented — const-08:10, skill-pm:95, coord-03:38 and coord-03:99 (the `legacy … inert` sentences) are not in the diff.
AC-ALL-1 — implemented — `npm run build` leaves `git status --porcelain` showing only `.current/e437/` state files; `dist/` zero diff.
AC-ALL-2 — not this round's scope — golden re-capture is qa's T-E440-03; the 12 golden reds are in the manifest.
AC-ALL-3 — not this round's scope — budget re-baseline is qa's T-E440-03; the 4 budget reds are in the manifest.
AC-ALL-4 — see the suite line under Correctness; the remaining reds are exactly the manifest.
AC-ALL-5 — implemented — `git diff 41c301e...HEAD --name-only` lists only `.current/e437/*`, the 19 content files, `lite.md`, the spec and the expected-red manifest.

## Correctness
- **C1 (no change requested) — E439 site 8, `content/skill-design-auditor.md:59–60`.** The story moved to its own column-0 line: `<!-- rationale:start -->(Method and rationale: \`research/figma-baselines.md\`.)<!-- rationale:end -->`. In the full-detail render the one space before `(Method` becomes a newline. I checked whether a markers-only placement was possible and it is not. The story is the line's last text and ends in `)`, so `<!-- rationale:end -->` must sit right before the line's only newline; `stripRationale` consumes one `\n` after the end marker (`/…<!-- rationale:end -->\n?/`), and the next line is the bullet `   - **Server-enforced at PASS …`, not a blank line, so every inline placement glues that bullet onto line 59 (the asymmetric span the render-structure detector catches). Origin markers can't hold the newline in place, because `stripOriginTags` runs first, and a second empty rationale span either consumes the newline itself or leaks a marker. So every compliant placement changes at least one non-marker byte, and this one changes exactly one. The spec's Fence placement constraint names block style as an allowed shape. The dispatch render is correct: line 59 ends `…every selected node.` and the bullet stays on its own line. The full-detail line is a lazy continuation of the list-item paragraph and reads the same. qa's hunk-by-hunk golden note must attribute this hunk to E439 site 8 (as an AC-E439-2 deviation that can't be avoided), otherwise it will look like a site-less hunk.
- Site 3 (`skill-architect.md:27`): the fence is `PM<start>. Closes … comparator<end>.`, so a `.` follows the end marker. Stripped: `…block back to PM.` Full-detail: markers only. Correct.
- Sites 2, 4, 5, 6, 7, 9, 10, 11: the leading space is inside the fence and the end marker is followed by `.` or ` `. Every stripped line is single-spaced and keeps its line number.
- Site 1 (R1 = b): base lines 3–8 (the blank line and the 5-line paragraph) are deleted. The heading is followed by one blank line, then the first bullet. §3.x is still fence-free; context-budget AC7 ×2 and AC2/AC4 pass.
- E438 site 2 (`const-13:6`): the label ends at a line end inside `(the …\nself-arming signal)`. The origin regex does not consume the newline, and the trailing-space trim leaves `(the\nself-arming signal)`. Correct.
- E438 site 18–32 #9b (`skill-integrator:166`): `(<origin>E182, </origin>\`test-lock\`; …)` strips to `(\`test-lock\`; CI runs are parallel by design)`. Grammatical.
- E440 site 2 deletion: coord-03:1 now ends at `…follow the returned SOP in the same context.`, which is a complete fallback rule.
- No orphaned references: none of the fenced ids (R10, E1, E4, R5, D11, …) appears outside a fence anywhere in stripped `content/*.md`, so no rule names an id that exists only inside a fence. The R5 reference was renamed (site 42).
- Expected-red manifest (SOP 4a): 32 entries, each a `file | test name` pair. I sampled 5 by grepping the named file: `test/context-budget.test.mjs` "AC8/AC-P2-7: non-design (design-only + rationale stripped)…" (red on the `design-only strip saving (1903) ≥ 1999` assertion, the R2 = a floor), `test/feature-lease.test.mjs` "S5: …Feature-Scope Gate note (T-E1-03)", `test/e407-restatement-citations.test.mjs` "AC4: coord-05 Drift Reconcile body…", `test/e130-lane-default.test.mjs` "AC7: the pre-v3.20.0 degradation sentence…", `test/compose-equivalence.test.mjs` "…hook-lite.txt". All 5 exist and are attributable to a spec site. Targeted run: `node --test test/context-budget.test.mjs test/render-structure.test.mjs` gives exactly the 4 manifest context-budget reds, 65 pass.
- Full suite (`node scripts/test-lock.mjs -- npm test`, tree at 0ceb255, after `npm run build`): 4228 tests, 4194 pass, 32 fail, 2 skipped. The set of failing test names equals the 32 manifest entries exactly (`comm` both ways empty). No environment-only test, no e436-owned test, and no unlisted test is red.

## Quality
- No stray edits: each commit touches only its task's sites (per-commit `--stat` checked against the task table).
- Fence style matches the neighbouring fences (leading separator inside, as in `<!-- origin:start --> (v3.26.0)<!-- origin:end -->`).
- `<agc install>` inline definition at skill-coordinator-lite:43 and lite.md:9 copies skill-qa-engineer:60's wording verbatim. The coordinator bundle's new `<agc install>/templates/claude-code-agents/` (coord-02:1) follows the existing undefined-prefix convention of coord-03:11/45 and const-08:4, as the spec intends.
- optional: `content/skill-sr-engineer.md:29` still carries `**AC6 escape**`, a spec AC id used as a name, in the dispatch text. It predates this diff and is outside the cut's 45 sites (the spec's recount did not list it). Report only, no ticket.

## Architecture
No architecture spec for this feature. The change uses the two strip mechanisms that already exist (`stripOriginTags`, `stripRationale`); no TypeScript, tool, gate or schema change.

## Security
No findings. Prose only; no new input crosses a trust boundary. E437 removes repo-internal path citations from adopter-shipped text, a small information-hygiene improvement.

## Performance
No findings. Every dispatch bundle shrinks or stays the same except the raw lean measure (+30 ~tok of origin markers, counted unstripped). That cap re-baseline is sanctioned (ruling 2 = a) and is qa's T-E440-03.

## Verdict
APPROVED — all eight build tasks implement their site tables exactly. The dispatch text is complete and glue-free. The one non-marker full-detail byte (E439 site 8) cannot be avoided under `stripRationale`'s newline handling and uses the spec's sanctioned block style. Every red is in the expected-red manifest.
