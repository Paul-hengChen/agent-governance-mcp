# Review — T-E260I-01..11 (lane e260i, comment-only trim of the context-budget and render-structure tests)

covers: T-E260I-01, T-E260I-02, T-E260I-03, T-E260I-04, T-E260I-05, T-E260I-06, T-E260I-07, T-E260I-08, T-E260I-09, T-E260I-10, T-E260I-11

## Round 1 — CHANGES_REQUESTED — by code-reviewer

Range reviewed: ab335b8..d1cddce. Inputs: the lane diff, `specs/e260i-budget-render-comment-trim.md`, `specs/e260i-comment-rationale.md`, `.current/e260i/proof.mjs` and its history, and the author evidence file. The coordinator's brief explicitly assigned that file, so this is a deliberate exception to the clean-context rule. I read it only to list the author's claims to verify, after I had formed my own view from the diff.

## Summary
- Two owned test files changed, comments only (`test/context-budget.test.mjs` 2433 to 1067 lines, `test/render-structure.test.mjs` 820 to 625), plus the proof script, the rationale spec, the author evidence and lane bookkeeping. Nothing outside the AC3 scope.
- I re-ran the proof myself: `node .current/e260i/proof.mjs` and `--list-mid` both print scope ok, emit 2/0 differ, leaves 2/0 differ, >20: 0, 8-20: 0, bare-id 0, directives, form, hygiene, width, reflow and pinned all ok, `proof: PASS`, exit 0. The e122 test is 7/7 green. `node scripts/check-md-tables.mjs` exits 0.
- I ran 12 negative controls on copies (code, string, long block, bare id range, directive, URL plus history call, two pinned-line edits, width, `##` heading, first line, reflow). Every one failed the proof as it should. The proof is sound, and no check was weakened beyond the directive narrowing, which is justified.
- The test comments read well and almost all are accurate. The moved rationale has two factual errors that a reader would act on: a present-tense claim about what the lean bundle loads, which the code contradicts, and a provenance pointer that now sends the reader to a record that does not hold the evidence.
- Verdict: CHANGES_REQUESTED. Both required fixes are confined to `specs/e260i-comment-rationale.md`.

## AC Completeness
AC1 — implemented — proof `emit: 2 files, 0 differ` (re-run)
AC2 — implemented — proof `leaves: 2 files, 0 differ` (re-run)
AC3 — implemented — `scope: ok`; the diff touches only the two owned test files plus `specs/e260i-*`, `qa_reports/E260I_author_*`, `.current/e260i/**`; `test/fixtures/**`, source dirs, `dist/`, `content/`, `docs/` show zero diff
AC4 — implemented — `>20: 0`
AC5 — implemented — `8-20: 0 block(s)` in `--list-mid`, so the "none" row of the Retained blocks table is true; no keep-reasons to copy
AC6 — partial — every pointer names a tracked path (all 27 paths cited in added lines exist under `git ls-files`), and both `## test/<file>` sections exist. But two passages of the moved rationale are not faithful: see R1 and R2 under Correctness. Each is a `required` finding.
AC7 — implemented — `bare-id: 0`; my sampling (below) found the trimmed test comments plain and, with the recommended nits noted, accurate
AC8 — implemented — `directives: ok`, `form: ok`. At base neither file has a real directive comment: the only `c8` hits, `test/context-budget.test.mjs` base lines 1238 and 1250, are prose ("c8-crash-resume-protocol", "the c8 growth"). The first line is unchanged.
AC9 — not judged here (verifier). Emit-identical output means no test was added, removed or renamed.
AC10 — not judged here (verifier)
AC11 — implemented — `hygiene: ok` for comment lines. A manual grep of the rationale spec, the lane spec and the author evidence finds no home path, URL or history-command text. The only sha-like token is the base revision `ab335b8`, recorded in the lane's own spec and evidence by design (the proof reads it). No sha was added to a test comment.
AC12 — implemented — `pinned: ok`; `const NUMHEADER_RE = /` and `const BULLET_RE = /` each occur exactly once, byte-identical to base; `node --test test/e122-state-render-injection.test.mjs` 7/7 pass
AC13 — implemented — `width: ok` with no over-100 warning, `reflow: ok`, and the reflow negative control fires; no merged lines seen in sampling

## Correctness

### Required

