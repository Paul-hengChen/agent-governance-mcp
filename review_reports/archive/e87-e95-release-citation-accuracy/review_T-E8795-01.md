# Review — T-E8795-01

covers: T-E8795-01

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- Two content-only additions: an evidence-citation convention at `content/coord-03-core-fallback.md:52` (E87 option (i)) and a CHANGELOG citation check at `content/skill-release-engineer.md:203` (E95 option (i)).
- **F1 (blocking)**: the E87 convention prescribes the *wrong archive tree* for `review_reports/` citations. The two archive trees are explicitly PARALLEL and share the basename `review_<id>.md`, so the convention manufactures permanently-unresolvable paths for half the evidence files it governs — strictly worse than the pre-archive paths it replaces.
- **F2 (blocking)**: the E95 bullet's worked example is factually wrong on two checkable claims, verified against the `v3.104.2` commit. An example illustrating "verify citations against the diff" that fails its own check.
- **F3**: E87's convention is placed in a section that reads and starts tickets, never authors rows — it misses the mid-cut filings that are its own trigger population.
- **F4**: neither addition fences its rationale, so the repo's own `stripRationale` pass cannot remove it; the coordinator cap overrun is measurably self-inflicted.
- Verdict: CHANGES_REQUESTED.

## Correctness

**F1 — BLOCKING. Wrong archive tree for `review_reports/` evidence. `content/coord-03-core-fallback.md:52`.**

The convention reads:

> a new or amended row that cites a `qa_reports/`/`review_reports/` evidence file MUST cite its eventual archive path — `qa_reports/archive/<feature>/review_<id>.md` — never the pre-archive root path.

It governs two source trees but offers exactly one destination template, rooted at `qa_reports/`. That is contradicted by the release SOP the convention itself cites:

- `content/skill-release-engineer.md:39` (Artifact allowlist): `review_reports/archive/**` is "a PARALLEL tree to `qa_reports/archive/**`, **never folded into it**".
- `content/skill-release-engineer.md:62` (step 7a): moves evidence "out of `qa_reports/` root into `qa_reports/archive/<active_feature>/`, **and** out of `review_reports/` root into a PARALLEL `review_reports/archive/<active_feature>/`".

Confirmed on disk — the two trees exist side by side and hold different features' files (`qa_reports/archive/d5-server-side-stale-dispatch-detection/review_T-D5-01.md` vs `review_reports/archive/e111-lane-worktree-evidence/review_T-E111-01.md`).

