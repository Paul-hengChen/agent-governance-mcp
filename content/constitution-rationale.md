# Constitution Rationale — the "why" behind the rules

> Companion to `content/constitution.md` (v3.27.0). This document is **non-normative**:
> the constitution remains the single source of truth. Nothing here adds, relaxes, or
> overrides a rule — it records the design intent and war-stories behind the rules that
> are easiest to misread as arbitrary. References point **one-way**, from this doc to a
> constitution section id (e.g. "see Constitution §3.2"); the constitution does not
> reference back.
>
> Rationale target: v3.32.0. Scope: §1, §3.1, §3.2, §5, §7.
>
> Primary sources: `research/cde-oobe-visual-fidelity-retrospective-2026-06-05.md`
> (the false-PASS retrospective), `research/process-retrospective.md` (the Language-step
> token/cost retrospective), and the inline `<!-- rationale -->` notes already in
> `content/constitution.md` and the skill files.

---

## §1 — Output Directives: MVP, the Visual-Widgets exception, and Design-baseline intent

See Constitution §1.

**Why MVP is "Zero Tolerance".** The default failure mode of a capable coding agent is
*over*-delivery: speculative abstractions, predictive features, drive-by refactors of
adjacent code. Each is unrequested scope that the human must now review, test, and
maintain. "Fulfil ONLY what was asked" is the cheapest possible spec-conformance check —
if it wasn't asked for, it's a defect regardless of code quality.

**Why the Visual-Widgets exception exists (v3.14.0).** MVP-strict has a sharp edge for
UI work: an agent reading "minimum viable" will substitute an HTML primitive
(`<input type="date">`, `<select>`, the browser scrollbar) for a designed widget and
call it MVP compliance. It is the opposite. The CDE-OOBE retrospective is the canonical
evidence: the run shipped boxed surface-raised chips where Figma specified full-width
plain text rows, flat rows where Figma wrapped each setting group in a bordered box, and
DHCP/Static segmented buttons where Figma showed a `‹ DHCP ›` cycling selector
(retrospective §1.1, §1.4, §1.7; taxonomy A1). The PM-declared widget shape *is* the
minimum scope; downgrading it is a scope **violation**, not a simplification.

**Why Design-baseline scope was added (v3.27.0).** The retrospective's root cause A1 is
"layout serialized to lossy prose": Figma autolayout (flex/align/itemSpacing, group-box
containers, cycling selectors) gets dropped when transcribed into prose tokens, and the
engineer then flat-lays its own guess. The process-retrospective quantified the same
failure at the geometry level — exact asymmetric margins (40/32), dot-to-left-edge
alignment, and stepper fill-through were never pinned into the spec, so the engineer
implemented the *words* (a lossy transcription) rather than the design (§4). The fix is
to declare the **canonical design** (the Figma node or equivalent), not the prose, as
the scope baseline. A gap versus the design is therefore a *fidelity defect to be
flagged under §7*, never silently dropped as "MVP".

> Cross-reference: this is the policy half of the implementation gate in
> `content/skill-sr-engineer.md` (the Scoped Render Self-Check) and the schema half in
> `content/skill-pm.md` (the `## Visual Widgets` table).

---

## §3.1 — The PASS gates: why PASS is gated server-side, not by convention

See Constitution §3.1.

The retrospective's decisive lesson (taxonomy B1/B6) is that **prompt-advisory rules are
insufficient** when the same orchestration can ignore them. A coordinator-authored
accept-policy pre-excused the exact visual defect, and the first "PASS" ran no visual
check at all (`visual_round=0`). The conclusion: the rules that matter must be enforced
at the storage boundary, where no client prompt can route around them. The §3.1 gates
are that enforcement.

**Visual evidence gate (v3.16.0).** The gate self-arms on `design/<active_feature>.md`
with `## Mode` ≠ `no-design` — *not* on the presence of a `## Visual Baselines` section.
This ordering is deliberate: arming on the baselines section would let an under-specified
design file (no baselines) sail through as a silent non-UI pass — precisely retrospective
B6 ("gate armed late"). So when armed but baselines are absent, PASS is *blocked* with
`VISUAL_BASELINES_REQUIRED` and the design-auditor must add the section. When baselines
are present, PASS additionally requires a `qa_reports/visual_<id>.md` evidence file per
task. Non-UI workspaces (no design file, or `## Mode = no-design`) stay silent and
pass-through — the gate is backwards-compatible by construction.

