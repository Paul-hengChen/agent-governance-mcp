# Review: T-GTL-06 + T-GTL-07 (governance-text-load, R2)

> Reviewer: code-reviewer (opus) · 2026-06-11 · base: HEAD (v3.31.0 working tree)
> Inputs read (clean-context): working-tree diff of `content/constitution.md`,
> `prompts/build.ts`, `scripts/measure-context-cost.mjs`; `specs/governance-text-load-architecture.md`
> (R1 + R2 incl. DR-7/DR-8/DR-9/DR-10/DR-11/DR-12 and the R2 Interface Contract ~L272).
> Verdict formed against the architecture spec, not the dispatch task text or sr's pending_notes.

## Round 1 — APPROVED — by code-reviewer

## Summary
- T-GTL-06 fences EXACTLY two inline parenthetical example-lists in the constitution: §1 L16
  HTML-primitive `(e.g. …)` list and §7 L143 artifact-type `(URLs, …, "see XYZ")` list. Nothing else.
- T-GTL-07 extends `buildPromptForRole` so the constitution is rationale-stripped on non-full-detail
  dispatch, composed after the existing chain-only decision and gated on the SAME `fullDetail` flag;
  measure-script mirror extended to the constitution (reporting-only).
- Primary adjudication: the four-target task text (L16, L17, L19, §7) is OVER-broad vs the spec.
  DR-8 explicitly specifies the two-span set sr implemented and explicitly lists L17 + L19 as
  "NOT fenced". sr's omission is **spec-correct**, not under-delivery. Independently verified below.
- AC7 (§3.1–§3.2 byte-untouched) verified two ways: diff hunks are far outside L39–L93, and a
  post-strip slice of the §3.1→§4 zone is byte-identical to source. AC8 floor (4,153 / saved 72)
  reproduced exactly. AC9 losslessness reproduced empirically. DR-11 lite/hook path byte-unchanged.
- No test file touched, no `any` introduced, no version bump (package.json/index.ts stay 3.31.0).

## Correctness
- **DR-8 two-span adjudication (PRIMARY) — sr is RIGHT.** I read L16/L17/L19 and §7 L143 in the
  actual file and broke each into clauses:
  - **L16 (KEEP rule, FENCE example)** — `substituting an HTML primitive (e.g. …designed scrollbar)
    constitutes scope violation` — the parenthetical is a pure "e.g." illustration of a noun
    ("an HTML primitive") already named in the rule. De-fenced sentence
    `substituting an HTML primitive constitutes scope violation` is grammatical and complete.
    Empirically confirmed present after strip. Correct fence target.
  - **L143 (KEEP rule, FENCE example)** — `A spec referencing external artifacts (URLs, …"see XYZ")
    is presumed incomplete` — same shape; the list illustrates "external artifacts". De-fenced reads
    `A spec referencing external artifacts is presumed incomplete`. Confirmed present after strip.
    Correct fence target. The operative `(skill-pm §Resource Audit Gate)` routing pointer is OUTSIDE
    the fence and survives — confirmed.
  - **L17 (NOT fenced — CORRECT).** Clauses: (1) `the canonical design (Figma node or equivalent) is
    the scope baseline — not the lossy prose transcription` — the `(Figma node or equivalent)`
    parenthetical is a *definitional clarifier* scoping what "canonical design" means, not pure
    illustration; removing it narrows the rule. (2) `Omitting a design-present element is a fidelity
    defect …; flag the gap per §7 …` — rule + §7 reference. There is NO trailing "why"/war-story
    sentence. Under DR-7 (fence only trailing rationale sentences, never a clause the rule acts on)
    there are **zero safely-fenceable bytes**. sr correct.
  - **L19 (NOT fenced — CORRECT, hard exclusion).** Every clause is operative (the `MAY fix all`
    grant, qualifiers (a)(b)(c), the closer). Qualifiers (b)/(c) contain literal `§3.1` and `§3.2`
    references — exactly the §-reference rule text DR-10 forbids inside a fence. **Zero fenceable
    bytes — hard exclusion.** sr correct.
  - Conclusion: DR-8 (spec L223–L270) names the two-span set and lists L17+L19 under
    "Lines explicitly NOT fenced (and why)" with the same reasoning. The spec, not the task text,
    is the contract for this role. Fencing L17/L19 would weaken governance and violate AC7/AC9/DR-10.
    **The two-span fencing is reviewer-blessed.**
- **AC7 (HARD) — PASS.** `git diff content/constitution.md` produces only two hunks: `@@ -13,7 +13,7`
  (L16, in §1) and `@@ -140,7 +140,7` (L143, in §7). §3.1 = L39, §3.2 = L58, §4 = L94; the exclusion
  zone L39–L93 is untouched. Independently, `stripRationale` applied to the live file leaves the
  `### 3.1 Server-enforced chain` → `## 4. Routing Chain` slice **byte-identical** (verified:
  `rawZone === strZone` → true). 0 rationale markers anywhere inside §3.x.
