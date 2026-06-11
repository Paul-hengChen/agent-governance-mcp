# Architecture: governance-text-load (F-B)

> Source spec: `specs/governance-text-load.md` (PM, v3.31.0 cycle)
> Feature-split: `.current/feature-split.md` (F-B, order 1)
> Predecessor mechanism: `specs/context-budget-reduction-architecture.md` (DR-3 chain-only stripper)
> Sibling: F-A `visual-selfconverge` (prompt-doc-only, already tagged v3.31.0, un-released)

This MVP extends the proven `<!-- chain-only:start/end -->` fence + `stripChainOnly()`
mechanism to skill files: a new `<!-- rationale:start --> / <!-- rationale:end -->`
marker wraps verbose "Reason:"/war-story prose, and a single `stripRationale()`
function in `prompts/build.ts` removes it for non-full-detail chain-role dispatches.
No server-side transition/evidence logic changes. `dist/` rebuilds.

---

## Affected Files

| File | Action | Why |
|---|---|---|
| `prompts/build.ts` | **modify** | Add `stripRationale(text)` (mirrors `stripChainOnly` shape, lines 55–59); apply it to the skill body in `buildPromptForRole()` for chain roles. Add a `fullDetail` parameter. |
| `content/skill-pm.md` | **modify** | Wrap the 4 rationale spans (lines 21, 22, 40, 43) in `<!-- rationale:start/end -->`. No rule text moves. |
| `content/skill-sr-engineer.md` | **modify** | Wrap the standalone rationale sentences in lines 23, 26, 27 (and the trailing "Reason"-style clauses) in fences. No imperative clause enters a fence. |
| `test/context-budget.test.mjs` | **modify** | Add F-B test group: `stripRationale` idempotence/no-marker-passthrough, rule-marker retention in stripped pm/sr bundles, full-detail verbatim retention, AC1/AC2 token thresholds. AC4's existing `t-lean-under-target` cap (2,600) is UNCHANGED (it asserts the lite bundle, which F-B does not touch). |
| `scripts/measure-context-cost.mjs` | **modify** | Add a `stripRationale` mirror + a new table "Role-prompt bundles (rationale-stripped)" so the post-strip pm/sr figures are diff-able. See DR-6. |
| `package.json` / `index.ts` Server literal | **NO change here** | Bump to 3.31.0 happens at release time, owned by release-engineer (DR-1). sr-engineer does NOT touch the version. |
| `dist/**` | **rebuild** | `npm run build` after the `prompts/build.ts` edit — `dist/` is shipped for `npx github:` consumers. Mandatory before commit. |
| `content/constitution.md` | **NO change** | Out of Scope per spec — the constitution keeps its `chain-only` fence only; rationale-stripping does not extend there. |
| `bin/agent-governance-context.mjs` | **NO change** (DR-4) | SessionStart hook loads ONLY `skill-coordinator-lite.md` / `skill-coordinator.md`, neither of which is being fenced in this feature. No rationale stripper is added to the hook, so DR-3's multi-copy parity rule is NOT triggered. See DR-4. |

### Critical constraint (carried from spec, applies to every Affected File)
No governance RULE text may be deleted or moved out of the prompt in any mode where it
currently applies. The fence wraps ONLY verbose rationale. The default `/teamwork` full
coordinator path is server-read-only and is NOT a chain-role skill dispatch — it is
untouched (DR-5). Source files retain every rationale block verbatim (AC3).

---

## Data Structures

No new persisted types, no schema-version bump (no `handoff.md` / `tasks.md` / SQLite / `.config.json`
shape change). The only "type" change is one new optional parameter on an existing function.

### Fence grammar (markdown-comment markers, mirrors chain-only)
```
<!-- rationale:start -->
… one or more prose paragraphs that explain WHY a rule exists or cite history …
<!-- rationale:end -->
```
- Markers live on their own line OR inline at the end of a rule bullet (the pm file requires
  inline placement because rationale is mid-bullet — see Interface Contracts / regex below).
- Markers are HTML comments → invisible to human markdown readers and to any downstream
  tool that does not strip them (safety: a renderer that ignores the markers shows full text).
- A `rationale` block MUST contain ONLY rationale prose (AC6, human-review). No imperative
  verb phrase, BDD criterion, numbered SOP step, or actioned table row may sit inside one.

### `fullDetail` flag
```ts
// new optional 3rd-from-last param on buildPromptForRole; default false = strip.
fullDetail?: boolean   // true → rationale blocks kept verbatim (AC3 path)
```

---

## Interface Contracts

### New: `stripRationale(text: string): string` — in `prompts/build.ts`
Mirrors the proven `stripChainOnly` mechanism (current `prompts/build.ts` lines 55–59) exactly:
```ts
// Remove every <!-- rationale:start --> … <!-- rationale:end --> block (markers
// inclusive) and collapse blank lines left behind. Idempotent; text with no
// markers is returned unchanged (full-detail safety default). Rationale blocks
// carry only "why" prose (war-story / Reason: paragraphs) that onboards humans
// and forms audit trail — never a rule a role acts on — so stripping them for
// chain-role dispatch trims per-dispatch budget without dropping enforcement.
// Single-copy by design (see governance-text-load-architecture DR-2): only
// buildPromptForRole calls it; NOT duplicated in the hook or measure script as a
// load-bearing copy, so DR-3's 3-copy parity rule does not apply here.
export function stripRationale(text: string): string {
  return text
    .replace(/<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->\n?/g, "")
    .replace(/[ \t]+\n/g, "\n")     // trim trailing spaces left by an inline strip
    .replace(/\n{3,}/g, "\n\n");
}
```
Notes:
- The `[ \t]+\n` collapse is the ONE delta vs `stripChainOnly`: because pm-file rationale is
  inline at the end of a bullet ("…justification. `<!-- rationale:start -->`Reason: …`<!-- rationale:end -->`"),
  stripping leaves a trailing space before the newline. `stripChainOnly` doesn't need this
  because its blocks are whole-line. The `\n{3,}` collapse is identical to chain-only.