**R1 — `specs/e260i-comment-rationale.md:35` and `:64` state as present fact that chain-tagged fragments ship on the lean path. They do not.**
- Line 35: "The lean path loads core-tagged and chain-tagged constitution fragments and the lite coordinator skill, so an edit to any of them moves the figure."
- Line 64: "each bullet is core- or chain-tagged and ships on the lean path by design".
- Code: `LEAN_CONSTITUTION = composeConstitution({ chain: false, design: true })` (`test/context-budget.test.mjs:55`). `includeSegment` returns `opts.chain` for `tag: "chain"` (`prompts/constitution-manifest.ts`), so every chain-tagged fragment is excluded from the lean path, and design-tagged fragments are included.
- Checked at runtime: the lean composition does not contain "Cut-Approval Gate" (`const-08-chain-31-mid.md`) or "3.1 Server-enforced chain". It does contain the core-tagged "Comment discipline" and "Sanctioned git".
- Fix: say "core- and design-tagged" (the v3.28.0 row of the same table already says, correctly, that the design-only line counted on this path). Leave the history rows that mention chain-tagged fragments as the record of what each bump comment said at the time; if you like, add a sentence saying they reflect the bump comments, not the current composition.

**R2 — `specs/e260i-comment-rationale.md:58` (e43 row of the lean cap history) re-points the evidence to a record that does not hold it.**
- Base comment: "Rationale-fencing the bullet's causal clause was considered and REJECTED with the numbers in hand — see qa_reports/review_T-E43-02.md."
- The spec now says "(see the backlog row for that ticket)". The E43 row of `docs/backlog.md` (line 162) says nothing about fencing.
- The decision is recorded in `qa_reports/archive/e43-test-file-ask-at-dispatch/review_T-E43-02.md`, section "Decision: rationale-fencing the §2 bullet — considered, REJECTED".
- Fix: cite that tracked relative path, or drop the parenthetical. Do not send readers to the backlog row. A relative tracked path is fine under AC11 and Generic citation.

### Spot checks that passed
Accuracy sampling of the test comments, all lines at HEAD, at least 10 blocks per task range:
- **T-03 (base 1–720):**
  - 3–7, the header: lite loses only chain rules; additive composition.
  - 32–34: five partial-adopting skills; matches `PARTIAL_ADOPTING_SKILLS`.
  - 100–104.
  - 171–173: hook scope.
  - 191–192: cap rule plus pointer; the assert is 5548.
  - 234–237: hook isolation; matches `runHook`.
  - 266–269 and 280–282: 2575/1070/1505 and the 1200 floor, about 305 below the measured saving.
  - 339–341: the four stripOriginTags tests.
  - 439–441: `PM_RULE_MARKERS` does include the step-1 line.
  - 449–452: the base comment does say nothing else pins the em-dash literal.
  - 461–464: `SR_RULE_MARKERS` has no step-1 marker.
- **T-04 (base 721–942):**
  - 475–478: no claim of 4376; the assert is 4401.
  - 490–492: same composition as the pm test.
  - 502–507: two fenced interiors, matching `CONST_FENCED_INTERIORS`.
  - 554–556 and 559.
- **T-05/T-06/T-07 (943–1696):**
  - 568–572 and 579–582: the coordinator bundle composition matches the code line.
  - The cap-history tables: I diffed every number pair in the moved tables against the base comment text by script. Every spec "X to Y" pair is present in the base comments, and no base arrow pair is missing from the spec. I recomputed by hand 10 "saving" values of the non-design table from the paired design-arm and non-design caps, for example 4957−2872=2085 and 6391−4293=2098, and all match. The handoff-note figures (7859/7863, 8625/8635, 2848) match base.
- **T-08 (1697–2216):**
  - 599–603: fullDetail and the design-only exclusion.
  - 630–634, 731–733, 811–815, 849–853.
  - 893–896: both sides stripRationale∘stripOriginTags; non-design is `design:false`; floor 2080.
  - 933–937: the shared helper; the gate body is in handoff-orchestrator.
  - 952–956.
- **T-09/T-10 (context-budget tail, render-structure):**
  - Render header 2–6.
  - Composed-body helper; code-span skip, which matches `precedingChar !== "`"`.
  - Soundness and hermetic-fixture note; Evidence-Citation pin.
  - Structural sweep: "four asymmetric spans in the PM, QA and architect SOPs" correctly resolves base's internal "3 more … x2 + x1 + x1 … Those 4" inconsistency.
  - Collect-then-assert, which matches `assert.deepEqual` on the map; history-fixture meta header; reconstructed-call helper.
  - Context-budget 997–1000, 1002–1008, 1055–1060.

