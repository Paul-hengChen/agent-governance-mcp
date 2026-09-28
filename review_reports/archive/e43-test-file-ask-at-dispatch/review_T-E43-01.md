# Review — T-E43-01 (E43, `e43-test-file-ask-at-dispatch`)

## Round 1 — CHANGES_REQUESTED — by code-reviewer

## Summary
- 3 content files, +3/-3 lines net: `content/const-05-core-standards.md:9` (§2 *Conditional test writing* → three branches), `content/coord-02-host-dispatch.md` (new `Test-file placement` line in the Dispatch Brief Template + its target-conditional inclusion rule), `content/skill-qa-engineer.md:70` (Phase 3a defers to §2, reads the brief first).
- Zero code, zero logic, zero schema change. Build clean; `content/*.md` is read at runtime, so no `dist/` artifact is owed — verified `git status` shows no `dist/` change.
- Scope matches the approved cut exactly, including the third site (`skill-qa-engineer.md`) that the backlog row does not name. Adding it is correct, not scope creep: it is the copy the acting role reads, and it was also an independent violation of the constitution preamble's *"Skills inherit everything below — they MUST NOT restate these rules"*.
- **Two correctness findings, both in the new §2 bullet, both about what the rule now FAILS to permit.** The coord-02 and skill-qa-engineer halves are clean.
- Verdict: CHANGES_REQUESTED.

## Correctness

**F1 — `content/const-05-core-standards.md:9`, branch (c): the new rule forecloses "no new test needed", contradicting the same bullet's first sentence.**
Branch (c) reads `→ decide, create, and disclose the choice`. `create` is imperative, so a Task-dispatched qa-engineer that correctly judges no new test is warranted has no compliant branch — while the bullet's own opening sentence still says *"Not every task needs new tests"*. This also contradicts the precedent the ticket rests on: `T-E52-01`'s brief said *"Do NOT author new tests unless you judge one is genuinely needed and ask first"*, and that round's correct outcome was to author none. The old rule permitted this outcome through the user-decline path; the replacement drops it. Fix: make the decision two-sided, e.g. `→ decide it yourself — create the file, or judge that no new test is warranted — and disclose the decision in BOTH ...`.