- Non-greedy `*?` + the same `\n?` marker-eating tail as chain-only → idempotent, and
  no-marker text passes through unchanged (the full-detail/override safety default).

### Modified: `buildPromptForRole(...)` — in `prompts/build.ts`
Current signature (lines 234–241): `(skillFile, description, workspacePath)`.
New signature adds a trailing optional flag (keeps all 7 existing `prompts/<role>.ts`
callers source-compatible — they pass 3 args, `fullDetail` defaults to `false`):
```ts
export function buildPromptForRole(
  skillFile: string,
  description: string,
  workspacePath: string,
  fullDetail = false,
): { description: string; messages: Array<{ role: "user"; content: { type: "text"; text: string } }> }
```

Call-site change (current lines 247–248 → new):
```ts
const rawSkill = loadContent(skillFile, workspacePath);
const { frontmatter, body: rawBody } = parseSkillFile(rawSkill);
// Chain-role skill dispatch strips verbose rationale unless fullDetail is set.
// The constitution itself is untouched here (chain-only handled separately above).
const skill = fullDetail ? rawBody : stripRationale(rawBody);
```
- Apply AFTER `parseSkillFile` (so frontmatter is already removed) and BEFORE assembling
  `prompt` (current line 264). The constitution variable (lines 242–246) is unchanged —
  `stripRationale` operates on the skill body only.
- Because the default is `false`, ALL chain-role prompt dispatches (`pm`, `sr-engineer`,
  `architect`, `researcher`, `qa-engineer`, and the full `teamwork` coordinator) strip
  rationale by default. Only files that actually contain `rationale` fences change in
  output; un-fenced skill files (architect/researcher/qa/coordinator today) pass through
  byte-identical (no-marker passthrough). This is why F-B fencing only the pm+sr files is
  safe to ship without touching the others. See DR-5 for the coordinator decision.

### Unchanged
- `stripChainOnly` — untouched; still applied to the constitution for the lite skill only.
- `appendSpecContext`, `parseSkillFile`, all storage/RAG interfaces — untouched.
- No `index.ts` zod schema / tool registration change (no new tool).

---

## Sequence Diagram

```mermaid
sequenceDiagram
  participant Client as MCP Client (e.g. /pm dispatch)
  participant Prompt as prompts/pm.ts
  participant Build as buildPromptForRole()
  participant FS as content/skill-pm.md
  Client->>Prompt: GetPrompt("pm")
  Prompt->>Build: buildPromptForRole("skill-pm.md", desc, ws)  [fullDetail defaults false]
  Build->>FS: loadContent("constitution.md") + loadContent("skill-pm.md")
  Build->>Build: stripChainOnly(constitution) ONLY if lite skill (here: kept raw)
  Build->>Build: parseSkillFile(rawSkill) -> {frontmatter, rawBody}
  Build->>Build: fullDetail ? rawBody : stripRationale(rawBody)
  Note over Build: rationale fences removed; every rule heading/step/table row retained
  Build-->>Prompt: { messages: [constitution + strippedSkill + state] }
  Prompt-->>Client: prompt (~5,720 ~tok pm bundle, down from 6,733)
```

---

## Decision Records