- **Marker syntax — PASS.** File uses `<!-- rationale:start -->` / `<!-- rationale:end -->`; the
  matcher in build.ts L72 is `/<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->\n?/g` — exact
  match. Exactly 2 marker pairs (1/1 in §1, 1/1 in §7). The load-bearing rule sentence in each fenced
  bullet sits OUTSIDE the fence (verified: rule fragments present, example interiors absent, post-strip
  marker count = 0).
- **AC8 — internally consistent.** Reproduced with the project chars/4 estimator: raw 4,225, stripped
  4,153, **saved 72**. Matches the spec's AC8 VERIFIED block (≤ 4,153 floor; saving 72 ≥ DR-12's 49)
  exactly. No discrepancy.
- **AC9 — PASS.** After strip, all of `## 1.`…`## 7.`, `### 3.1`, `### 3.2`, `Self-converge relaxation`,
  `§3.1 visual report schema gate`, `§3.2 is unchanged`, `canonical design (Figma node or equivalent)`,
  `skill-pm §Resource Audit Gate` are present; `column-scroller picker`, `see XYZ`, `designed
  scrollbar`, `ticket IDs` are absent. Lossless.

## Quality
- `prompts/build.ts`: clean. The rename `constitution` → `chainResolved` + new
  `const constitution = fullDetail ? chainResolved : stripRationale(chainResolved);` matches the R2
  Interface Contract (spec L291–L302) line-for-line. Single `fullDetail` flag gates BOTH constitution
  and skill strips — no second parameter, per spec. Comments accurately cite T-GTL-07/DR-9.
- `scripts/measure-context-cost.mjs`: the `stripRationale` mirror is now applied to the constitution
  in the bundle rows and the TOTAL block; tagged reporting-only (DR-2/DR-6). Table title and the
  `const −N / skill −N` breakdown are accurate. No load-bearing logic.
- No `any` introduced (added lines checked). No dead code.

## Architecture
- Composition matches DR-9: `stripChainOnly` decision first, then `stripRationale` — order proven
  irrelevant (disjoint fence regions; distinct marker literals; non-greedy). Constitution and skill
  body use the identical flag. No `index.ts`/zod/tool change, consistent with the spec's "no schema,
  no new tool" scope.
- DR-11 confirmed: `bin/agent-governance-context.mjs` is untouched and does not reference
  `stripRationale`; the SessionStart/lite hook path is byte-identical, so the AC4 2,600 lite cap
  cannot regress. (sr's measure-script lite-lean figure is unaffected.)
- DR-2 single-copy preserved: only `buildPromptForRole` carries the load-bearing `stripRationale`;
  the measure-script copy is a reporting mirror — correctly NOT added to the DR-3 parity test.

## Security
- No injection vector, no secret, no unvalidated boundary. The change only removes HTML-comment-fenced
  illustrative substrings from prompt text. The §3.x server-enforced gate text is provably byte-intact
  (AC7), so no governance gate is silently weakened — the core security concern of this feature.

## Performance
- Two additional linear regex passes (`stripRationale`) per `buildPromptForRole` dispatch on a ~17 KB
  constitution string. Negligible, same complexity class as the pre-existing `stripChainOnly` / skill
  strip. No loop, no I/O added, no algorithmic regression vs base.

## Out-of-scope observations (NOT blocking; for QA/release awareness)
- **`CLAUDE.md` is modified but is NOT part of T-GTL-06/07.** It adds a layout reference to
  `content/constitution-rationale.md` tagged **v3.32.0** (the separate constitution-restructure
  feature, untracked at `specs/constitution-restructure.md`). Unrelated drift in the working tree;
  does not affect this verdict. Flagging so it is not silently rolled into this feature's commit.
  Untracked `content/constitution-rationale.md`, `qa_reports/*`, `review_reports/review_T-CR-03.md`
  are likewise prior/other-feature artifacts.
- **dist comment staleness (minor).** A clean `npm run build` of the committed source reflows ONLY
  the comments + the `chainResolved` rename into `dist/prompts/build.js` (14-line diff). The
  functional line `const constitution = fullDetail ? chainResolved : stripRationale(chainResolved);`
  was already present in sr's dist, so runtime behavior is correct and shipped. The dist source-text
  is not byte-identical to a fresh build, though. I reverted my test rebuild to leave sr's tree as
  handed off; release-engineer should `npm run build` at release so dist comments match source.

## Verdict
**APPROVED.** The two-span fencing is spec-correct (DR-8 names exactly these two spans and excludes
L17/L19 with the reasoning I independently reproduced); AC7 §3.x byte-identity holds two ways; AC8
floor (4,153 / saved 72) and AC9 losslessness reproduce exactly; the build.ts call-site and
measure-script mirror match the R2 contract; lite/hook path is byte-unchanged (DR-11); no test file,
no `any`, no version bump. The reviewer blesses the two-span decision.