Consequence: a row citing this very review (`review_reports/review_T-E8795-01.md`) is instructed to write `qa_reports/archive/e87-e95-release-citation-accuracy/review_T-E8795-01.md`. That file will never exist — not before the release, not after it, not ever. The failure is silent and highly plausible because **both trees use the identical basename `review_<id>.md`**, so the wrong path is well-formed and passes casual inspection; only an actual resolver (E87's own option (iii)) would catch it.

This inverts the row's premise. The row trades "briefly wrong" for "durably right"; as shipped, `review_reports/` citations get "durably wrong" — worse than the status quo, which is at least correct until the release runs. Fix: give the convention both destinations, keyed on the source tree (`qa_reports/…` → `qa_reports/archive/<feature>/…`; `review_reports/…` → `review_reports/archive/<feature>/…`).

**F2 — BLOCKING. The E95 bullet's example is inaccurate. `content/skill-release-engineer.md:203`.**

The bullet reads:

> (v3.104.2 credited a `GATE_REGISTRY` count fix to three untouched `content/skill-*.md` files instead of the actual `CONTRIBUTING.md`/`docs/architecture.md` sites).

Checked against the actual commit (`git show --name-only v3.104.2`):

| claim | verified | reality |
|---|---|---|
| `content/skill-qa-engineer.md` untouched | yes | absent from the commit |
| `content/skill-code-reviewer.md` untouched | yes | absent from the commit |
| `content/skill-release-engineer.md` untouched | **no** | **present in the commit** (for the decorative pin count / no-trailer fallback change) |
| `docs/architecture.md` is an actual site | yes | present in the commit; carries the count at `docs/architecture.md:112` |
| `CONTRIBUTING.md` is an actual site | **no** | **absent from the v3.104.2 commit.** Its `GATE_REGISTRY … 33 entries` text landed in `b55991a` — the **v3.104.3** corrective patch |

So "three untouched" is wrong for one of the three, and one of the two "actual sites" was not in the release being described. (The `CONTRIBUTING.md` absence is precisely the E94 defect already documented in the bullet immediately above this one at line 202 — the two bullets now disagree about the same commit.)

This matters more than a normal prose slip: the bullet's entire method is "compare cited paths against `git diff --cached --name-only`". Applying the bullet's own method to the bullet's own example fails on two of its claims. Per the assignment's standard — a convention illustrated by a wrong example is worse than one with no example — this must be corrected or the example dropped.

Suggested accurate form: `v3.104.2 credited a GATE_REGISTRY count fix to three content/skill-*.md files that never carried the count; the real sites, CONTRIBUTING.md and docs/architecture.md, took it in the v3.104.3 corrective patch.`

**F5 — minor. Filename template is narrower than the rule's own scope. `content/coord-03-core-fallback.md:52`.**

The rule's antecedent is "a `qa_reports/`/`review_reports/` evidence file", but the template only covers `review_<id>.md`. Step 7a also archives `expected-red_<feature>.txt` (present at `qa_reports/archive/d5-server-side-stale-dispatch-detection/expected-red_d5-…txt`), which is a `qa_reports/` evidence file a row can legitimately cite. Prefer a directory-level template (`<tree>/archive/<feature>/<file>`) over a filename-level one — it is also shorter, which serves F4.

**Expected-red sampling (SOP 4a): not armed.** The diff touches no test files, and the two known reds are content-driven golden/budget assertions owned by T-E8795-02. No `expected-red_<feature>.txt` is required. Per the assignment the two reds were not treated as findings.

## Quality

**F4 — rationale is not fenced, and the cap overrun is the direct consequence. Both files.**

`prompts/build.ts:369` applies `applyTextTransforms(taggedBody, { fullDetail })` to composed skill/coordinator bundles, with `fullDetail=false` on **every** `buildPromptForRole` dispatch (the comment at `prompts/build.ts:365-368` states this explicitly, and `tools/role.ts` mirrors it). `content/skill-release-engineer.md` already uses the mechanism in 4 places. Neither new addition uses it.

Measured, not estimated:

- The coord-03 addition is **405 chars ≈ 101 ~tok**. The design-arm bundle is over its floor by **exactly 100**. The addition *is* the entire overrun — no other delta contributes.
- Its second sentence ("Release-engineer's step 7a moves it there … afterward.") is pure rationale: **159 chars ≈ 39 ~tok**. Fencing it recovers ~39 ~tok from every dispatched coordinator bundle while keeping the "why" for `fullDetail` and for human readers.
- The E95 parenthetical is likewise rationale, and sits in a file that already fences four such passages.

**Is the addition worth its ~100 tokens?** As written, no — and the question is partly malformed, because ~39 of those 100 tokens are avoidable by a mechanism this repo already built and already uses in the sibling file. Fencing alone leaves ~62 over the floor; fencing *plus* tightening the normative sentence (fold F5's directory-level template in, drop "new or amended", drop the restated tree names) brings the normative residue to roughly 150-170 chars ≈ 38-43 ~tok, which lands at or under the existing floor. **Recommendation: do not raise the cap a second time in two features for text the repo's own strip pass is designed to remove.** Re-measure after the fix; if it fits, T-E8795-02's budget re-baseline reduces to the golden refresh alone.

The obligation survives the compression intact — the enforceable content is "cite the archive path, not the root path, in the tree the file actually lives in", which is one sentence.

## Architecture

**F3 — E87's placement is in a section whose scope is a different verb. `content/coord-03-core-fallback.md:52`.**

The deviation's *exclusion* half is sound and I verified it independently: `content/skill-pm.md:12-13` lists only `specs/<feature>.md` and `tw_add_task`/`tasks.md` as PM artifacts — `docs/backlog.md` is absent — and `content/skill-pm.md:79` assigns backlog done-marking to release-engineer. PM does not author backlog rows per its own SOP, so `skill-pm.md` would have been the wrong home. That much of the justification holds.

The *inclusion* half does not. `## Backlog Intake Loop` is scoped by its own opening line to "**At feature close** — the *PASS* stop-condition row fired, or a human-decided release just completed". Its four steps read the backlog, classify the next ticket, and auto-start or auto-propose it. **No step in the section authors or amends a row.** The convention was appended after the closing `Bounds:` paragraph, i.e. after the section's scope has already been delimited.

The assignment's question — can a row be authored on a path that never traverses this loop — resolves affirmatively, and this feature's own provenance is the proof. `scope_decision_why` records that E131 and the E91 premise correction were "filed" mid-cut during Phase 3a, not at feature close; a code-reviewer finding promoted to a row (the literal origin of E87 itself, filed by release-engineer at the v3.103.1 close-out) likewise never passes through an intake loop. So the convention has been placed where the coordinator *selects* rows, while the filings that break citations happen where the coordinator *writes* them. It misses its own trigger population.

Fix options, in preference order: (a) place it in a coordinator surface that governs row authoring/finding-capture rather than intake; (b) if no such surface exists, give it its own short `## Evidence-citation convention` heading at the same level so it is not read as a sub-clause of a feature-close-scoped loop. (b) is nearly free and is what I would take under the budget pressure.

Minor, fold into the fix: "a new or amended **row**" is unqualified. `content/const-08-chain-31-mid.md:10` canonically names the *root* path `review_reports/review_<task-id>.md` as the protocol's evidence artifact, which is correct and must stay. Scope the convention explicitly to `docs/backlog.md` rows so no reader extends it to protocol references or handoff notes.

**No-restatement check (clean).** I grepped all 15 `content/const-*.md` fragments for citation/evidence/archive/CHANGELOG rules. Neither addition restates a constitution rule. `const-01-core-head.md:28` reserves output-length policy to the constitution and forbids skills defining their own word caps — neither addition does. `const-08-chain-31-mid.md:10` is the only adjacent text and it governs the handoff evidence artifact, not backlog-row citations. No finding.

## Security
No findings. Both additions are documentation prose; no new input crosses a trust boundary, no secrets, no executable change. The E95 bullet prescribes `git diff --cached --name-only`, a read-only command with no interpolated argument.

## Performance
No findings on runtime. The only cost is context: measured at ~101 ~tok per coordinator dispatch for the coord-03 addition (see F4), which is a permanent per-dispatch tax rather than a one-time cost — hence the terseness findings are load-bearing, not stylistic.

## Verdict
CHANGES_REQUESTED — F1 prescribes a citation path that can never resolve for `review_reports/` evidence, defeating the row's purpose and regressing on the status quo; F2's example is falsified by the commit it cites, in a bullet whose whole subject is citation accuracy.

---

## Round 2 — APPROVED — by code-reviewer

## Summary
- All four round-1 findings are fixed. F1's template now resolves for every case step 7a governs; F2's example is accurate on every checkable claim; F3's placement is correct and my own round-1 counter-evidence was wrong; F4's fences are well-formed and verified in both strip modes.
- **F2 is settled against my round 1, in sr-engineer's favour.** My round-1 *table* was right; my round-1 *suggested rewrite* was wrong, and sr-engineer was correct to re-derive from the commits rather than trust it.
- **F3 is settled against my round 1.** E87's own row says release-engineer *found and recommended* the row — it did not author it. `content/skill-release-engineer.md:34` forbids it from authoring. The coordinator is the sole row-author; coord-03 alone is sufficient coverage. No second surface, no extra tokens.
- **The cap decision: (a) — approve and re-baseline to 18369.** Option (b) is arithmetically unavailable (below), and the failure this prevents is permanent and unrepairable by any role.
- Verdict: APPROVED.

## Correctness

**F1 — RESOLVED. Template probed against all five archive cases; cannot reproduce the round-1 defect.**

Current text, `content/coord-03-core-fallback.md:53`:

> A `docs/backlog.md` row that cites a `qa_reports/`/`review_reports/` evidence file MUST cite its eventual archive path — `<tree>/archive/<feature>/<file>`, `<tree>` matching the file's own source tree — never the pre-archive root.

Probed against every move step 7a performs:

| step 7a rule | source | template resolves to | correct |
|---|---|---|---|
| `skill-release-engineer.md:175` | `qa_reports/review_<id>.md` | `qa_reports/archive/<f>/review_<id>.md` | yes |
| `skill-release-engineer.md:175` | `qa_reports/visual_<id>.md` | `qa_reports/archive/<f>/visual_<id>.md` | yes |
| `skill-release-engineer.md:176` | `review_reports/review_<id>.md` | `review_reports/archive/<f>/review_<id>.md` | yes — the round-1 defect |
| `skill-release-engineer.md:177` | `qa_reports/expected-red_<f>.txt` | `qa_reports/archive/<f>/expected-red_<f>.txt` | yes — the round-1 F5 gap |
| `skill-release-engineer.md:178` (`covers:` sweep) | either tree | "into its OWN tree's archive dir" | yes |

Every rule preserves the filename verbatim ("preserving filenames", lines 175-176), so `<file>` = basename is exact, not approximate. `<tree>` is now bound to the file's own source tree, which is the precise property the round-1 defect violated: the shape can no longer emit a `qa_reports/archive/...` path for a `review_reports/` file. The defect class — a well-formed path that silently never exists — is closed by construction, because the only free variable that could mis-resolve is now derived from the source path itself.

Both non-`review_<id>.md` filename families were probed on disk and resolve: `expected-red_<feature>.txt` (39 instances across both archive trees) and `visual_<id>.md`.

**Residual, non-blocking — `<feature>` is the *releasing* feature, not the citing row's.** `skill-release-engineer.md:138` names the archive dir after `active_feature` "regardless of how many codes are in `<CODES>`". Verified live: v3.104.2 archived `review_T-E6X-01.md` under `qa_reports/archive/e61-e62-e70-prose-accuracy/` — a batch name, not a ticket code. So for a row filed mid-cut, `<feature>` resolves correctly only because nothing commits until that same release ships (this batch's own workflow). A row citing evidence that ends up shipping under a *different* `active_feature` (batch re-split, rename, abandonment) still mis-resolves.

This is a residual of the archive mechanism, not of the wording — no convention line can fix it, only E87 option (iii) (a resolver) can. It is strictly narrower than the round-1 defect, which mis-resolved half the governed population deterministically. Recording it as a known limit of option (i), which is exactly what E87's row already predicts ("(iii) catches what (i) misses"). Not a blocker.

**F2 — RESOLVED, and settled against my round 1. `content/skill-release-engineer.md:205`.**

I re-derived from the commits directly rather than from either report. The v3.104.2 CHANGELOG entry (`de9326c`) claims:

> GATE_REGISTRY count incremented 32 → 33 and declared at three live prose sites (`content/skill-qa-engineer.md`, `content/skill-code-reviewer.md`, `content/skill-release-engineer.md`).

Verified against the commit:

| claim | verdict | evidence |
|---|---|---|
| the 32→33 increment landed in v3.104.2 | true | one hunk only: `docs/architecture.md`, hunk header `@@ -112 +112 @@` |
| `skill-qa-engineer.md` carried the count | false | the string is absent from the file entirely at v3.104.2 |
| `skill-code-reviewer.md` carried the count | false | absent from the file entirely at v3.104.2 |
| `skill-release-engineer.md` carried the count *in that diff* | false | file **is** in the commit, but its 4 changed lines are the README pin-count and `Co-Authored-By` fallback edits; `(33 gate definitions)` was **already present at v3.104.1** — unchanged by this release |
| `CONTRIBUTING.md` was a v3.104.2 site | false | absent from the commit; its `32 → 33` edit is in `b55991a` = **v3.104.3** |

**Who was right.** My round-1 table was correct on every row. My round-1 *suggested accurate form* was not — it read "the real sites, CONTRIBUTING.md and docs/architecture.md, took it in the v3.104.3 corrective patch", which is wrong twice (CONTRIBUTING.md was not a v3.104.2 site, and architecture.md took it in v3.104.2, not v3.104.3). sr-engineer explicitly declined to trust that suggestion and re-derived from the tags. That was the right call and it produced the correct text. The shipped sentence is accurate on all four of its claims, including the subtle one — "none of which carried the count *in that diff*" is precisely the right qualifier for `skill-release-engineer.md`, which is in the commit but not for the count.

There is no remaining disagreement between us: we were describing the same commits, and the error was confined to my suggested wording, which sr-engineer discarded.

**Non-blocking — the prescribed check is coarser than its own example.** The bullet prescribes `git diff --cached --name-only` and "confirm every file path named in this release's new CHANGELOG entry appears in it". Applied to v3.104.2, that catches 3 of the 4 miscitations (`skill-qa-engineer.md`, `skill-code-reviewer.md`, `CONTRIBUTING.md` — all absent from the cached diff) but **not** `skill-release-engineer.md`, which was staged, just not for the cited change. Path-presence cannot detect "this file is in the release but did not carry this claim".

I am deliberately **not** requiring a fix. The rule as written is correct, self-consistent and enforceable; closing this gap means hunk-level verification, which is materially more prose for a P3 convention — and requiring it would contradict the cost ruling I make below. Flagging it so qa and the backlog carry it knowingly rather than discovering it later.

**Expected-red sampling (SOP 4a): not armed.** `test/` is untouched by this diff (verified). The two reds are content-driven assertions owned by T-E8795-02.

## Quality

**F4 — RESOLVED. Fences well-formed; verified by rendering, not by reading.**

Tag balance: `coord-03-core-fallback.md` 1 start / 1 end; `skill-release-engineer.md` 5 start / 5 end (4 pre-existing + 1 new). Both files pass.

`prompts/text-transforms.ts:26-31` strips `<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->\n?` then collapses runs of blank lines. I rendered both files through `applyTextTransforms` at **both** settings:

- **`fullDetail=false`** (the mode every `buildPromptForRole` dispatch uses):
  - coord-03 → `## Evidence-Citation Convention\n\nA \`docs/backlog.md\` row … never the pre-archive root.\n\n## Crash-Resume Protocol` — origin tag `(E87)` gone from the heading, rationale gone, blank line intact before the next `##`. No glue.
  - skill-release-engineer → `…fix the entry now if any citation doesn't match.\n   - \`git commit -m …` — the following bullet starts on its own line with its 3-space indent preserved. **This is precisely the glue defect sr-engineer reported, and it is genuinely fixed.**
  - Zero leftover `rationale:`/`origin:` markers in either output.
- **`fullDetail=true`**: both files render intact, rationale retained; no structural difference from the 4 pre-existing fences in the same file.

The asymmetric-span failure mode cannot recur here: the E95 fence is block-style (tags alone on `:204` and `:206`), matching the existing convention, and the coord-03 fence — though written inline — occupies its own whole line, so the `\n?` consumes the line cleanly. Both are safe.

**The tightening did not cost the obligation.** The normative sentence retains `MUST`, a concrete resolvable template, and an explicit prohibition ("never the pre-archive root"). It is a rule a role can act on and a reviewer can check. My round-1 minor is also fixed: the rule is now explicitly scoped to "A `docs/backlog.md` row", so it cannot be misread as governing `const-08-chain-31-mid.md:10`'s protocol reference to the root `review_reports/review_<task-id>.md` path — which is correct and must stay.

**No restatement (re-verified on the changed text).** Grepped all 15 `content/const-*.md` fragments for archive-path / pre-archive / CHANGELOG-citation rules: zero hits. Neither addition restates a constitution rule.

### The cap decision — ruling (a)

Independently measured through the real render path (`stripRationale(stripOriginTags(CONSTITUTION)) + SEP + stripRationale(stripOriginTags(body))`, matching `buildPromptForRole`'s order): **18369 ~tok**, against the existing floor of 18303. Over by **66**. sr-engineer's number is exact and was not padded — the tightening is real (round 1 measured the unfenced version at ~100 over; fencing plus tightening recovered about a third).

**Option (b) is arithmetically unavailable, and that is the finding that decides this.** The overrun is 66 ~tok ≈ 264 chars. The entire addition — heading plus one sentence — is roughly that size; it *is* the overrun. The only compressible parts are:

- the `## Evidence-Citation Convention` heading (~8 ~tok) — but that heading is the F3 fix. Removing it re-nests the convention under a feature-close-scoped loop and reopens the round-1 architecture finding.
- the sentence itself. The tightest form I can write that keeps `MUST`, the two-tree keying, and the prohibition saves perhaps 15 ~tok.

So a further pass lands around 51 over, not under. There is no tightening target that reaches 18303 without either reopening F3 or gutting the rule into unenforceable prose — which is the exact failure mode I was asked to guard against. **Requesting another round would be asking for work that cannot succeed.** The real choice is (a) or (c).

**What the repo pays.** 66 ~tok per design-arm coordinator dispatch, permanently — 0.36% of an 18369-token bundle. It lands on exactly one role. It is not a broadcast tax, and sr-engineer's rejection of `content/partial-*.md` on multiplication grounds is now doubly justified by F3 below: there is no second author to cover.

**What it prevents.** E87's row documents this as "predictable and recurring, not a one-off... the two mechanisms are on a collision course by construction", with a live instance already realised (E86 cited `qa_reports/review_T-E52-01.md`, archived out from under it in the same cycle that filed it). The damage is *unrepairable*: release-engineer's allowlist covers only the active feature's row, and the coordinator that authored the others is out of the loop by then. So each occurrence is a permanent stale citation in `docs/backlog.md` — which is this workspace's `prd_path`, the document the whole chain reads from. The cost is bounded and known; the damage accumulates and nothing removes it.

**On raising the cap twice in two features.** The trend is real and I want it on the record: 17984 → 18303 → 18369, +385 (+2.1%) across two features. But this cap is not a budget with headroom — the test's own convention is "cap set to the exact measured value... (no additional headroom)". It is a *measured floor* whose purpose is to force exactly this conversation on every growth, not to forbid growth. A reviewed, minimal, targeted +66 is the mechanism working. What would be wrong is an unexamined raise, and this one has now been examined twice.

**Why not (c).** Option (iii) (a `scripts/` resolver) costs zero per-dispatch tokens and would catch the `<feature>` residual above — it is genuinely attractive. But it *detects* after the row is written, and F3 establishes that there is exactly one authoring surface and no repairing surface. Detection with no authorized repairer is a louder version of the current state. Prevention at the single authoring point is the structurally correct fix, and 66 ~tok on the sole author is the cheapest possible place to put it. E87's own row reaches the same conclusion ("(i) is nearly free and prevents the class"), and the two options are complementary, not exclusive — (iii) remains open on the row.

**Ruling: (a).** Approve; hand qa the 18369 re-baseline.

## Architecture

**F3 — RESOLVED, and my round-1 counter-evidence was wrong. `content/coord-03-core-fallback.md:52`.**

The convention now sits under its own `## Evidence-Citation Convention` heading, sibling to `## Backlog Intake Loop` and `## Crash-Resume Protocol` — round-1 fix option (b), the one I said I would take under budget pressure. It is no longer read as a sub-clause of a feature-close-scoped loop.

**On the hole the assignment asked me to close: sr-engineer is right and I was wrong.** My round 1 asserted E87 was "filed by release-engineer at the v3.103.1 close-out". The row's own text (`docs/backlog.md:209`) says something materially different:

> found by release-engineer at the v3.103.1 close-out, 2026-08-20, and **filed on its recommendation** rather than fixed by widening its own write scope — which is the right instinct and the reason this row exists

Found and recommended, not authored. And `content/skill-release-engineer.md:34` makes authoring impossible for that role:

> `docs/backlog.md` (done-marking of the active feature's row(s) only — do not edit unrelated rows; see SOP step 7c)

A new row is not a done-mark of the active feature's row. Step 7c (`:185`) confirms the write is strictly "mark the active feature's row(s) DONE". Combined with my round-1 verification that `content/skill-pm.md` omits `docs/backlog.md` from PM's artifacts entirely, the conclusion is:

**The coordinator is the sole author of `docs/backlog.md` rows on every path** — feature-close intake, mid-cut filing, and release close-out promotion alike. Release-engineer surfaces findings *to* the coordinator; it never writes the row. sr-engineer's claim is verified, its placement reasoning is sound, and the release-engineer close-out path needs no separate coverage.

This also disposes of the F3-vs-F4 tension the assignment set up: there is no second surface to cover, so no second token cost to weigh. The cheaper option and the correct option are the same option.

## Security
No findings. Both additions are prose. The E95 bullet prescribes `git diff --cached --name-only`, read-only with no interpolated argument.

## Performance
No runtime findings. The sole cost is context: +66 ~tok per design-arm coordinator dispatch, measured, accepted under the ruling above.

## Verdict
APPROVED — all four round-1 findings are fixed and verified independently: F1's template resolves for all five archive cases and cannot reproduce the silent-nonexistent-path defect; F2's example is accurate on every checkable claim (and the round-1 disagreement resolves in sr-engineer's favour); F3's placement is correct because release-engineer cannot author backlog rows at all; F4's fences render correctly in both strip modes. The convention exceeds the cap by 66 ~tok and cannot be tightened under it without reopening F3, so the cap moves — a bounded, one-time, per-dispatch cost against a permanent and unrepairable class of defect.