| Context | Decision | Consequences |
|---|---|---|
| **DR-1 — Version bump.** F-B changes `prompts/build.ts` (real shipped code in `dist/`), unlike sibling F-A which was prompt-doc-only. A new prompt-assembly behavior is a MINOR change → v3.31.0. F-A's clauses are already tagged v3.31.0 (un-released). | F-B rides the **same v3.31.0** release — do NOT invent v3.32.0. New behavior/clauses introduced by F-B are tagged **v3.31.0** in code comments and any doc references. package.json is currently **3.30.0**; the actual bump to 3.31.0 + CHANGELOG + tag happens at **release time, owned by release-engineer** after PASS — NOT by sr-engineer. | sr-engineer must NOT edit `package.json` or the `index.ts` Server literal. `scripts/check-version.mjs` will pass because both stay at 3.30.0 until release-engineer bumps them. Closes off shipping a separate v3.32.0 for F-B. |
| **DR-2 — Single-copy `stripRationale` (DR-3 parity decision).** The chain-only stripper is duplicated in 3 files (build.ts, hook, measure script) and pinned byte-identical by `t-regex-equivalence`. Rationale-stripping is only needed at one production call-site (`buildPromptForRole`). | Keep **exactly ONE load-bearing copy** of `stripRationale` (in `prompts/build.ts`). The hook (DR-4) does not need it; the measure-script copy (DR-6) is a **reporting** mirror, not a load-bearing prompt-assembly copy. Therefore DR-3's mandatory 3-copy parity test does **NOT** apply to `stripRationale`. AC5 satisfied. | One source of truth; no cross-module drift risk for this stripper. The measure-script mirror is allowed to exist for reporting without invoking the parity test (it never feeds a live prompt). Recorded explicitly so a future maintainer doesn't "add a parity test" by analogy. |
| **DR-3 — Marker nesting / independence vs `chain-only`.** A rule could carry rationale inside a `chain-only` block (esp. in the constitution, though F-B does not fence the constitution). | `rationale` fences are **independent and orthogonal** to `chain-only`. The two strippers run on different texts and are composable: `stripChainOnly` is applied to the constitution (lite only); `stripRationale` is applied to the skill **body** only. A `rationale` block MAY sit inside a `chain-only` block (nesting allowed) — order of stripping is irrelevant because removing the outer chain-only block already removes any rationale nested within, and removing rationale first leaves the chain-only block well-formed. Neither regex's non-greedy match crosses the other's markers because the marker literals differ. | Composable, order-independent. In F-B specifically the two never co-occur (constitution not fenced for rationale; skill files have no chain-only fences), so nesting is a documented-safe capability, not an exercised path. Future features may nest freely. |
| **DR-4 — SessionStart hook scope.** Spec Out-of-Scope defers hook changes "unless architect determines needed for AC5". | **No hook change.** The hook only ever loads `skill-coordinator-lite.md` (default) or `skill-coordinator.md` — neither is fenced for rationale in F-B. Adding `stripRationale` to the hook would (a) be dead code and (b) trigger the DR-3 multi-copy parity burden for zero benefit. | Hook untouched. If a future feature fences `skill-coordinator*.md`, THAT feature must add the hook copy + extend the parity test — recorded as a forward note, not done now. |
| **DR-5 — Which modes strip rationale (no rule lost in any mode).** Three contexts: full `/teamwork` coordinator, lite + SessionStart, and chain-role prompts (pm/sr/architect/researcher/qa). | `stripRationale` runs by **default (fullDetail=false) on every `buildPromptForRole` dispatch**, which includes the full `teamwork` coordinator prompt. This is **safe and lossless** because: (1) it strips ONLY `rationale` fences, which contain zero rule text (AC6); (2) `skill-coordinator.md` carries NO rationale fences in F-B, so the full coordinator output is byte-identical to today (no-marker passthrough); (3) lite + SessionStart go through the hook, which does NOT call `stripRationale` (DR-4), so the lite bundle is also unchanged → AC4's 2,600 cap cannot regress. The `fullDetail: true` path (AC3) is reserved for any future "full-detail" reader/audit caller and for tests; no live prompt sets it today. | Uniform default = simplest mental model: "skill prompts ship operational text; rationale is opt-in via fullDetail." No governance rule is lost in ANY mode because only the pm+sr skills are fenced and their fences hold no rules. Coordinator/lite/hook outputs are provably unchanged. Closes the "which mode keeps rationale" question without a per-role flag matrix. |
| **DR-6 — Measurement of AC1/AC2 token targets.** AC1/AC2 cite specific ~tok thresholds; the team needs them diff-able. | Targets are measured with the existing **chars/4 `approxTokens` heuristic** (the deterministic, dependency-free estimator already used by `scripts/measure-context-cost.mjs` and `test/context-budget.test.mjs`). Add a `stripRationale` mirror in the measure script and a new printed table **"Role-prompt bundles (rationale-stripped)"** showing pm/sr post-strip skill + bundle figures. The AC thresholds are pinned in `test/context-budget.test.mjs` (new assertions), NOT in the measure script. | Same estimator across spec baselines, script, and tests → numbers are comparable. The measure-script mirror is reporting-only (DR-2: not parity-tested). Measured current baselines (verified during this design): skill-pm 2,529 ~tok, skill-sr 2,160 ~tok, pm bundle 6,733, sr bundle 6,363 — all match the spec exactly. |
| **DR-7 — Marker placement granularity (pm vs sr inline rationale).** In `skill-pm.md` rationale is mid-bullet ("…`authored-here`… Reason: …cde-oobe…"); in `skill-sr-engineer.md` rationale clauses are interleaved with imperative text inside single bullets. | Fence at **sentence/clause granularity, inline**, wrapping ONLY the trailing rationale sentence(s) of a bullet, never the imperative lead clause. The `stripRationale` regex's `[ \t]+\n` collapse (Interface Contracts) cleans the residual space. For deeply-interleaved sr bullets (lines 26, 27) where rationale and rule alternate, fence each contiguous rationale span separately rather than the whole bullet. | Guarantees the imperative rule clause survives stripping. This is the load-bearing reason for the extra `[ \t]+\n` rule vs `stripChainOnly`. sr-engineer must hand-verify (AC6) that no fenced span contains an imperative/`MUST`/numbered-step token before committing. |

---

## Deferred Resources

_No external references in the spec's Dependencies / Prerequisites — the Resource Audit (§7)
recorded zero external URLs; all references are internal file paths (verified against
`specs/governance-text-load.md` lines 132–164). Section intentionally empty per Artifact Schema._

---

## Open Questions

_None. All architect-deferred decisions from the spec (which skill files to fence, call-site
flag design, SessionStart hook scope, measure-script column, marker names, mode coverage,
version bump) are resolved in Decision Records above. Ready for sr-engineer._

---

## Implementation notes for sr-engineer (task mapping)

- **T-GTL-01** — Add `stripRationale()` + the `fullDetail` param and call-site to `prompts/build.ts`
  (Interface Contracts). Run `npm run build` (dist/ rebuild). No `package.json`/`index.ts` version edit (DR-1).
- **T-GTL-02** — Fence rationale in `content/skill-pm.md` (lines 21, 22, 40, 43 spans only). Verify
  every rule heading/SOP step/gate name survives a `stripRationale` pass (AC1, AC6).