**Report-schema gate (v3.26.0/v3.27.0).** Requiring an evidence file is not enough if the
file can be empty or self-excusing. When the design declares
`## Visual Structural Assertions`, PASS validates the report against
`REQUIRED_VISUAL_SECTIONS` (Widget Shape Verification, Canonical State Verification,
Structural Assertions, Region Diff, Allowed Differences, Verdict). A missing section, a
failed/unverified structural row, or a non-PASS verdict returns
`VISUAL_REPORT_INCOMPLETE`. This directly answers retrospective B4 ("no structural
assertions": nothing checked is the focus bar present? is the group box present? is the
primary button the accent color?). If the gate is armed but the design omits the
assertions section entirely, PASS returns `VISUAL_ASSERTIONS_REQUIRED` — a hard error,
deliberately *not* a silent fallback, because a silent fallback is how B6 happened.

**Scope-decision gate (v3.30.0).** This closes the routing-chain half of retrospective
finding A0 — "the oversized → ask-the-human gate never fired". The whole 9-screen OOBE
was scoped as one feature and driven in-context, bypassing the PM → feature-split →
design-auditor path that would have prompted a human to split it. The gate blocks a
transition *into build* (`pm → architect` or `pm → sr-engineer`) with
`SCOPE_DECISION_REQUIRED` when a design file is armed but no scope decision is recorded.
It clears on EITHER `.current/feature-split.md` (a multi-feature split) OR handoff
`scope_decision: single-feature` (an explicit single-feature attestation). The
predecessor is pinned to `pm:In_Progress`, so re-entry and self-loops are never
re-blocked — the gate fires once, at the moment scope should have been decided, and never
nags afterward. It is independent of the visual evidence gate (different edge, different
artifacts) and silent for non-design workspaces.

---

## §3.2 — Visual-verdict authority and separation of duties: the false-PASS war-story

See Constitution §3.2.

This is the section the retrospective exists to justify. The CDE-OOBE run "burned a large
token volume AND shipped a UI far from the Figma design while reporting a PASS"
(retrospective header). The §3.2 rules are the governance fixes for that specific event.

**The war-story (taxonomy B1 — the single decisive cause).** A hand-written *accept-policy*
in the qa-visual subagent prompt — authored by the **coordinator**, not qa — pre-classified
"selection state" and "scroll offset" as accepted differences. Those were exactly the
defects on the Language screen: no `#3C5AAA` selection bar rendered, and the impl was
captured at an arbitrary scroll/selection state instead of the baseline's. By pre-excusing
them, the coordinator's policy turned real structural misses into "allowed diffs", and the
chain stamped a PASS. The human caught it, not the system.

**Why "visual verdict is qa-visual-owned" (the fix).** ONLY qa-visual may define visual
PASS criteria, diff tolerance, or pre-excused divergence classes — and only inside the
`## Allowed Differences` section of `qa_reports/visual_<id>.md`. Every non-qa role
(including the coordinator) MAY pass context — baseline paths, Figma node ids, route,
canonical-state setup — but MUST NOT define, relax, or pre-accept any visual difference.
The enforcement is structural rather than content-sniffing: the visual report is consulted
only on a qa-engineer PASS, and `status=PASS` is server-restricted to
`agent_id="qa-engineer"`, so the report and its `## Allowed Differences` are owned by the
qa chain at PASS time by construction. A coordinator-authored accept-policy injected into a
dispatch prompt is **void**.