**F2 — `content/const-05-core-standards.md:9`: the three branches do not partition the cases; an unattended inline context falls through all three.**
(a) requires a brief line; (b) requires *"a human is reachable in your own context"*; (c) requires *"Task-dispatched"*. A role running inline via `tw_switch_role` in a session with **no reachable human** — an autonomous/cron/`/loop` run, or a host with no interactive channel — satisfies none of them, so the rule is silent exactly where it must not be. This is the same defect class E43 exists to fix (a rule whose available compliances don't cover the situations that actually occur), reintroduced one level down. Fix: make (c) the catch-all rather than a Task-dispatch special case, e.g. `(c) otherwise — Task-dispatched with a silent brief, or any context with no reachable human → ...`. The trailing sentence about a dispatched subagent having no ask channel then reads as the rationale for the catch-all, which is what it is.

**Analyzed and NOT findings** (recorded so they are not re-litigated downstream):
- `coord-02-host-dispatch.md` is a **host-tagged** fragment (`host:claude-code`, per `prompts/skill-manifest.ts`), so the new obligation is absent from every LEAN composition. Not a hole: LEAN hosts have no `Task` dispatch at all, so their qa-engineer runs inline and lands on branch (b)/(c) — the branch that needs a brief line is the only one that ever has a brief. Confirmed `test/skill-manifest.test.mjs` t-lean-keeps-core / t-lean-excludes-host still green.
- Placing the new line **after** the `cut_approved` line and before the watermark line does not disturb the *"invariant lines verbatim, in order"* contract: `cut_approved` already established conditional membership in that block, and the new line's inclusion rule is stated in the same fill-instructions paragraph, same shape.
- Origin fences are inline with trailing same-line text (E69/E75 class); `test/render-structure.test.mjs` green in the full run.

## Quality
No blocking findings. The new inclusion-rule sentence in `coord-02` is long (four clauses) but matches the register of the paragraph it joins, and the `— included ONLY when ... and there it is REQUIRED` construction deliberately mirrors the adjacent `cut_approved` rule so the two read as one convention. `skill-qa-engineer.md` correctly points at §2 by name instead of restating the branches — the right side of the no-restatement rule.

## Architecture
Fits. The change moves an obligation from the actor that cannot discharge it (a dispatched subagent with no human channel) to the only actor that can (the dispatcher, at brief time, before the round starts), and it does so through the existing target-conditional-template mechanism rather than inventing a new channel. No gate, no schema bump, no server enforcement — consistent with §2's other bullets, all of which are attested rather than enforced. Option (ii) from the backlog row (route the ask through `status=Blocked`) is correctly not built: it would have burned a round and a hop per test-file question.

## Security
No findings. No trust boundary, input path, credential, or dependency is touched. `npm audit --audit-level=high` passes (5 advisories, none high/critical).

## Performance
No code path changes. The real cost is **context**: `const-05` ships in every dispatch mode, so the bullet's growth (~230 → ~880 chars) is paid on every prompt, and 4 caps in `test/context-budget.test.mjs` are consequently red. Not a regression to block on — the bullet is load-bearing governance text and the growth is proportional — but the re-baseline must be to the **exact measured** figure, not a padded one, per the established qa-owned-bump convention. Flagged for T-E43-02.

## Expected-Red Sampling (SOP 4a)
`qa_reports/expected-red_e43-test-file-ask-at-dispatch.txt` exists, 16 entries, matching the 16 reds in the full run (1745 tests / 1729 pass / 16 fail). Sampled 5 entries against their named files: 3 matched literally; the remaining 2 are real but not literal-greppable and were confirmed at source — `test/compose-equivalence.test.mjs:93` generates its title from a template literal, and `test/skill-manifest.test.mjs:120` carries escaped quotes in the source string. No manifest defect; all sampled entries are real, locatable tests. Every red is a re-baseline in a qa-owned surface — no unexplained red is hiding among them.

## Reviewer independence — DISCLOSED LIMITATION
This session runs the chain inline (`tw_switch_role`) because Task-tool dispatch is not authorized here, so this review shares both context and model with the writer. The SOP's clean-context rule is therefore only partially satisfiable: sr-engineer's `pending_notes` were unavoidably already in context. Mitigation actually applied: every claim above was re-derived from `git diff` and from the files/tests themselves (fragment host tags read from `prompts/skill-manifest.ts`, red set re-run, manifest entries re-sampled at source), and the two findings are ones the writer's own notes did not raise. Same-model blind spots remain possible — F1/F2 are both "what the rule fails to permit" defects, and a different model might well find a third.

## Verdict
CHANGES_REQUESTED — two correctness findings in the new §2 bullet (F1: `create` forecloses the "no test needed" outcome the same bullet still asserts; F2: the three branches leave an unattended inline context uncovered). Both are single-sentence fixes in one line of one file; the `coord-02` and `skill-qa-engineer` halves are approved as written.

### Round 1 reply — by sr-engineer

- **F1 — accepted, fixed.** Branch (c) is now two-sided: `decide it yourself, create the file or judge that no new test is warranted, and disclose the decision in BOTH ...`. The bullet's opening *"Not every task needs new tests"* and `T-E52-01`'s precedent are both honoured again.
- **F2 — accepted, fixed.** Branch (c) is now the catch-all: `(c) otherwise — Task-dispatched with a silent brief, or any context with no reachable human → ...`. The three branches partition; the trailing subagent sentence now reads as rationale for the catch-all rather than as its predicate.
- **Also tightened while in the line** (reviewer's F1 exposed the mirror gap): the closing `Never create silently.` became `Never create, and never skip, silently.` — with (c) now permitting a "no test needed" outcome, the silent-skip direction needed the same bar as the silent-create direction, or F1's fix would have opened the hole F1 was raised about.
- **Untouched, as instructed:** `content/coord-02-host-dispatch.md` and `content/skill-qa-engineer.md` are byte-identical to Round 1.
- **Re-verified:** build + `check:transitions-sync` clean; full suite re-run gives the **same 16 reds, no new ones** (1745 / 1729 pass / 16 fail), so `qa_reports/expected-red_e43-test-file-ask-at-dispatch.txt` remains accurate unchanged.

## Round 2 — APPROVED — by code-reviewer

## Summary
- Round-2 delta is one line in `content/const-05-core-standards.md:9`; `coord-02-host-dispatch.md` and `skill-qa-engineer.md` verified byte-identical to Round 1.
- F1 and F2 both resolved as specified. Verdict: APPROVED.

## Correctness
**F1 — RESOLVED.** Branch (c) now reads `decide it yourself, create the file or judge that no new test is warranted, and disclose the decision in BOTH ...`. The "no new test needed" outcome is a first-class result again, consistent with the bullet's opening sentence and with `T-E52-01`'s precedent.

**F2 — RESOLVED.** Re-derived the partition from the shipped text rather than the reply: (a) brief line present; (b) no line **and** a human reachable in-context; (c) **otherwise** — Task-dispatched with a silent brief, *or any context with no reachable human*. Ordered evaluation with a true catch-all; no case falls through, and (a)/(b)/(c) cannot overlap (Task dispatch implies no reachable human, and (a) is checked first).

**Round-2 self-initiated change — reviewed, correct, and it closes a hole the F1 fix would otherwise have opened.** `Never create silently.` → `Never create, and never skip, silently.` Once (c) permits "no new test is warranted", the silent-skip direction needs the same bar as silent creation, or F1's fix would trade one unaccountable outcome for another. Verified it does not conflict with `skill-qa-engineer.md` Phase 3a's decline path, which is a *logged* skip (`Phase 3: skipped (user declined ...)`), not a silent one. Scope was one clause in the same sentence, disclosed in the reply — acceptable in-line hardening, not creep.

No new findings.

## Quality
No blocking findings. Naming ("branch (a)/(b)/(c)") is now referenceable from other files, which the `skill-qa-engineer.md` half already depends on.

## Architecture
Unchanged from Round 1 — fits.

## Security
No findings; Round 2 touches prose only.

## Performance
Measured, not estimated: the bullet grows **230 → 1032 chars (+802)** on `const-05-core-standards.md`, which is a **core** (untagged) fragment and therefore ships in *every* dispatch mode — the highest-traffic text in the repo. That is the whole of the 4 red caps in `test/context-budget.test.mjs`.

**Non-blocking, actionable, deliberately NOT held for a Round 3** — roughly a third of the added text is rationale, not rule: *"Halting the round to ask is never compliant under (c) — a dispatched subagent has no ask channel and no resumption path, so resolving placement is the DISPATCHER's obligation at brief time (...)"*. Wrapping that clause in `<!-- rationale:start -->` / `<!-- rationale:end -->` would strip it from every non-`fullDetail` bundle at zero cost to the normative text, and the pattern is already established in this fragment family (`const-02-design-mvp.md`, `const-15-core-tail.md`) — though not yet in `const-05`. Handed to T-E43-02 rather than blocked here for two reasons: qa is the role that will have the **measured** cap delta in front of it and can judge proportionality on a number instead of an estimate, and E69/E75 are direct evidence that fence placement carries real render risk that belongs behind a test. If qa judges the growth proportionate, record that judgement and move on; if not, it is a one-line change with two in-family precedents. Either way the decision should be written down, not left implicit.

## Expected-Red Sampling (SOP 4a)
Re-verified after the round-2 edit: the red set is **identical** — same 16 tests, 1745 / 1729 pass / 16 fail. `qa_reports/expected-red_e43-test-file-ask-at-dispatch.txt` needs no amendment.

## Verdict
APPROVED — both Round-1 correctness findings resolved in the shipped text (verified against the file, not the reply), the self-initiated hardening is correct and in-scope, and the one remaining observation is an efficiency judgement with a measured number attached, routed to T-E43-02 rather than spent on another round.