- **T-GTL-03** — Fence rationale in `content/skill-sr-engineer.md` (lines 23, 26, 27 trailing
  rationale clauses + any "Reason"-style prose). Clause-granular per DR-7; no imperative clause inside a fence (AC2, AC6).
- **T-GTL-04** — Add `stripRationale` mirror + "Role-prompt bundles (rationale-stripped)" table to
  `scripts/measure-context-cost.mjs` (reporting-only; NOT parity-tested — DR-2/DR-6).
- **T-GTL-05** — Extend `test/context-budget.test.mjs`: `stripRationale` idempotence + no-marker
  passthrough; rule-marker retention in stripped pm/sr; full-detail (`fullDetail:true`) verbatim
  retention (AC3); AC1 (skill-pm ≤ 2,149 ~tok, pm bundle ≤ 5,720 ~tok) and AC2 (skill-sr ≤ 1,836 ~tok)
  thresholds. Do NOT touch the existing `t-lean-under-target` 2,600 cap (AC4 — lite path untouched).
- **Gotcha**: tests import from `dist/prompts/build.js`, so `npm run build` MUST precede `npm test`
  (the suite's prebuild step handles this, but a manual `node --test` will use a stale dist).

---
---

# Round-2 Amendment (2026-06-10) — Constitution §1/§7 rationale fencing (option b)

> Trigger: PM spec amendment v2 expanded scope to the highest-leverage per-dispatch lever — the
> constitution itself, injected on EVERY role-bundle dispatch. New ACs AC7 (§3.1/§3.2 byte-untouched
> guard), AC8 (constitution bundle floor), AC9 (lossless across both strips). New tasks T-GTL-06
> (fence constitution §1+§7 rationale) and T-GTL-07 (extend `buildPromptForRole` to also strip the
> constitution text). All Round-1 decisions (DR-1…DR-7) STAND unchanged. This section adds the
> constitution-text-stripping design on top.
>
> Version stays **v3.31.0** — no `package.json` bump (DR-1 still governs; release-engineer owns the bump).

## R2 — Affected Files (delta over Round-1 table)

| File | Action | Why |
|---|---|---|
| `content/constitution.md` | **modify** (supersedes Round-1 "NO change" row) | Wrap EXACTLY two inline example-list spans in `<!-- rationale:start/end -->`: §1 L16 HTML-primitive `(e.g. …)` list and §7 L143 artifact-type `(URLs, …, "see XYZ")` list. NOTHING else. §3.1/§3.2 byte-untouched (AC7). See R2 Decision Records DR-8, DR-10. |
| `prompts/build.ts` | **modify** | Extend the `buildPromptForRole` constitution call-site (current line 262–263) so the constitution text is also rationale-stripped when `!fullDetail`, composed with the existing chain-only strip. See R2 Interface Contracts + DR-9. T-GTL-07. |
| `scripts/measure-context-cost.mjs` | **modify** | Apply the existing `stripRationale` mirror to the constitution in the bundle rows (currently it only strips the skill body — line 124–133), so the post-strip constitution figure and the AC8 bundle floors are diff-able. Reporting-only (DR-2/DR-6 still hold). T-GTL-07. |
| `test/context-budget.test.mjs` | **modify** | Add the AC7/AC8/AC9 assertions (see R2 "Test thresholds that change"). The existing `t-lean-under-target` 2,600 cap is UNCHANGED — the lite path is byte-identical (DR-11). T-GTL-06/07. |
| `bin/agent-governance-context.mjs` | **NO change** (DR-11, confirms DR-4 holds) | The hook does NOT call `stripRationale`. Lite hook output gains the two example-list spans back (full text), which is correct — see DR-11; the 2,600 lite cap does NOT regress. |

## R2 — The exact fence spans (clause-granular, DR-8)

The fence boundaries are defined **CLAUSE-GRANULAR**. Only two spans in the entire §1+§7 surface are
pure illustration with zero rule content — no `MUST`/`MUST NOT`, no rule clause, no gate name, no
§-reference. Every other candidate line is load-bearing and is left untouched.

**Span 1 — §1 L16 (Visual Widgets exception), the HTML-primitive example list.**
The bullet reads: `… substituting an HTML primitive (e.g. `<input type="date">` for a column-scroller
picker, `<select>` for a custom segmented control, browser scrollbar for a designed scrollbar)
constitutes **scope violation, NOT MVP compliance**. …`
- **FENCE** (inline, mid-sentence, ~37 ~tok): the parenthetical
  ``(e.g. `<input type="date">` for a column-scroller picker, `<select>` for a custom segmented control, browser scrollbar for a designed scrollbar)``
  plus its single trailing space. This is pure illustration of "an HTML primitive."
- **KEEP (rule)**: `when a widget is listed in the spec's `## Visual Widgets` section, substituting an
  HTML primitive … constitutes **scope violation, NOT MVP compliance**.` + `The PM-declared widget
  shape is the minimum scope.` + `Widgets absent from that section remain governed by the default MVP
  rule.` — the sentence remains grammatical after the parenthetical is removed (`substituting an HTML
  primitive constitutes scope violation`).

**Span 2 — §7 L143 (External-reference policy), the artifact-type example list.**
The bullet reads: `A spec referencing external artifacts (URLs, design files, ticket IDs, mockups,
"see XYZ") is presumed **incomplete** until each reference is (a) fetched, …`
- **FENCE** (inline, mid-sentence, ~14 ~tok): the parenthetical
  `(URLs, design files, ticket IDs, mockups, "see XYZ")` plus its single trailing space. Pure
  illustration of "external artifacts."
- **KEEP (rule)**: the whole presumption clause `A spec referencing external artifacts … is presumed
  **incomplete** until each reference is (a) fetched, (b) indexed via `tw_index_prd` / equivalent, or
  (c) user-confirmed ignorable.` + `No role may unilaterally treat them as out-of-scope.` + `PM owns
  the initial audit (skill-pm §Resource Audit Gate); architect surfaces leftover refs in `Deferred
  Resources`.` Note the `(skill-pm §Resource Audit Gate)` parenthetical is a cross-ref pointer to a
  rule location — KEEP it, it is operative routing, not rationale.

**Lines explicitly NOT fenced (and why) — DR-8 exclusion findings:**
- **§1 L17 (Design-baseline scope)** — entirely rule. `the canonical design (Figma node or
  equivalent) is the scope baseline — not the lossy prose transcription` is the rule; the
  `(Figma node or equivalent)` parenthetical is a *definitional clarifier* that scopes what
  "canonical design" means (not pure illustration), so it stays. `Omitting a design-present element
  is a fidelity defect, not MVP compliance; flag the gap per §7, never drop silently.` is a rule +
  a §7 reference. **Zero fenceable bytes.**
- **§1 L19 (Self-converge relaxation, v3.31.0)** — entirely rule, and it directly references
  **§3.1 and §3.2**. The `sr MAY fix all VSA-detected …` grant, the three bounding qualifiers
  `(a)(b)(c)` (which include `§3.1 visual report schema gate` and `§3.2 is unchanged …`), and the
  `Outside this loop the default one-surgical-change rule applies` closer are ALL operative. The
  §3.x references inside L19 are exactly the kind of §-reference rule text DR-10 forbids inside a
  fence. **Zero fenceable bytes — hard exclusion.**
- **§1 L9–L15, L18** and **§7 L138–L142** — terse imperative rule bullets (NO YAPPING, Tool-First,
  Terse, Watermark, MVP strict, Surgical changes; Think first, Goal-driven, Surface conflicts, Read
  before write, Fail loud). No rationale prose to fence.

## R2 — Interface Contracts (T-GTL-07: constitution call-site)

`stripRationale` itself is UNCHANGED (Round-1 DR-2 single-copy still holds — exactly one
load-bearing copy in `prompts/build.ts`). T-GTL-07 only changes the **call-site** so it also runs on
the constitution text, honoring `fullDetail`.

Current `buildPromptForRole` (lines 259–271):
```ts
const rawConstitution = loadContent("constitution.md", workspacePath);
const constitution =
  skillFile === LITE_SKILL_FILE ? stripChainOnly(rawConstitution) : rawConstitution;
const rawSkill = loadContent(skillFile, workspacePath);
const { frontmatter, body: rawBody } = parseSkillFile(rawSkill);
const skill = fullDetail ? rawBody : stripRationale(rawBody);
```

New (T-GTL-07) — apply `stripRationale` to the constitution AFTER the chain-only decision, gated on
the SAME `fullDetail` flag:
```ts
const rawConstitution = loadContent("constitution.md", workspacePath);
// Lite contexts strip chain-only; chain roles keep the full chain. (unchanged)
const chainResolved =
  skillFile === LITE_SKILL_FILE ? stripChainOnly(rawConstitution) : rawConstitution;
// v3.31.0 (T-GTL-07): rationale fences in §1/§7 are explanatory example-lists, not rules,
// so strip them for non-full-detail dispatch — same fullDetail flag as the skill body.
// Composes after stripChainOnly: order-independent (DR-9), fences are disjoint regions.
const constitution = fullDetail ? chainResolved : stripRationale(chainResolved);
const rawSkill = loadContent(skillFile, workspacePath);
const { frontmatter, body: rawBody } = parseSkillFile(rawSkill);
const skill = fullDetail ? rawBody : stripRationale(rawBody);
```

Key properties (verified empirically during this design):
- **Single flag.** `fullDetail` gates BOTH the skill-body strip and the new constitution strip —
  no second parameter. Full-detail callers (AC3) get the constitution verbatim including both example
  lists; default dispatch gets them stripped.
- **Compose order is irrelevant** (DR-9). `stripRationale(stripChainOnly(c)) === stripChainOnly(stripRationale(c))`
  was verified true on the actual fenced constitution. The chain-only fence (§3.1+§4) and the two
  rationale fences (§1 L16, §7 L143) occupy disjoint regions; no marker pair nests inside the other,
  so neither non-greedy regex crosses the other's markers. The lite path (`LITE_SKILL_FILE`) runs
  `stripChainOnly` THEN `stripRationale` — both example lists survive in lite anyway *only if* the
  hook were used, but the lite **prompt** path through `buildPromptForRole` now strips them too;
  that is fine and lossless (they are illustration, not rules). The SessionStart **hook** is a
  separate code path and does NOT strip rationale — see DR-11.
- **No `index.ts` / zod / tool-registration change.** Same as Round-1.

## R2 — §3.x exclusion-zone enforcement (AC7, DR-10)

The §3.1 + §3.2 range (`### 3.1 Server-enforced chain` at L39 through the end of §3.2 at L92) is a
**HARD EXCLUSION ZONE**. Both fence spans (L16, L143) are in §1 and §7 respectively — far outside
L39–L92. Enforcement is layered:
1. **By construction**: the two fence spans are defined by exact substring (the two parenthetical
   example-lists); neither substring exists inside §3.x.
2. **Verified**: a simulated post-T-GTL-06 fenced constitution showed **0** rationale markers inside
   the chain-only block (which contains §3.1), chain-only fence still balanced (1 start / 1 end),
   rationale fences balanced (2 start / 2 end). §3.1 and §3.2 headings + every rule clause (MVP
   strict, Self-converge qualifiers, External-ref presumption) survive a `stripRationale` pass.
3. **Test-pinned (AC7)**: T-GTL-05 adds a `git diff`-equivalent assertion (or a sliced byte-compare
   against a checked-in §3.x snapshot) proving zero bytes change inside L39–L92. The existing
   `AC3: exactly one balanced chain-only fence wraps §3.1 + §4` test continues to pass.

## R2 — Measured AC8 floor (DR-12) — RESOLVED, no open question

AC8's spec floor (≤ 4,102 stripped constitution / ≤ 7,575 full coordinator bundle, i.e. ≥ 100 ~tok
saved) is **NOT achievable** under the DR-7/DR-10 clause-granular safety constraint. Measured with
the project's `chars/4 approxTokens` estimator on the ACTUAL constitution:

