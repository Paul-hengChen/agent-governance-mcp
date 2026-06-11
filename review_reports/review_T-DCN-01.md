# Review — T-DCN-01 (decodename-cleanup: genericize CDE-OOBE provenance refs)

## Round 1 — APPROVED — by code-reviewer

## Summary

- Reviewed the working-tree diff of the 5 always-loaded files only: `content/constitution.md`, `content/skill-pm.md`, `content/skill-sr-engineer.md`, `content/skill-qa-visual.md`, `content/skill-design-auditor.md`.
- All 18 PURE-PROVENANCE CDE-OOBE reference sites genericized (constitution 2, skill-pm 6, skill-sr-engineer 4, skill-qa-visual 3, skill-design-auditor 3 = 18). AC-GREP over the 5 files returns **zero** matches.
- HC-1 (rule semantics) and HC-2/AC-CONST-2 (§3.2 byte-guard) both PASS — verified by section-scoped `git diff` and a token-level word-diff; no normative token added/removed/reworded.
- Scope (HC-3) clean: sr-engineer's footprint is confined to the 5 content files. The other working-tree changes (`prompts/build.ts`, `scripts/measure-context-cost.mjs`, `dist/`, `test/context-budget.test.mjs` additions, the L16/L143 constitution rationale-fences) belong to the prior `governance-text-load` feature in this same uncommitted tree — none carry codename genericization.
- Headline verdict: **APPROVED.** Route to qa-engineer. The AC8 floor at `test/context-budget.test.mjs:328` is still the old `<= 4153` — that is qa's pending T-DCN-04 test-owner step, EXPECTED to be failing now, and is NOT a review defect.

## Correctness

- **HC-1 — rule semantics unchanged (PASS).** A token-level word-diff (`git diff --word-diff=porcelain`) over all 5 files shows every changed token is citational/attributional/example prose. No `MUST` / `MUST NOT` / `ONLY` / `MAY NOT` / `VOID`, no enforcement clause (`server-enforced`, `blocked with`, `build-gate failure`, `scope violation`), and no error-code token (`SCOPE_DECISION_REQUIRED`, `VISUAL_REPORT_INCOMPLETE`) was added, removed, or reworded.
  - `content/constitution.md:49` — only the trailing citation "CDE-OOBE finding A0" → "the scope-creep finding (see `content/constitution-rationale.md`)" changed; the `SCOPE_DECISION_REQUIRED` rule sentence + all clear-conditions byte-identical. **AC-CONST-1 PASS.**
  - `content/constitution.md:60-61` — attribution clause "the CDE-OOBE false-PASS retrospective (`research/cde-oobe-...-2026-06-05.md`)" → "a visual false-PASS retrospective (see `content/constitution-rationale.md` / `research/`)". Nothing else in §3.2 changed.
  - `content/skill-pm.md:21,22,23,39,41`, `content/skill-sr-engineer.md:23,24,25,26`, `content/skill-qa-visual.md:50,75,122`, `content/skill-design-auditor.md:16,27,29` — each diff confined to the parenthetical/example war-story label or rationale text. The STOP protocols, gate thresholds (8–10 states, ≥3 layers), Spec-Schema rules, Step A/B/C semantics, PASS-blocking conditions, `audited`-only-after-content-match rule, interactive-states inventory, and Visual Structural Assertions requirement all read byte-identical. **AC-PM / AC-SR / AC-QAVIS / AC-AUDITOR PASS.**
- **HC-2 / AC-CONST-2 — §3.2 byte-guard (PASS).** Section-scoped diff of `content/constitution.md` L58 (`### 3.2`) → L93 (last line before `## 4`) shows the ONLY change is the L60-61 attribution clause. The L62-64 justification sentence ("The decisive failure was a coordinator-authored accept-policy…server-enforced (§3.1…)") is byte-identical; all L66-92 normative bullets (Visual verdict qa-visual-owned; Builder ≠ judge; No global-frame metric; Sequential-context assumption) are byte-identical. §3.1 (L39-57) is byte-identical except the L49 citation. (Note: the §3.2 External-reference policy is at L143 in §7, not §3.2 — outside the guard region; its L143 rationale-fence change is prior-feature work, not codename-related.)
- **Item 3 — faithful provenance (PASS).** Each genericized phrase reads grammatically and loses no rule meaning: the named war-story is replaced by a neutral failure-mode descriptor ("a visual false-PASS retrospective", "a prior rollout", "wrong-widget class") plus a rationale-doc pointer where the named specifics are needed (HC-5). The instructive mechanisms are preserved inline (e.g. the column-scroller-vs-`<input type="date">` example, the `#333`/`#3C5AAA` token example).
- **Item 4 — redirect targets exist (PASS).** `content/constitution-rationale.md` exists (13.7 KB) and carries the named specifics: scope-creep finding A0 (L90), the §3.2 false-PASS war-story section (L104), the CDE-OOBE retrospective (L12-13, L32, L108). `research/` exists with `cde-oobe-visual-fidelity-retrospective-2026-06-05.md` and `process-retrospective.md`. The `(see content/constitution-rationale.md …)` redirects resolve to real, populated content.

## Quality

- Two grammatical adjustments accompany genericization and are correct: skill-design-auditor:27 "The missing focus/selection bar in CDE-OOBE was an un-inventoried state" → "A missing focus/selection bar is the kind of un-inventoried state"; skill-pm:23 trailing "reject)." → "reject." (closing paren removed with the parenthetical). No dead text, no convention drift. Replacement phrasing matches the spec inventory's prescribed wording verbatim.

## Architecture

- No `specs/<feature>-architecture.md` for this MVP content-edit feature (per spec: no architect — no new modules/data model/API). Change is layering-neutral: markdown prose only, no code path touched. Consistent with the spec's "provenance-genericization only" contract.

## Security

- No injection vectors, no secrets, no boundary changes. Markdown-only edits to always-loaded governance text. The redirect paths are repo-relative doc references, not executable input.

## Performance

- N/A — content-only change. No code, no loops, no I/O. No algorithmic regression possible. AC8 token floor moves +8 ~tok (4153 → 4161) by design (HC-5 provenance pointers sit outside the rationale fences); ratified by PM as the irreducible cost of de-codenaming with a provenance redirect. Floor-raise is qa's test-owner step (T-DCN-04), not a regression.

## Scope (HC-3)

- sr-engineer edited ONLY the 5 in-scope content files. Confirmed no genericization tokens appear in `prompts/build.ts`, `scripts/measure-context-cost.mjs`, `test/context-budget.test.mjs`, `dist/`, or `CLAUDE.md` — those working-tree changes are the prior governance-text-load feature. sr did NOT touch any test file (correct per §2 — the implementer must not touch the assertion gating their own work). `package.json` version unchanged. No out-of-scope file (`research/`, `content/constitution-rationale.md`, `index.ts`, tests) edited by sr.

## Verdict

**APPROVED** — all 18 references genericized as pure provenance; HC-1 rule semantics and HC-2 §3.2 byte-guard both hold (token-level word-diff + section-scoped diff confirm only citational/example/attribution clauses changed); HC-3 scope clean. Route to qa-engineer for the test-owner floor-raise (T-DCN-04) and final verification (T-DCN-03).
