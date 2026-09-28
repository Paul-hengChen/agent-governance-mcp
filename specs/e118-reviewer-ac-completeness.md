# e118-reviewer-ac-completeness

Backlog: `docs/backlog.md` row E118 (P1, re-scoped 2026-09-16 to option (iv)). Decision: `docs/v4.0.0-execution-plan.md` §8 *待決 D* (settled: take (a) + (b) only, conditional on the spec file; not reopened here). Lane: L-CONTENT, Wave 5 (`docs/v4.0.0-execution-plan.md` §2.1 / §3 / Wave 5 派工卡).

## Problem Statement

The original ask had three parts: PM writes acceptance clauses, QA tests against them, and code-reviewer checks against them that the implementation is complete. The first two ship. The third does not. `content/skill-code-reviewer.md` reads `specs/<feature>.md` (line 14, clean-context list; line 65, "the contract"), but it has no per-AC completeness obligation, and its seven-section report schema has nowhere to record one. The example report's "matches AC1" is a demonstration, not a requirement. So a diff can be correct, well-layered, secure and fast while implementing three of five ACs, and still pass review. The gap then shows up one round later at QA as missing test coverage, and QA FAILs back to sr-engineer for something the reviewer should have caught. Separately, reviewers already grade findings as required / recommended / optional (E121 round 1, E111 round 1), but that exists only as convention, not in the schema. Mini-chains have no `specs/<feature>.md` (backlog-row-as-spec), so the new obligation must SKIP explicitly when the file is absent. Otherwise every mini-chain review stalls on a file that is not there.

## User Stories

- As a code-reviewer, I want a per-AC completeness obligation and a report section to record it, so that a diff missing an AC is stopped at review, not one round later at QA.
- As a qa-engineer, I want the review report to state per AC whether it is implemented / partial / missing, with evidence, so that I start from a checked AC map, not an unchecked diff.
- As a sr-engineer receiving CHANGES_REQUESTED, I want every finding tagged required / recommended / optional in the schema itself, so that I know which findings block APPROVED and which are advisory.
- As a mini-chain coordinator, I want the obligation to SKIP with one logged line when no spec file exists, so that backlog-row-as-spec reviews never stall.

## Design decisions (settled at cut, token-cost justified)

- **D1: an 8th H2 section, `## AC Completeness`, placed directly after `## Summary`, not folded into an existing section.** The schema declaration costs one bullet line either way. A separate H2 is greppable and verifiable per report (AC2, AC4). Folding it into Summary would overload a 3-5-bullet section with an unbounded per-AC list. Folding it into Correctness would mix "is the logic right" with "is it all there". Placing it second puts the per-AC map ahead of the per-dimension findings. The schema's count word changes `seven` → `eight` on the declaration line. Nothing else in the schema list is edited.
- **D2: the obligation and the SKIP branch live inside the new schema bullet itself, with no new SOP step.** SOP step 3 already reads `specs/<feature>.md` and step 4 already says "per the Schema above", so a new step would restate existing flow. This costs one bullet, not a bullet plus a step.
- **D3: the tiers are one line directly after the schema list, not a per-section edit.** Adding a tier clause to each of the six existing section bullets would edit Quality / Architecture / Performance, which is forbidden (待決 D), and would cost 6× the tokens.
- **D4: the example report IS updated, minimally: one `## AC Completeness` H2 plus one AC row.** The example is labelled "minimal complete passing report". If the schema demands eight sections and the example shows seven, the example teaches non-compliance. The added cost is about 3 lines. No tier tag is added to the example, because it has zero findings, so the tier line has nothing to annotate.
- **D5: the SKIP branch reuses the *shape* of release-engineer AC4's SKIP branch (a WHEN condition, an explicit skip with no STOP, one logged line naming why), NOT its four-branch structure.** AC4 also consults `scope_decision_why` / `pending_notes` and has an UNCLASSIFIABLE STOP. The reviewer's Hard rules forbid reading `pending_notes` commentary (clean context), and a reviewer STOP would recreate exactly the stall this conditionality exists to prevent. The file's presence or absence alone decides the branch.
- **D6: architect is not needed.** The change is a one-file prose edit to `content/skill-code-reviewer.md` with no module, data-model or API change (below the ≥3-modules / new-data-model / cross-cutting-API threshold). No server gate parses code-review report sections (measured: `gates/` and `tools/` have no `## Correctness` / `## Performance` matcher), so the new H2 is prose-only and enforces nothing server-side.

