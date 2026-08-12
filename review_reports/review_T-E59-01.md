# Review — T-E59-01

covers: T-E59-01, T-E59-02

## Summary

- E59 rewrites the §6 "Dependency audit at build gate" bullet (`content/const-15-core-tail.md:11`, one line) so the waiver escape closes for every build-running role, plus 6 restatement syncs in `docs/skills/release-engineer.md` and `docs/skills/sr-engineer.md`. 3 authored files, zero source code, zero `test/` edits.
- **The core fix is correct and lands.** The clause genuinely binds sr-engineer and qa-engineer (re-derived from the bullet's own subject phrase against both SOPs), the no-record case resolves to STOP/`Blocked` rather than silently re-opening the escape, and `content/` is now clean of the escape everywhere — the constitution and all 11 role SOPs carry no residual waiver channel.
- **I re-derived the live-restatement set with my own patterns** rather than trusting the coordinator's 5 or sr-engineer's 6. Anchoring on `HIGH/CRITICAL` and `waiv*` (which catch paraphrases the literal `"waived in the PR description"` string misses) surfaces **a 7th live restatement that survived**: the mermaid decision diagram at `docs/skills/release-engineer.md:166-167`, which still routes `-- no / waived -->` straight to the next step. That is the blocking finding.
- **Expected-red set independently verified as exact.** Full suite re-run: 1692 tests, 1677 pass, 15 fail, and the failing set is a *precise* set-equality match to `qa_reports/expected-red_e59-const6-waiver-clause.txt` — zero unexpected reds, zero claimed-but-green entries. `git status --porcelain -- test/` is empty.
- Verdict: **CHANGES_REQUESTED** on one line in a file the diff already opens.

## Correctness

**F1 — BLOCKING. `docs/skills/release-engineer.md:166-167` still encodes the abolished waiver, in a file this diff already edits.**

The step-4 mermaid flow reads:

```
    AUDIT --> AUDITOK{HIGH/CRITICAL found?}
    AUDITOK -- yes, unwaived --> STOPAUDIT[STOP: treat as build failure]
    AUDITOK -- no / waived --> S5[Step 5: npm test incl. version-coherence test]
```

Post-E59 there is no such state as "waived". The diagram offers a pass-through branch on a waiver whose origin is left entirely unspecified — which is exactly the residual prose channel F7 was filed to abolish, and it fails in the *unsafe* direction (toward proceeding). Three points make this squarely in scope rather than a nitpick:

1. It is the **diagram-form twin of row 5 of the STOP-exit table at `:92`** — the same rule, the same file, and `:92` *was* correctly fixed in this diff. Fixing one representation and leaving the other is internally inconsistent.
2. It costs nothing in cut scope. `docs/skills/release-engineer.md` is already one of the 3 authored files, so this is the identical argument sr-engineer used to justify fixing the 6th restatement at `docs/skills/sr-engineer.md:112` — it applies here with equal force.
3. The prior grep pattern was the reason it was missed. `"waived in the PR description"` does not appear at `:166`; `waiv` does. A surviving paraphrase is the same defect as a surviving quote.

Suggested minimal fix (labels only, no topology change):

```
    AUDITOK -- yes, no current disposition --> STOPAUDIT[STOP: build failure — Blocked;<br/>route for a fresh advisory decision]
    AUDITOK -- no / disposition recorded, trigger unfired --> S5[Step 5: npm test incl. version-coherence test]
```

**F2 — minor, same pass. `docs/skills/sr-engineer.md:204` routes an audit failure into the auto-fix loop instead of Blocked.**

```
    S7 --> BUILDOK{Build + audit clean?}
    BUILDOK -- no --> LOOP
```

Merging "build errors" and "audit findings" into one node was defensible while §6 said only "build failure". The new clause is explicit — `No matching disposition means STOP: status: Blocked, hand back for a fresh advisory decision` — and §5's fix loop is not that. This fails in the *safe* direction (toward more work, not toward shipping), so it is not independently blocking, but the file is open and the diagram now contradicts the clause it summarizes.

**F3 — minor. `docs/dependency-advisories.md:12` is now under-scoped.** It reads "`content/skill-release-engineer.md` points release-engineer here instead of instructing an ad-hoc waiver." After E59, §6 itself points *every* build-running role here. The sentence is not false, but it frames the record as release-time-only infrastructure — the precise one-role framing this ticket abolishes — in the header an sr-engineer would read on first hitting a finding. One clause. Out of the pinned 3-file cut, so legitimately deferrable to a follow-up rather than fixed here; recording it so it is not lost.

**Verified correct (no findings):**

- **(a) The clause binds sr-engineer and qa-engineer.** Re-derived from the bullet's own text, not the task description. The subject phrase `every role that calls npm run build / cargo build / pip install / equivalent` is unchanged, and both roles satisfy it: `content/skill-sr-engineer.md:38` ("Confirm full project builds with ZERO errors") and `content/skill-qa-engineer.md:84` ("Project build: ZERO errors"). The prohibition is additionally role-universal on its face — "is NOT a waiver, **at any role**".
- **No-record case fails closed.** `No matching disposition means STOP: status: Blocked` — the absence of a record produces a build failure, not a reversion to inline rationale. The `writing the record is part of that decision, never a build-time fallback` tail correctly forecloses the obvious workaround (author a record at build time to clear your own finding).
- **The "no skill patch" decision is right.** `content/skill-sr-engineer.md` and `content/skill-qa-engineer.md` contain no restatement of the audit rule (verified: their only `audit` hits are "spec/copy/visual audit" and design-auditor references). Fixing §6 binds both automatically; adding per-role text would have rebuilt the prose channel being abolished.
- **(e) Content-only.** `git status --porcelain -- content/` shows `const-15-core-tail.md` alone — no other constitution fragment moved. `git status --porcelain -- test/` is **empty**. No source code in the diff.
- **Expected-red manifest (SOP 4a).** Present and well-formed. I sampled well beyond the required 3 — all 15 entries resolve to real, locatable tests (`test/compose-equivalence.test.mjs:93` parameterized template ×8, `:136`, `:141`, `:148`; `test/context-budget.test.mjs:220,870,1044,1629`).

## Quality

**N1 — the "this repo's instance" deictic re-binds incorrectly in consumer workspaces.** The coordinator flagged this as explicitly not pre-decided, so here is my judgment.

The clause reads: *"the workspace's dependency-advisory record (this repo's instance: `docs/dependency-advisories.md`)"*. `const-15-core-tail.md` is core-tagged and composed into **every** dispatch mode of every agc-managed workspace. The parenthetical is authored from the agc repo's point of view, but the text ships into other repos, where "this repo" re-binds to the consumer's repo — which has no such file.

**My call: a real but non-blocking authoring defect. AC3 passes on its literal terms; the phrasing should still be fixed.** Reasoning:

- AC3 asks that the clause not *hardcode a repo-specific path as a universal requirement*. It does not — the normative subject is the generic "the workspace's dependency-advisory record", and the path is explicitly marked as an instance. So AC3 is met.
- The failure mode is **safe**: an agent that hunts for `docs/dependency-advisories.md`, finds nothing, and follows the clause lands on `No matching disposition means STOP: Blocked`. The ambiguity cannot re-open the escape.
- But it is not harmless either, and the reason is local: the *same bullet* ends with **"Toolchains lacking an audit command waive the rule."** That sentence establishes, one clause later, the pattern *missing infrastructure ⇒ rule waived*. A consumer agent that reads "this repo's instance: `docs/dependency-advisories.md`", finds no such file, and reaches for the nearest available analogy has one sitting right there. The explicit STOP sentence answers it correctly, but the bullet is arguing against itself.

Fix is ~2 tokens and removes the re-binding entirely: name the repo instead of pointing at it — `(the agent-governance-mcp repo's own instance: docs/dependency-advisories.md)`. Since this round is reopening for F1 anyway, worth taking; not independently blocking.

**(f) Mirror fidelity — verified, no drift.** Byte-compared programmatically, not by eye:

- `docs/skills/release-engineer.md:51` and `docs/skills/sr-engineer.md:82` contain the new clause body (from `— UNLESS` through `never a build-time fallback.`) **verbatim**, character-for-character identical to `content/const-15-core-tail.md:11`.
- The four condensed restatements (`release-engineer.md:92`, `:121`; `sr-engineer.md:112`, `:132`) are table/summary rows and are appropriately condensed rather than drifted. Each preserves all four load-bearing elements: pre-dating ("pre-dated"), the three fields (advisory id, decision, re-review trigger), the unfired-trigger condition, and "an inline PR/commit rationale is NOT a waiver". Their predecessors were equally condensed — this is register, not paraphrase drift.

**`specs/skill-evolution-v3.11.md:81` left untouched — correct call, and it generalizes.** The line is an acceptance criterion of a shipped ticket, structured as `**Then** §6 MUST gain a new bullet: "<verbatim text>"`. It is a historical quotation of the constitution *as introduced at v3.11.0*; rewriting it would falsify the record of what AC-8 actually required. Identical CHANGELOG logic, correctly applied.

The same reasoning covers three further historical hits my sweep turned up, all correctly left alone: `specs/model-routing.md:168` ("documented under the PR description with a waiver rationale" — AC8 of a shipped feature), `specs/v3.15.0.md:41`, and `specs/bug-fixes-v3.14.1.md:18,38`. Worth noting `model-routing.md:168` is the weakest of these — it is phrased in its own voice rather than as a quotation of superseded constitution text — but it remains a per-ticket AC in a shipped spec, i.e. history. Leaving it is right.

**Residual-channel sweep, full result.** Live normative surfaces carrying a restatement of the rule, by my own patterns:

| location | status |
|---|---|
| `content/const-15-core-tail.md:11` | fixed (source) |
| `content/skill-release-engineer.md:53-55` | already correct (E57) |
| `docs/skills/release-engineer.md:51, 92, 121` | fixed |
| `docs/skills/sr-engineer.md:82, 112, 132` | fixed (`:112` found by sr-engineer beyond the coordinator's list) |
| **`docs/skills/release-engineer.md:166-167`** | **SURVIVING — F1** |
| `docs/skills/sr-engineer.md:204` | diverges from the new STOP directive — F2 |
| `docs/dependency-advisories.md:12` | under-scoped — F3 |
| CHANGELOG, `docs/backlog.md`, `tasks.md`, `review_reports/`, `.current/handoff.md`, `specs/*` | inert history — correctly not rewritten |

## Architecture

No architecture spec for this feature; the E59 backlog row plus F7 are the contract, per `scope_decision_why`.

**(d) `content/skill-release-engineer.md` step 6a remains the release-time *instance* of the general rule, not an exception to it.** Verified by reading 6a against the new §6:

- It self-identifies as derived: *"(Constitution §6 build-gate rule, mechanism per E57)"*.
- Its two branches are substantively identical to the new §6 — recorded with no fired trigger ⇒ non-blocking; not recorded or trigger fired ⇒ genuine build failure, `status="Blocked"`, route to pm.
- Everything it adds is role-specific elaboration, not latitude: cite the record's row in release notes; do **not** author the record yourself (outside release-engineer's Artifact allowlist); pm dispatches the decision. None of it grants release-engineer anything §6 denies other roles.

The layering is now right way up: §6 is the general rule, 6a is one role's instantiation. That is the inversion E59 set out to fix, and it lands.

One pre-existing discrepancy, **not introduced by this diff and out of scope**: `docs/skills/release-engineer.md:51` places the audit "between step 4 and the step 9 `tw_update_state`", while `content/skill-release-engineer.md:53` (source of truth) runs it "after `npm test` (step 6)". Both satisfy §6's "after build, before `tw_update_state`" window, so neither is wrong against the constitution, but the mirror and its source disagree on placement. Flagging for a future sync pass.

## Security

No new attack surface: prose only, no code, no new input crossing a trust boundary, no secrets, no dependency movement.

The security *posture* improves, and that is the point of the ticket. Before this change, §6's escape was satisfiable by any role writing a sentence in a PR description — a channel with no durability, no review, and no re-review trigger, which is exactly how five HIGH advisories rode release-to-release (E57). After it, the only way past a HIGH/CRITICAL is a disposition that was recorded **before** the finding was passed, carries an advisory id, a decision, and a re-review trigger, and whose trigger has not fired. The pre-dating requirement is the load-bearing half — it is what stops an agent from clearing its own finding at build time — and the `writing the record is part of that decision, never a build-time fallback` tail closes the matching loophole explicitly.

F1 is a security finding as much as a documentation one: a live decision diagram in the release role's own documentation that routes `waived → proceed`, in a chain whose entire premise is that no such branch exists.

I discharged my own §6 obligation for this review: `npm run build` (via the `npm test` prebuild) clean, `npm audit --audit-level=high` exits **0** — 6 findings, all low/moderate, no HIGH/CRITICAL. The gate is not itself triggered by this change.

## Performance

No runtime performance surface — no source code changed, no hot path moved.

The relevant cost here is **context budget**, which in this repo is a real performance axis: `const-15-core-tail.md` is core-tagged, so the bullet's growth is paid in every bundle of every dispatch mode in every managed workspace. Independently measured from my own suite run:

| ceiling | measured | cap | delta |
|---|---|---|---|
| AC2 lean always-on bundle | 4661 | 4544 | **+117** |
| AC8 rationale-stripped (design-arm) constitution | 8798 | 8685 | **+113** |
| AC8 teamwork coordinator bundle | 16892 | 16779 | **+113** |
| AC8 non-design constitution | 6700 | 6587 | **+113** |

These are the numbers qa needs for the T-E59-03 re-baseline; note only these 4 ceilings breached — the adjacent delta assertion (`chain-role non-design bundle is ~1830 ~tok lighter`) stayed green, so the caps should be moved individually, not blanket-raised.

~113 tokens is a fair price for what it buys (the three disposition fields, the pre-dating requirement, the re-arm rule, the STOP directive, and the at-any-role universality — every one of which is load-bearing). One trimmable redundancy if qa finds a ceiling uncomfortably tight: `writing the record is part of that decision, never a build-time fallback` is largely implied by the pre-dating requirement stated two sentences earlier. Non-blocking, and I would keep it — the explicit form is harder to argue around, which is the whole design intent.

No golden can have moved for any reason other than this edit: `git status --porcelain -- content/` lists `const-15-core-tail.md` only, and its diff is exactly one line replaced. Any other golden delta would therefore be a real regression — there are none.

## Verdict

**CHANGES_REQUESTED** — the substance of the fix is right and should ship close to as-authored: the clause binds every build-running role on its own terms, fails closed on a missing record, keeps `content/` free of the escape, correctly declines a per-role skill patch, and correctly leaves historical spec/CHANGELOG text alone. It is blocked on one line: `docs/skills/release-engineer.md:166-167` still routes `-- no / waived -->` past the audit gate — a surviving paraphrase of the exact escape F7 filed, in a file this diff already opens, and the diagram-form twin of the table row at `:92` that was correctly fixed. Fix F1; take F2 and N1 in the same pass while the files are open; F3 is legitimately a follow-up row. The expected-red set is verified exact (15/15 set-equality, `test/` byte-untouched) and needs no rework.

**Same-model bias**: none suspected — this review ran on opus against sr-engineer's fable-pinned implementation, and F1 was found by re-deriving the restatement set from independent patterns rather than re-running the coordinator's.

## Round 1 — sr-engineer reply

All three items addressed, all inside the already-approved 3-file cut. No file outside `content/const-15-core-tail.md`, `docs/skills/release-engineer.md`, `docs/skills/sr-engineer.md` was touched.

- **F1 (blocking) — fixed, label-only, no topology change.** `docs/skills/release-engineer.md:166-167` now reads `AUDITOK -- yes, no current disposition --> STOPAUDIT[STOP: build failure — Blocked;<br/>route for a fresh advisory decision]` / `AUDITOK -- no / disposition recorded, trigger unfired --> S5[...]`, using the exact labels suggested in the report. `waiv` no longer appears anywhere in either branch.
- **F2 (minor) — fixed via a node split, contained entirely in `docs/skills/sr-engineer.md`.** `S7 --> BUILDOK{Build clean?}` now separates compile failures (still `-- no --> LOOP`, the correct auto-fix-loop exit) from `BUILDOK -- yes --> AUDITOK{§6 audit: HIGH/CRITICAL with no current disposition?}`, which routes `-- yes --> BLK_AUDIT[STOP: Blocked - no matching disposition<br/>hand back for fresh advisory decision; next_role: pm]` and `-- no --> S8` (ready for code review). `next_role: pm` matches the established pattern (release-engineer 6a: "pm dispatches the decision, typically to sr-engineer"; no other role name appears anywhere near "fresh advisory decision" in the repo). `BLK_AUDIT` was added to the `--> HUMAN` aggregator alongside the file's other `BLK_*` nodes. No change needed beyond this file — the Branch/STOP-exit table row 9 (`:112`) and the Server-enforced-gates bullet (`:132`) were already correct per your sweep and already distinguish the audit case from a plain build error.
- **N1 (recommended) — done.** `content/const-15-core-tail.md:11` now reads `(the agent-governance-mcp repo's own instance: docs/dependency-advisories.md)`, naming the repo instead of pointing at it. Synced to the two verbatim mirrors that quote this clause byte-for-byte (`docs/skills/release-engineer.md:51`, `docs/skills/sr-engineer.md:82`) and the one condensed restatement that also carried the phrase (`docs/skills/release-engineer.md:121`) — otherwise those mirrors would have gone stale against the source in this same round.
- **F3** — left untouched, per instruction; carried to the human as a follow-up rather than folded in (4th file, outside the approved 3-file cut).

**Residue re-derivation (your patterns, re-run after the fix, not trusted from the prior pass):** `grep -rniE "waiv"` and `grep -rniE "HIGH/CRITICAL"` across `content/`, `docs/skills/`, and `docs/dependency-advisories.md` (the live normative surface you swept) now show zero surviving restatements of the abolished escape. Full breakdown:

| location | status |
|---|---|
| `content/const-15-core-tail.md:11` | fixed (source) + N1 |
| `content/skill-release-engineer.md:53-55` | already correct (E57), unchanged |
| `docs/skills/release-engineer.md:51, 92, 121` | fixed round 1 + N1-synced |
| `docs/skills/sr-engineer.md:82, 112, 132` | fixed round 1 + N1-synced (`:82`) |
| `docs/skills/release-engineer.md:166-167` | **F1 — fixed this round** |
| `docs/skills/sr-engineer.md:204` | **F2 — fixed this round** (node split) |
| `docs/dependency-advisories.md:12` | **F3 — still under-scoped, confirmed out of scope, human follow-up** |

I also checked outside your swept set (CONTRIBUTING.md, README.md, CLAUDE.md/AGENTS.md/.antigravityrules, templates/, qa_reports/, research/) for anything the pattern sweep would flag — only `CONTRIBUTING.md:24` matches `HIGH/CRITICAL`, and it's a one-line factual gate description with no escape clause ("high/critical advisories block release" — no "unless/waived" language), so no edit needed there. `qa_reports/`, `research/`, `CHANGELOG.md`, `specs/*` hits are historical records of past decisions, same category as the `review_reports/`/`docs/backlog.md`/`tasks.md`/`.current/handoff.md` hits your sweep already classified as inert history — not re-derived as live.

**Verification re-run after the fix:**
- `npm run build` — clean (tsc, zero errors).
- `npm audit --audit-level=high` — exit 0, 6 findings, all low/moderate, zero HIGH/CRITICAL. No disposition needed; gate not triggered.
- `git status --porcelain -- content/` → `const-15-core-tail.md` only (N1's one line). `git status --porcelain -- test/` → empty.
- Full suite re-run (`node --test test/*.test.mjs`): **1692 tests, 1677 pass, 15 fail** — identical count to your independent re-run, and the failing-test set is exact set-equality against `qa_reports/expected-red_e59-const6-waiver-clause.txt` (same 15 tests, zero unexpected, zero claimed-but-green).
- **N1 moved the byte count**, so the 4 budget ceilings shifted again from your measured numbers: AC2 lean 4661→**4667** (cap 4544, +123), AC8 design-arm floor 8798→**8804** (cap 8685, +119), teamwork bundle 16892→**16898** (cap 16779, +119), non-design floor 6700→**6706** (cap 6587, +119) — a uniform +6 ~tok from the N1 wording change, landing on all four because `const-15-core-tail.md` is core-tagged. The adjacent "~1830 ~tok lighter" delta assertion is still green. I refreshed `qa_reports/expected-red_e59-const6-waiver-clause.txt` with these fresh measured values and overages (the manifest's test-name/path list itself is unchanged — same 15 tests — so only the reality-check numbers needed updating, not the entries).

---

## Round 2 — APPROVED — by code-reviewer

covers: T-E59-01, T-E59-02

### Summary
- Re-reviewed the 3-file cut after sr-engineer's F1 / F2 / N1 rework. Diff is still exactly `content/const-15-core-tail.md`, `docs/skills/release-engineer.md`, `docs/skills/sr-engineer.md` — zero source, zero `test/`.
- **F1 verified fixed** — `docs/skills/release-engineer.md:166-167`, label-only change, topology byte-identical to base.
- **F2 verified fixed** — `docs/skills/sr-engineer.md:204-208` + `:233`. Topology change validated mechanically: no orphan, no dangling reference, no silent reroute. The split also closes a latent defect the round-1 report did not name (see Correctness R2-1).
- **N1 verified fixed** — the shared clause is byte-identical (542 chars) across all three normative sites; zero `this repo's instance` deictics survive anywhere.
- **Residue is closed by enumeration, not by count** — the count has moved three times because each pass counted a different thing. Mechanical enumeration below; zero live restatements survive.
- Expected-red is **exact set-equality, 15/15**, and the manifest's four measured numbers match my own run digit-for-digit.
- Verdict: **APPROVED**.

### Correctness

**R2-1 — F2 is a semantic fix, not just a node split (no finding; recording it because it changes how the fix should be read).**
Base was `BUILDOK{Build + audit clean?}` with `-- no --> LOOP`. That single conflated gate routed a HIGH/CRITICAL audit finding into the §5 two-tries auto-fix loop — which contradicted even the *pre-E59* §6 ("treat as a build failure"). The split does not merely relabel; it removes a path by which sr-engineer could have auto-remediated an advisory in-loop. Correct direction.

**Topology verification (mechanical, both diagrams).** Parsed node defs and edges out of both `flowchart TD` blocks:
- sr-engineer: 50 nodes / 67 edges. Every referenced id has a label definition. One entry (`ENTRY`), terminals `{DONE, HUMAN, REPORT}` — unchanged from base. Brackets balanced on every line.
- release-engineer: 41 nodes / 50 edges, entry `ENTRY`, terminals `{DONE, HUMAN, QA}` — unchanged.
- `BLK_AUDIT` has exactly one inbound (`AUDITOK -- yes`) and one outbound (`--> HUMAN`, `docs/skills/sr-engineer.md:233`). Not orphaned, not a sink.
- **Only one edge enters `S8`**: `docs/skills/sr-engineer.md:208` `AUDITOK -- no --> S8`. There is no bypass — an undispositioned advisory provably cannot reach handoff-to-code-reviewer.
- **Compile error still reaches the fix loop**: `:205` `BUILDOK -- no --> LOOP`, and `LOOP` still resolves `-- no --> S4` / `-- yes --> BLK_LOOP`. Unchanged.
- Same for release-engineer: `S5` is entered only from `AUDITOK` (`:167`); `STOPAUDIT --> HUMAN` still present at `:196`.

**Mermaid parse risk: nil.** The rework introduces no character class that is not already exercised elsewhere in the same file — `<br/>` inside `{}` (precedent `docs/skills/qa-engineer.md:176`, `docs/skills/architect.md:308`), `:` and `/` inside `{}` (precedent `docs/skills/sr-engineer.md:195` `LOOP{§5: 2 fix tries / 3 reads exhausted?}`), `;` inside `[]` (precedent `:189` `SPLIT[...visual_split_requested; next_role: pm]`), `—` inside `[]` (precedent `docs/skills/release-engineer.md:161`), `/` + `,` in an edge label (precedent `docs/skills/release-engineer.md:176` `-- no / metadata-only -->`). No mermaid toolchain is vendored and no test parses these blocks, so this is a static argument, not a render — stated as such.

**`BLK_AUDIT`'s `next_role: pm` is legal, checked against the matrix rather than assumed.** `tools/transitions.ts:224-236` gives `"sr-engineer:Blocked"` the successors `{sr-engineer:In_Progress, pm:In_Progress, design-auditor:In_Progress}`. `pm` is present. It also matches the release-side instance verbatim — `content/skill-release-engineer.md:55` STOPs with `next_role="pm"` for the identical condition.

**Residue — definitive enumeration.** The disagreement (5 / 6 / 7) was three different denominators. Enumerated by *site* rather than by grep-hit, the §6 rule has **9 live normative sites**: 1 source (`content/const-15-core-tail.md:11`) + 8 mirrors — `docs/skills/release-engineer.md` at `:51`, `:92`, `:121`, `:166-167`; `docs/skills/sr-engineer.md` at `:82`, `:112`, `:132`, `:204-208`. All 9 now carry the closed rule. Re-derived independently with `waiv`, `HIGH/CRITICAL`, `HIGH or CRITICAL`, `audit-level=high`, `unless waived`, `waived in`, `with rationale` over `content/`, `docs/skills/`, `docs/dependency-advisories.md`, `CONTRIBUTING.md`, `README.md`, `CLAUDE.md`, `AGENTS.md`, `.antigravityrules`, `templates/`, and repo-wide. Every surviving `waiv` hit outside those 9 is either the retained `Toolchains lacking an audit command waive the rule` sentence, inert history (`CHANGELOG.md`, `docs/backlog.md`, `specs/`, `review_reports/archive/`, `qa_reports/archive/`, `research/`, `tasks.md` ticket text, `.current/handoff.md`), or `test/fixtures/compose-golden/` — which is qa's re-baseline surface and correctly still red.
`content/skill-qa-engineer.md` and `docs/skills/qa-engineer.md` contain **no** restatement of the audit rule at all, which is the correct state: §6 binds qa-engineer through *"every role that calls `npm run build` / `cargo build` / `pip install` / equivalent"* with no per-role prose channel to drift.

**`CONTRIBUTING.md:24` — I concur with sr-engineer's call, on my own reading.** `- npm audit --audit-level=high at the build gate — high/critical advisories block release.` carries no escape clause, so it is not the defect E59 exists to close, and it errs *strict* (unconditional block) rather than permissive — the safe direction. No edit needed here. Two minor inaccuracies do now exist in it and belong with the F3 follow-up, not this cut: it says "block **release**" when the gate binds every build-running role, and it does not mention the disposition channel at all. Separately and unrelated: `CONTRIBUTING.md:16` still claims `1633/1633 at v3.94.0` against a current 1692 — pre-existing doc drift, doc-writer scope.

**Expected-red — exact set-equality, and the manifest's numbers are mine.** `npx tsc` clean. `node --test test/*.test.mjs`: 1692 tests, 1677 pass, **15 fail**. Parsed every `not ok` line and diffed against the 15 rows of `qa_reports/expected-red_e59-const6-waiver-clause.txt`: **actual − manifest = ∅, manifest − actual = ∅**. Nothing unexplained, no stale row.
SOP 4a sampling: 7 of 15 entries locate as literal strings in the named files; the other 8 are template-literal names generated by the `BUILD_MODES` loop at `test/compose-equivalence.test.mjs:93`, so they are absent from source by construction and were instead confirmed against the *runtime* names — which is what the set-equality above proves for all 15.
Manifest numbers re-measured against my own run, all four match exactly: lean `4667` vs cap 4544 (+123); design-arm floor `8804` vs 8685 (+119); teamwork bundle `16898` vs 16779 (+119); non-design floor `6706` vs 6587 (+119). The adjacent `~1830 ~tok lighter` delta assertion is green (`ok 169`). qa can re-baseline against this manifest without re-deriving.

**Nothing else moved in the composed bundle.** Composed `buildPromptForRole('skill-sr-engineer.md', design=false, fullDetail=false)`, sliced the constitution portion the way `constitutionOf()` does, and diffed against `test/fixtures/compose-golden/build-full-nondesign.txt`: **exactly one changed line**, the §6 bullet. No other fragment shifted, no whitespace drift.

`npm audit --audit-level=high` → exit 0 (6 findings: 2 low, 4 moderate; zero HIGH/CRITICAL). §6 satisfied for this review's own build.

### Quality

**R2-Q1 (non-blocking).** The two `AUDITOK` nodes are phrased asymmetrically. sr-engineer's asks the whole question in the node (`{§6 audit: HIGH/CRITICAL with no current disposition?}`, clean yes/no). release-engineer's asks `{HIGH/CRITICAL found?}` and pushes the disposition test into the branch labels, so the "no" branch conflates *not found* with *found but dispositioned*. It is still exhaustive and unambiguous — the fourth case (found, recorded, trigger **fired**) is excluded from the pass branch by its explicit `trigger unfired`, and lands on the STOP branch because `current` in "no current disposition" is load-bearing. That word carries the same meaning in all four surfaces (`const-15:11`, `skill-release-engineer.md:55`, both diagrams), so the vocabulary is consistent. Readability nit only; not worth a fourth constitution-adjacent round.

**R2-Q2 (pre-existing, explicitly not to be fixed in this cut).** `docs/skills/release-engineer.md:164` places the audit between step 4 (build) and step 5 (`npm test`), while `content/skill-release-engineer.md:53` step 6a places it *after* step 6 (`npm test`). Both satisfy §6's "after build, before `tw_update_state`", and `docs/skills/release-engineer.md:51`'s source note spans the range, so nothing contradicts. The line is unchanged by this diff and the discrepancy predates E59 (it arrived with E57's 6a). Leave it.

### Architecture

The clause stays methodology-agnostic: it binds *"the workspace's dependency-advisory record"* and names `docs/dependency-advisories.md` only parenthetically as this codebase's instance. N1's rewording strengthens that — `the agent-governance-mcp repo's own instance` cannot be misread as "the repo you happen to be in", which is exactly how the old deictic could land in a consumer workspace.

No contradiction with `content/skill-release-engineer.md` step 6a; 6a reads as the release-time *instance* of the general rule, not an exception. Two reinforcements worth naming: 6a's "do NOT author or edit `docs/dependency-advisories.md` yourself … pm dispatches the decision" is the concrete form of §6's "writing the record is part of that decision, never a build-time fallback"; and 6a's STOP shape (`status="Blocked"`, `next_role="pm"`) is what `BLK_AUDIT` now mirrors on the sr side. The two roles now STOP identically for the same condition.

**On the F3 deferral — I agree it is correct, with one condition.** `docs/dependency-advisories.md:3-12` frames the record as release-time-only ("waiving ad hoc at release time", "blocks a **release**", "`content/skill-release-engineer.md` points **release-engineer** here"), which under the new §6 is too narrow — §6 now points *every* build-running role there. But it is a preamble, not a rule; the role-agnostic operating instructions at `:14-25` already read correctly for any role; and §6 is normative text that outranks a doc header. Folding a 4th file into a human-approved 3-file cut to fix non-blocking prose staleness would be the exact move E53→E58 and E57→E59 were decided against — three consecutive applications of the same precedent. **The condition**: E57→E59 worked because F7 got a real backlog row. If F3 is only carried verbally it evaporates. It should be filed as a row (and `CONTRIBUTING.md:24`'s two scope inaccuracies folded into the same row) before this ships.

### Security
No findings. Content-only diff; no code, no input handling, no secrets, no trust boundary touched. The change is net *stricter* — it removes a self-service escape from a security gate and replaces it with a pre-dated, auditable record requirement, with a fired trigger re-arming the failure.

### Performance
No findings. Documentation and prompt-fragment text only. The measured cost is the +6 ~tok/bundle from N1 (total +123 / +119 / +119 / +119 against the four caps), which is disclosed in the expected-red manifest and is qa's cap re-baseline, not a regression.

### Verdict
**APPROVED** — F1, F2 and N1 are all verified fixed inside the approved 3-file cut; F2's topology change is mechanically sound (no orphan, no bypass into `S8`, compile errors still reach the §5 loop, `sr-engineer:Blocked → pm` legal per the matrix); residue is closed across all 9 enumerated sites with only inert history and the qa-owned goldens surviving; and the expected-red set is exact 15/15 with all four manifest numbers matching my own measurement. Remaining items (R2-Q1, R2-Q2, F3, `CONTRIBUTING.md:24`) are non-blocking and belong to a follow-up row.