Deleted base block 353 (39 counted, in the lean test body): it was not lost. Its five bumps (e43, e130, e178a, E231, E258) are rows of the lean cap-history table, and the single pointer at the test head (line 192) covers them. A reader loses only the e43 provenance pointer (R2) and the e178a reviewer-report citation. The latter is redundant with "exact".

Proof-script integrity: the commit history of `.current/e260i/proof.mjs` since base shows two edits after T-01.
- `ba09e94` (T-04) adds `--through <file>:<line>`. It only narrows the >20, 8-20 and bare-id scans when the flag is passed. The default is `Infinity`, so lane-wide runs are unaffected.
- `e22df25` (T-06, not 72a8582 as the brief and the author record say) narrows `DIRECTIVE` from `c8 ` to `\bc8 (?:ignore|disable|enable)`. Real c8 directives (`c8 ignore next|start|stop`, `c8 disable`, `c8 enable`) still match, and my `/* c8 ignore next */` control fails the proof.
- No other check changed.

## Quality

### Recommended (fold into the same round if convenient; none blocks)
- `test/context-budget.test.mjs:568` — "the constitution ships on every dispatch, so the coordinator bundle is the worst case" makes a causal link that base did not claim (base: "injected on every dispatch; the full coordinator bundle is the worst case"). The worst case comes from the coordinator's large skill plus the full chain and design constitution, not from the constitution shipping everywhere.
- `test/context-budget.test.mjs:570` — "so even on a design feature it keeps the full §3.2". "even" inverts the point: §3.2 is chain-design tagged and loads when a chain role is on a design feature. Base: "on a DESIGN feature it must keep the full §3.2".
- `test/context-budget.test.mjs:191`, `:555`, and spec `:35` — "each raise is a qa-owned re-measure" overgeneralizes. The tables themselves list sr-owned bumps (e7, e14-e16), and the lean table's e7 row omits the "(sr-owned)" tag the other tables carry.
- `test/context-budget.test.mjs:630–631` — "the visual governance (§3.2 and the §3.1 visual bullets) is left out" drops base's "minus the reconcile rule, R10". The R10 test below covers the exception, but the header now claims slightly more than the code strips.
- `test/context-budget.test.mjs:897` — a dangling label "Cap history by ticket:" directly above the pointer line; delete it or merge it into the pointer wording.
- `specs/e260i-comment-rationale.md:304` — "lines 119-120 of that file" has no antecedent, because the paragraph never names `content/skill-release-engineer.md` (base did). Name the file.
- `qa_reports/E260I_author_T-E260I-01-11.md`: the directive narrowing landed in T-E260I-06 (`e22df25`), not "T-E260I-05..07". The "Rationale moved" section lists only the later sections and omits the lean, design-arm, coordinator and skill cap histories. Both are evidence-accuracy nits.

### Optional
- SOP 4b `agc check — comments`, two warnings touching the diff:
  - `test/context-budget.test.mjs` high-ratio 38.3%, down from 74.3% at base. Kept: the file ratio is explicitly out of scope, and the block limit (the E260 measure) is met.
  - `.current/e260i/proof.mjs:1` long-block 9: lane tooling, not shipped. Kept.
- Untouched short blocks (7 lines or fewer, out of the E260 trim threshold) in `test/context-budget.test.mjs` still open with slug-plus-task-id provenance (for example lines 24, 43, 176, 622, 641, 775, 835, 921, 1016). They have plain words, so they pass Generic citation. Not this lane's scope.

## Architecture
No architecture spec. Layering untouched: test comments, one new tracked rationale spec, lane-local proof script. The chain design (qa author → independent reviewer → fresh qa verifier) was followed.

## Security
No findings. New text carries no secrets, local absolute paths, URLs or shas beyond the lane's own recorded base revision. The proof's hygiene check fires on my planted URL and history-call control.

## Performance
No findings. Comment-only; the transpiled output of both files is byte-identical to base.

## Verdict
CHANGES_REQUESTED — the proof is sound and the trim is otherwise good, but the moved rationale states a false present-tense fact about the lean bundle's composition (R1) and redirects the e43 fencing-rejection evidence to a record that does not contain it (R2). Both are small spec-only fixes; the recommended comment nits can ride along in the same round.

Follow-up ticket filed in `.current/e260i/pending-tickets.md`: E260I-NEW-1, about two test titles whose stated caps lag their asserts. The test-title drift is out of scope for a comment-only lane.