**Non-binding suggested text** (sr-engineer may reword; the literals in *Copy / Strings* are binding):

> - **AC Completeness** — WHEN `specs/<feature>.md` exists → one line per AC in it: `AC<n> — implemented | partial | missing — <evidence, e.g. file:line>`; every `partial`/`missing` is a `required` finding. ELSE → log the single line `AC Completeness: SKIP — no specs/<feature>.md (backlog-row-as-spec mini-chain)` and continue; never STOP on the absence.
>
> Tag every finding `required` (blocks `APPROVED`), `recommended`, or `optional` (neither blocks).

## Acceptance Criteria

All `proof:` commands run from the worktree root `<lanes-root>/e118`. `BASE` = `11fcd6b` (branch point, the `main` HEAD at cut). The test file named below is `test/e118-reviewer-ac-completeness.test.mjs` (T-E118-02, qa-owned).

- **AC1 (obligation exists)**: Given `content/skill-code-reviewer.md`, when read, then the Review Report Schema carries a per-AC completeness obligation that is conditional on `specs/<feature>.md` existing. The obligation requires one entry per AC of that spec, and each entry carries exactly one of the status tokens `implemented` / `partial` / `missing` plus evidence (e.g. `file:line`). A `partial` or `missing` status is a `required` finding.
  proof: `node --test --test-name-pattern="AC1" test/e118-reviewer-ac-completeness.test.mjs` passes. The test asserts that the `**AC Completeness**` schema bullet contains `specs/<feature>.md`, all three tokens `implemented`, `partial`, `missing`, the substring `file:line`, and `required`.
- **AC2 (report dimension exists, as the 8th H2 in order)**: Given the Review Report Schema, when read, then it declares **eight** H2 sections, and the bullet order is Summary, AC Completeness, Correctness, Quality, Architecture, Security, Performance, Verdict.
  proof: `node --test --test-name-pattern="AC2" test/e118-reviewer-ac-completeness.test.mjs` passes. The test asserts that `these eight H2 sections in order` is present, that `these seven H2 sections` is absent, and that the ordered list of `- **<Name>** —` bullets under the schema heading equals the eight names above.
- **AC3 (tiers codified in the schema)**: Given the Review Report Schema, when read, then it defines the three finding tiers `required`, `recommended` and `optional` in the schema itself, outside any `<!-- rationale:start -->` fence. It also states that `required` blocks `APPROVED` and that `recommended`/`optional` do not.
  proof: `node --test --test-name-pattern="AC3" test/e118-reviewer-ac-completeness.test.mjs` passes. The test asserts that all three tier tokens and `APPROVED` sit on one line between the `## Review Report Schema` heading and `### Example`, and that the line survives `stripRationale(stripOriginTags(...))` (the rendered dispatch text).
- **AC4 (SKIP when no spec file)**: Given the schema, when `specs/<feature>.md` does not exist (mini-chain, backlog-row-as-spec), then the reviewer explicitly SKIPs the obligation, logs the exact line `AC Completeness: SKIP — no specs/<feature>.md (backlog-row-as-spec mini-chain)` in the report's `## AC Completeness` section, and does NOT STOP, block or request changes on the absence.
  proof: `grep -F 'AC Completeness: SKIP — no specs/<feature>.md (backlog-row-as-spec mini-chain)' content/skill-code-reviewer.md` exits 0, and `node --test --test-name-pattern="AC4" test/e118-reviewer-ac-completeness.test.mjs` passes (the test asserts the literal plus a no-STOP clause, e.g. `never STOP`, in the same bullet).