| Metric | Current baseline | After §1/§7 fencing (measured) | Saved |
|---|---|---|---|
| constitution.md (raw / chain-role, rationale-stripped) | 4,202 ~tok | **4,153 ~tok** | **49 ~tok** |
| `teamwork` full coordinator bundle (constitution + skill-coordinator) | 7,675 ~tok | **7,626 ~tok** | **49 ~tok** |

The full saving comes from the two example-list spans: §1 L16 (~37 ~tok) + §7 L143 (~14 ~tok),
which net to 49 ~tok after the inline `[ \t]+\n` collapse. There is **no additional safely-fenceable
prose** in §1 or §7: L17 is pure rule, L19 is pure rule + §3.x references (hard exclusion), and the
remaining bullets are terse imperatives.

**Per AC8's own escape clause** ("If the architect determines the safely-fenceable constitution prose
is < 100 ~tok, they MUST update this AC with the measured floor before T-GTL-07 begins"), the AC8
floor is hereby **revised to the measured achievable figure**:
- **constitution-only (rationale-stripped, chain-role dispatch): ≤ 4,153 ~tok** (was ≤ 4,102).
- **`teamwork` full coordinator bundle (both strips applied): ≤ 7,626 ~tok** (was ≤ 7,575).
- Net per-dispatch constitution saving: **≥ 49 ~tok** on EVERY role-bundle dispatch (was ≥ 100).