**Why "builder ≠ judge" (role-collapse guard).** Retrospective D2/C5: under subagent rate
limits, the coordinator absorbed the design-auditor, sr-engineer, and qa roles inline —
the same actor wrote the code, authored the verdict criteria, and signed the PASS, with no
independent adversary left. The guard: if subagent limits force a role inline, that actor
MAY build/edit but MUST NOT author the visual verdict nor self-issue a visual PASS. With no
independent qa context available, visual-backed work stops at `status=Blocked` ("awaiting
independent QA") — never a builder-signed PASS.

**Why "no global-frame metric" (false-PASS prevention).** Retrospective B2: the Language
screen scored 6.18% whole-frame difference on a mostly-empty 1280×720 dark canvas, which
"looks near-passing" — a structural error confined to a small content region is invisible
to a whole-frame percentage. The process-retrospective shows the inverse working as
intended: from Round 2 the overall diff was already under threshold (2.13% → 1.86% →
1.33% → 0.92%), yet region-weighted analysis kept surfacing real structural deviations
underneath those "passing" numbers (§4). Comparison must be per-surface / region-weighted
with explicit structural assertions and canonical-state parity — never a global percentage.
The external reviewer's suggestion to *lower* the pixel tolerance was rejected for the same
reason: the run failed from QA being **too lenient**, and a px tolerance cannot catch a
structural miss (boxed-chips vs blue-bar is not a 4px offset) (retrospective §3, §5).

**Why the sequential-context reconcile clause (R10).** The chain assumes sequential
single-context handoffs; background/parallel `Task` fan-out and inline-coordinator
execution desync `tasks.md` from the authoritative `handoff.completed_tasks`
(retrospective D1). The rule: after any out-of-band/inline execution, run
`tw_detect_drift` before a PASS or hand-back; on handoff-ahead drift run `tw_sync`
(bookkeeping only — it mirrors the ledger onto `tasks.md`, never writes handoff, never
promotes a `tasks.md`-only `[x]`). Tasks-ahead "vibe drift" is reported, not reconciled.

> Note on the self-converge relaxation (§1 v3.31.0, see also `content/skill-sr-engineer.md`).
> The process-retrospective found 55.6% of the Language-step tokens went to four visual
> rework rounds, partly because the coordinator framed each round as "fix one property,
> don't touch adjacent". The relaxation lets sr fix all VSA-detected deviations in one
> self-converge pass — but it is deliberately bounded so it does not reopen the false-PASS
> hole: scope is the pre-handoff self-converge loop only, QA still independently verifies
> every VSA row at PASS, and §3.2 is unchanged (no global-frame metric; builder ≠ judge).

---

## §5 — Anti-Loop Circuit Breaker: why the caps are hard numbers

See Constitution §5.

The caps (max 2 consecutive auto-fix tries on the same failure, max 3 reads per target,
max 10 role transitions per `/teamwork` session) exist because an agent's natural response
to a failure it cannot diagnose is to *try again* — re-reading the same file, re-applying a
near-identical fix — which burns tokens without converging. The process-retrospective is
the cautionary data point at the *macro* scale: a single screen (Language) consumed
~1.05M subagent tokens across 15 contexts, 55.6% of it in visual rework rounds, and one QA
round alone idled overnight (~15.6h wall-clock) before producing a FAIL (§Summary, §1).
That is what unbounded iteration costs. The circuit breaker forces an early, loud stop:
on limit, stop tool use immediately, report what is missing, and wait for a human. Per
§Document Priority, when §5 trips the hand-back is Blocked/FAIL — never an error-laden PASS,
and never an extended loop. The `visual_round` split-escalation hatch (§3.1) is the
same philosophy applied to pixel iteration: at Round 3, prefer splitting the oversized
widget over grinding two more rounds toward threshold renegotiation.

---

## §7 — External-reference policy: a spec is incomplete until its references are resolved

See Constitution §7.

Retrospective A0 and the "scope honesty" open question are the motivation. The CDE-OOBE
spec referenced a Figma file as the design source, but the design-auditor hit limits and
collapsed inline (taxonomy C5/A6), so the references were never fully fetched or verified —
node-ids "resolved" by name pointed at the wrong screens (`4888:*` was Network), and wrong
baselines produce meaningless diffs. The lesson: an external reference left unresolved is
not a harmless TODO; it silently narrows scope and corrupts every downstream comparison.

The rule therefore presumes a spec referencing external artifacts (URLs, design files,
ticket IDs, mockups, "see XYZ") **incomplete** until each reference is (a) fetched,
(b) indexed via `tw_index_prd` or equivalent, or (c) user-confirmed ignorable. Critically,
**no role may unilaterally treat a reference as out-of-scope** — that unilateral drop is
exactly how the OOBE run lost fidelity. Ownership is explicit: PM runs the initial audit
(the Resource Audit Gate), and the architect surfaces leftover references under
`Deferred Resources` so nothing falls through silently. This is also why §1's
Design-baseline rule says to *flag* a design-versus-spec gap rather than drop it: the two
rules are the same discipline — surface the gap, never assume it away.