- **AC5 (Quality / Architecture / Performance NOT rewritten)**: Given the finished edit, when the six pre-existing schema bullets (Summary, Correctness, Quality, Architecture, Security, Performance) and the Verdict bullet are compared to `BASE`, then they are byte-identical.
  proof: `git diff 11fcd6b -- content/skill-code-reviewer.md | grep -E '^[-+]- \*\*(Summary|Correctness|Quality|Architecture|Security|Performance|Verdict)\*\*'` prints nothing (exit 1). `node --test --test-name-pattern="AC5" test/e118-reviewer-ac-completeness.test.mjs` also passes; it pins the sha256 of each of those seven bullet lines as measured at `BASE`, so it works in a shallow CI clone.
- **AC6 (example report updated, minimally)**: Given the `### Example — minimal complete passing report` block, when read, then it contains exactly eight H2 headings in schema order, with `## AC Completeness` second, and that section holds one `AC1 — implemented` entry with a `file:line` citation. Its other seven H2 sections are byte-identical to `BASE`.
  proof: `node --test --test-name-pattern="AC6" test/e118-reviewer-ac-completeness.test.mjs` passes.
- **AC7 (token discipline)**: Given the edit, when `content/skill-code-reviewer.md` is measured, then it grows by ≤ 1200 bytes over `BASE` (9525 bytes). The test prints the measured byte growth so the record carries the real number.
  proof: `node --test --test-name-pattern="AC7" test/e118-reviewer-ac-completeness.test.mjs` passes, asserting `fs.statSync('content/skill-code-reviewer.md').size <= 10725`.
- **AC8 (golden fixtures change only because of this edit)**: Given the edit, when `node scripts/capture-constitution-golden.mjs` regenerates all 12 goldens, then `test/fixtures/compose-golden/` shows zero diff. `skill-code-reviewer.md` is baked into none of the 12 goldens (measured at cut: `grep -l 'Adversarial diff judge' test/fixtures/compose-golden/*` is empty). Any golden diff is therefore contamination from outside this lane, not this edit, and is a STOP-and-report.
  proof: `node scripts/capture-constitution-golden.mjs && git diff --quiet -- test/fixtures/compose-golden/; echo "exit=$?"` prints `exit=0`, and `node --test test/compose-equivalence.test.mjs test/e90-golden-capture-completeness.test.mjs` passes.
- **AC9 (context budget: no floor pushed)**: Given the edit, when `test/context-budget.test.mjs` runs, then it passes UNCHANGED. No cap in it measures `skill-code-reviewer.md` (measured at cut: `grep -c 'skill-code-reviewer' test/context-budget.test.mjs` prints `0`), and the file composes into neither `CONSTITUTION` nor any coordinator bundle. If QA measures a floor genuinely pushed, only that one floor moves, to its exact re-measured value.
  proof: `git diff --quiet 11fcd6b -- test/context-budget.test.mjs; echo "exit=$?"` prints `exit=0`, and `node --test test/context-budget.test.mjs` passes.
- **AC10 (no regression in existing pins)**: Given the edit, when the full suite runs, then it is green. That includes `test/skill-evolution-v3.11.test.mjs` (the `**Performance**` pin and the AC-7 retired-token sweep; no `review: APPROVED` colon-form token may be introduced), `test/render-structure.test.mjs` (code-reviewer render glue count stays `0`) and `test/subagent-templates.test.mjs`. `npm run check:md-tables` also exits 0.
  proof: `npm test` exits 0 and `npm run check:md-tables` exits 0.
- **AC11 (scope boundary)**: Given the finished lane, when its diff is listed, then every changed path is in {`content/skill-code-reviewer.md`, `test/e118-reviewer-ac-completeness.test.mjs`, `test/context-budget.test.mjs` (only under AC9's exception), `test/fixtures/compose-golden/**` (only under AC8's exception, expected empty), `specs/e118-reviewer-ac-completeness.md`, `tasks.md`, `.current/**`, `qa_reports/**`, `review_reports/**`, `NEW-TICKETS.md`}. Nothing under `tools/`, `gates/`, `guards/`, `prompts/`, `bin/`, `schema/`, `templates/`, `scripts/`, `docs/`, `dist/` or `index.ts` changes (lane J2 owns the code dirs).
  proof: `git diff --name-only 11fcd6b...HEAD | grep -E '^(tools|gates|guards|prompts|bin|schema|templates|scripts|docs|dist)/|^index\.ts$'` prints nothing (exit 1).