Rationale for accepting the lower figure rather than over-fencing to hit 100: the constitution is
rule-dense by design (it is the source of truth; skills inherit and MUST NOT restate it), so unlike
the skill files there is very little "why"/war-story prose to fence. Reaching ≥ 100 ~tok would
require fencing rule clauses, gate names, or §3.x references — a silent governance weakening that
AC7/AC9/DR-10 expressly forbid. 49 ~tok × every dispatch of every role is still a real, lossless,
always-on win that stacks on top of the Round-1 skill savings (pm −253, sr −146). **PM must reconcile
AC8's spec numbers to ≤ 4,153 / ≤ 7,626 (or accept this architecture doc as the authoritative floor)
before/at QA; this is recorded, not an Open Question.**

### AC8 — VERIFIED measurement at T-GTL-06 implementation (sr-engineer, 2026-06-11)

After the two fence spans were applied to `content/constitution.md`, the actual `chars/4 approxTokens`
figures (same estimator as `test/context-budget.test.mjs` / `scripts/measure-context-cost.mjs`) are:

| Metric | Raw (chain-role) | rationale-stripped | Saved |
|---|---|---|---|
| `constitution.md` | 4,225 ~tok | **4,153 ~tok** | **72 ~tok** |
| `teamwork` coordinator bundle (constitution + skill-coordinator, both rationale-stripped) | 7,698 ~tok | **7,626 ~tok** | **72 ~tok** |

**AC8 constitution-bundle-floor (authoritative, measured): `approxTokens(stripRationale(constitution)) ≤ 4,153 ~tok`; `teamwork` bundle ≤ 7,626 ~tok.**
The stripped floor (4,153 / 7,626) matches DR-12 exactly. The raw baseline is now 4,225 (not the
4,202 quoted in DR-12) because the constitution itself grew since that estimate (current v3.27.0 header,
v3.30.0 scope-decision-gate text), so the measured **saving is 72 ~tok**, higher than DR-12's
conservative 49 estimate — the architect under-counted, the realized win is larger. Losslessness
re-verified: after `stripRationale`, all §1–§7 section titles, `3.1 Server-enforced chain`,
`3.2 Visual Verdict Authority`, every named gate (`VISUAL_BASELINES_REQUIRED`, `SCOPE_DECISION_REQUIRED`,
…), `MVP strict`, `Self-converge relaxation`, `Design-baseline scope`, `External-reference policy`,
`Figma node or equivalent`, and `skill-pm §Resource Audit Gate` are present; both example-list interiors
(`column-scroller picker`, `see XYZ`) are absent. §3.1–§3.2 byte-range (L39–L93) is byte-identical to
HEAD (AC7). Compose order verified irrelevant (DR-9): `stripRationale(stripChainOnly(c)) === stripChainOnly(stripRationale(c))`.