## Copy / Strings

This feature ships SOP prose, not user-facing strings. The literals below are the binding ones the tests grep for.

| string id | exact text (quote verbatim) | source |
|---|---|---|
| cr.schema.count | `these eight H2 sections in order` | authored-here — the existing declaration line with `seven` → `eight` (D1) |
| cr.schema.ac-section | `**AC Completeness**` (schema bullet) / `## AC Completeness` (example H2) | authored-here — names the dimension per docs/backlog.md E118 "(a) a per-AC completeness obligation plus a report dimension" |
| cr.ac.status | `implemented` / `partial` / `missing` | coordinator brief 2026-09-23 (human-fixed scope (a): "per AC: implemented / missing / partial") |
| cr.ac.skip | `AC Completeness: SKIP — no specs/<feature>.md (backlog-row-as-spec mini-chain)` | authored-here — shaped on content/skill-release-engineer.md AC4 SKIP log line (`"AC4: SKIP branch — no specs/<active_feature>.md in tree; …"`); U+2014 em-dash, byte-exact |
| cr.tier.names | `required` / `recommended` / `optional` | docs/backlog.md E118 (b) ("reviewers already grade findings required / recommended / optional") |

## Visual Tokens

| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope

- Any restatement or rewrite of "does the implementation need adjustment or optimisation". Quality, Architecture and Performance already cover it and are exercised (待決 D, explicit human instruction). AC5 pins them byte-identical.
- A per-AC obligation against a backlog row when no spec file exists. The mini-chain case SKIPs by design (D5). It does not attempt to parse a backlog row as ACs.
- Any server-side enforcement: no new gate, no `REVIEW_*` error code, no report-section parser. The dimension is SOP prose only (D6).
- Changes to SOP steps 1-5, Escalation Routes, Notes, Hard rules or the clean-context reading list.
- `templates/claude-code-agents/code-reviewer.md` and any `docs/` mirror of the review schema (measured: neither restates the seven-section list). Forbidden lanes anyway.
- The multi-feature batch case (one review spanning several features' specs). Not raised by the ticket.
- Release bookkeeping (version bump, CHANGELOG, `docs/backlog.md` done-mark) belongs to release-engineer post-PASS, not to this cut.

## Dependencies / Prerequisites

- **Lane exclusivity**: L-CONTENT is the only lane touching `content/` in this window (§2.1). Lane J2 (Wave 4) is concurrently editing `tools/`, `gates/`, `guards/`, `prompts/`, `bin/`, `schema/` and `index.ts`. This lane must not touch them (AC11).
- **Worktree**: `<lanes-root>/e118`. Run `npm ci` before QA's test run (§2.4b). All file writes use absolute paths under the worktree (§2.5).
- **Resource Audit (§7)**: the inputs (docs/backlog.md E118 row, the v4.0.0 execution plan §2/§3/§8 待決 D/Wave 5 card, content/skill-code-reviewer.md, content/skill-release-engineer.md AC4) contain zero external URLs, Figma links or ticket-system references. All references are in-repo, so `external_refs` is omitted.
- **Question Batch**: zero open clarifications. The scope was fixed by the human (待決 D) and by the coordinator brief. Design decisions D1-D6 are settled above.
- **Chain**: mini-chain after PM: sr-engineer (pinned `fable`) → code-reviewer (Task-dispatched, §3.2) → qa-engineer. No architect (D6). Not bugfix mode (`dispatch_mode` stays `feature`; no repro-first red set). `qa_reports/expected-red_e118-reviewer-ac-completeness.txt` is needed only if QA lands the new test file red ahead of the content edit, which is not the planned order.
- **New findings** go into `NEW-TICKETS.md` under a `## Lane: L-CONTENT (E118, Wave 5)` section as `E118-NEW-n`. E-numbers are never allocated in-lane (§2.4).
- Visual Structural Assertions omitted: no `design/<feature>.md`, mode = no-design.