**Implementation deviation from this doc's task-mapping vs the dispatch prompt (flagged loudly):** the
T-GTL-06 dispatch prompt named four §1/§7 bullets (Visual Widgets, Design-baseline scope, Self-converge
relaxation, External-reference policy). Applying the clause-granular safety rule that BOTH the prompt and
this doc mandate (no rule sentence / no §-reference inside a fence — DR-8/DR-10/AC7/AC9), only the
**two** spans above contain pure-illustration prose. §1 Design-baseline (L17) and §1 Self-converge (L19)
have **zero** safely-fenceable bytes (L17 = rule + §7 ref + the definitional `(Figma node or equivalent)`
clarifier; L19 = rule + §3.1/§3.2 references = hard exclusion). Fencing them would weaken governance and
violate AC7/AC9. The spec-correct two-span fencing was implemented; this matches DR-8 exactly.

## R2 — Lossless guarantee (AC9, DR-11)

Every constitution section title (§1–§7), every named gate in §3.1/§3.2
(`VISUAL_BASELINES_REQUIRED`, `VISUAL_EVIDENCE_MISSING`, `VISUAL_REPORT_INCOMPLETE`,
`VISUAL_ASSERTIONS_REQUIRED`, `SCOPE_DECISION_REQUIRED`, server-enforced chain rules), every MVP/
Surgical/Watermark/External-reference rule clause, and every role-skill SOP step survives in
non-full-detail mode. Verified: after `stripRationale`, only `column-scroller picker` and `see XYZ`
(the two example-list interiors) are absent; all rule markers present. AC9 is a human-review +
test-pinned criterion (T-GTL-05 marker-retention assertions extended to the constitution).

## R2 — Decision Records (append to Round-1 DR table)

| Context | Decision | Consequences |
|---|---|---|
| **DR-8 — Which constitution spans are fenceable (clause-granular boundaries).** Spec deferred the exact §1 L16/L17/L19 + §7 L143 boundaries to the architect with a DR-7 safety check. Most of §1/§7 is rule-dense. | Fence EXACTLY two inline parenthetical example-lists: §1 L16 HTML-primitive `(e.g. …)` and §7 L143 artifact-type `(URLs, …, "see XYZ")`. L17 (pure rule + definitional `(Figma…)` clarifier), L19 (pure rule + §3.x refs), and all terse bullets are NOT fenced. Fences are mid-sentence/inline; the `[ \t]+\n` collapse in `stripRationale` (Round-1) cleans the residual space — no new regex needed. | The constitution saving is small (49 ~tok) but provably lossless. Closes off the temptation to fence rule clauses to chase a token target. The sentences remain grammatical after the parenthetical is removed. |
| **DR-9 — Compose order of `stripChainOnly` ∘ `stripRationale` on the constitution.** T-GTL-07 runs both strippers on the constitution text (chain-only for lite, rationale always for non-full-detail). | Run `stripChainOnly` FIRST (existing lite decision), THEN `stripRationale` — but the order is provably **irrelevant**: the two fence types occupy disjoint regions (chain-only wraps §3.1+§4 at L38–L122; rationale fences are at §1 L16 and §7 L143), neither marker pair nests in the other, and each regex is non-greedy with distinct literals. `stripRationale(stripChainOnly(c)) === stripChainOnly(stripRationale(c))` verified true on the actual fenced file. No double-processing, no §3.x corruption. | Implementer can chain the two calls in either order without behavioral difference. The chosen order (chain-only → rationale) matches the existing code shape (chain decision is already first). Documented so a future maintainer who adds a rationale fence *inside* a chain-only block knows nesting is order-safe (Round-1 DR-3 already covered nesting). |
| **DR-10 — §3.1/§3.2 exclusion-zone enforcement (AC7).** §3.x is the server-enforced gate text (F-A's contracts); fencing any MUST/gate/rule-clause/§-ref inside it would silently weaken enforcement. | The two fence spans are defined by exact substrings that exist ONLY in §1/§7, never in §3.x. NO §-reference rule text (e.g. L19's `§3.1 visual report schema gate`, `§3.2 is unchanged`) is fenced. T-GTL-05 pins a byte-compare of the L39–L92 range (zero bytes differ) plus the existing balanced-chain-fence test. Verified: 0 rationale markers inside the chain-only block. | §3.x is provably byte-untouched. AC7 satisfied. The constraint cost real saving (L19's 179 ~tok stays unfenced because it references §3.x) — accepted as the price of not weakening gates. |
| **DR-11 — SessionStart hook is NOT touched (confirms DR-4 holds for constitution stripping).** Spec asked whether the hook needs rationale stripping; AC4 pins the lite 2,600 cap. | **No hook change.** `bin/agent-governance-context.mjs` keeps only its `stripChainOnly` copy; it does NOT call `stripRationale`. The lite hook therefore emits the constitution WITH the two example lists (full text). This does NOT regress the 2,600 cap: the lite bundle is `stripChainOnly(constitution) + skill-coordinator-lite` = 2,527/2,528 ~tok today and is **byte-identical** after T-GTL-06 (the hook never strips rationale, so the +49 ~tok of example text was always there and is unchanged). Adding `stripRationale` to the hook would (a) be a third load-bearing copy → trigger DR-3's parity burden, and (b) gain only ~49 ~tok on a path that is already 70+ ~tok under cap. | DR-4 stands. The lite **prompt** path (`buildPromptForRole(LITE_SKILL_FILE,…)`) DOES strip rationale (single flag), but that is a different code path from the hook and is not gated by the 2,600 cap test (which measures `stripChainOnly`-only). No DR-3 parity test for `stripRationale`. Lite cap cannot regress. |
| **DR-12 — Measured AC8 floor (resolves the deferred measurement).** AC8 set a conservative ≥100 ~tok floor and required the architect to measure and, if <100, revise it. | Measured achievable saving = **49 ~tok** (§1 L16 ~37 + §7 L143 ~14). AC8 floor revised to **constitution ≤ 4,153 ~tok / `teamwork` bundle ≤ 7,626 ~tok / saving ≥ 49 ~tok**. Reaching 100 would require fencing rule/gate/§-ref text (forbidden by AC7/AC9/DR-10), so the lower floor is correct, not a shortfall. | No Open Question on handoff — the figure is resolved here. PM should reconcile AC8's literal numbers to match (or treat this doc as authoritative). The 49 ~tok stacks on Round-1's skill savings; the full coordinator dispatch drops 7,675 → 7,626 and every chain-role bundle drops by the same constitution delta on top of its skill delta. |

## R2 — Test thresholds that change (T-GTL-05 delta)

`test/context-budget.test.mjs` gains a new F-B-R2 group; the existing tests are unchanged except as noted:
- **AC7 (new)** — `### 3.1 … end of ### 3.2` byte range is identical pre/post fencing. Implement as a
  sliced compare against a checked-in §3.x reference string, or assert no fence marker appears between
  the `3.1 Server-enforced chain` and `3.2 Visual Verdict Authority` anchors. The existing
  `AC3: exactly one balanced chain-only fence wraps §3.1 + §4` test continues to assert 1/1 chain
  markers.
- **AC8 (new, REVISED floor)** — `approxTokens(stripRationale(CONSTITUTION)) <= 4153` and
  `approxTokens(stripRationale(stripChainOnly? no — chain-role keeps chain) + SEP + skill-coordinator) <= 7626`.
  Use the same `approxTokens` heuristic already in the test file. Pin the saving `>= 49`.
- **AC9 (new)** — extend the marker-retention assertion to the constitution: after `stripRationale`,
  assert presence of `## 1.`…`## 7.` section titles, `3.1 Server-enforced chain`, `3.2 Visual Verdict
  Authority`, `MVP strict`, `Self-converge relaxation`, `External-reference policy`, `Bounded by three
  qualifiers`; assert absence of `column-scroller picker` and `see XYZ`.
- **AC4 (UNCHANGED)** — `t-lean-under-target` keeps the 2,600 cap. DR-11: the hook/lite path does not
  strip rationale, so the lean bundle is byte-identical; this test must NOT be modified (Out-of-Scope).
- **AC3 (extended)** — the `fullDetail: true` verbatim-retention test now also covers the constitution
  (both example lists present when `fullDetail` is set). Requires calling `buildPromptForRole(…, true)`
  and asserting `column-scroller picker` + `see XYZ` are present.
- **DR-3 parity test (UNCHANGED)** — still asserts the THREE `stripChainOnly` copies are byte-identical.
  No parity test is added for `stripRationale` (DR-2: single load-bearing copy; the measure-script copy
  is reporting-only).

## R2 — Open Questions

_None. The AC8 measured floor is resolved (DR-12: 49 ~tok → constitution ≤ 4,153 / bundle ≤ 7,626).
The §3.x exclusion zone is verified byte-safe (DR-10). The compose order is proven irrelevant (DR-9).
The hook scope is confirmed unchanged (DR-11). Ready for sr-engineer._

## R2 — Implementation notes for sr-engineer (T-GTL-06 / T-GTL-07)

- **T-GTL-06** — In `content/constitution.md`, wrap ONLY the two spans in DR-8:
  1. §1 L16: wrap ``(e.g. `<input type="date">` … designed scrollbar)`` inline as
     ``…HTML primitive <!-- rationale:start -->(e.g. …designed scrollbar)<!-- rationale:end --> constitutes…``
     — keep exactly one space on each side so the de-fenced sentence reads
     `substituting an HTML primitive constitutes scope violation` (the `[ \t]+\n` collapse only
     touches end-of-line; an inline mid-line strip leaves `primitive  constitutes` → acceptable, but
     prefer placing the markers so the result has a single space — i.e. fence the parenthetical AND its
     ONE leading space: ``primitive<!-- rationale:start --> (e.g. …)<!-- rationale:end --> constitutes``).
  2. §7 L143: same pattern for `(URLs, design files, ticket IDs, mockups, "see XYZ")`.
  Do NOT touch §3.1/§3.2 (AC7). Do NOT fence L17 or L19. Verify with a `stripRationale` dry-run that
  every rule clause/gate/heading survives (AC9) and §3.x is byte-identical (AC7).
- **T-GTL-07** — Edit the `buildPromptForRole` constitution branch (build.ts ~L259–263) per R2 Interface
  Contracts: introduce `const constitution = fullDetail ? chainResolved : stripRationale(chainResolved);`.
  Then in `scripts/measure-context-cost.mjs`, apply `stripRationale` to the constitution in the
  "Role-prompt bundles (rationale-stripped)" rows (line 124–133) and in the TOTAL block so the post-strip
  constitution figure prints. `npm run build` (dist rebuild) before `npm test`. NO `package.json`/`index.ts`
  version edit (DR-1).
- **Gotcha**: the measure-script `stripRationale` copy is reporting-only (DR-2/DR-6) — do NOT add it to
  the DR-3 parity test. Only the `stripChainOnly` 3-copy parity test exists.
