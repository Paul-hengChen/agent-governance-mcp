# governance-tag-strip (backlog A4)

## Problem Statement

`content/constitution.md` and the `content/skill-*.md` files carry inline
maintainer-provenance tags — version stamps (`(v3.26.0)`), backlog/finding
codes (`(R10)`, `(B10)`), bare `root cause C1`-style phrases, and retrospective
pointers (`research/process-retrospective.md`) — mixed directly into normative
sentences. These tags help maintainers trace *when* and *why* a rule was
added, but the executing agent gets zero behavioral value from them: it pays
tokens on every dispatch to read archaeology it cannot act on. `prompts/build.ts`
already strips three other categories of non-operative text at bundle time
(`stripChainOnly`, `stripRationale`, `stripDesignOnly`); this ticket adds a
fourth, narrower pass — `stripOriginTags` — that removes provenance tags only,
leaving 100% of normative rule text (including legitimate in-line
cross-references like "§3.1" or "Constitution §7") untouched. Source files keep
full provenance for maintainers; only the served bundle is cleaned.

## User Stories

- As an agent receiving a role prompt (pm, sr-engineer, architect, qa-engineer,
  researcher, coordinator, coordinator-lite), I want the constitution and
  skill text free of version/finding-code archaeology, so that every token I
  read is either an instruction or a cross-reference I can follow.
- As a maintainer editing `content/constitution.md` or a skill file, I want to
  keep annotating rules with the version/finding that introduced them, so that
  future maintainers (and retrospective authors) can trace rule provenance
  without that cost being paid by every downstream agent.

## Measured Tag Inventory (as of this spec, post-A6/A7 hand-stripping)

Grepped `content/constitution.md` + all `content/skill-*.md` for
`(vX.Y.Z…)`, bare `(B#)`/`(R#)` codes, `root cause <code>` phrases, and
`research/process-retrospective.md` pointers:

| file | tag count | tag chars | ~tokens (chars/4) | file ~tokens (raw) |
|---|---|---|---|---|
| content/constitution.md | 15 | 160 | 40 | 4634 |
| content/skill-design-auditor.md | 13 | 304 | 76 | 4637 |
| content/skill-sr-engineer.md | 8 | 99 | 24 | 2335 |
| content/skill-architect.md | 3 | 135 | 33 | 1984 |
| content/skill-coordinator.md | 3 | 35 | 8 | 3655 |
| content/skill-pm.md | 3 | 111 | 27 | 3117 |
| content/skill-qa-engineer.md | 2 | 74 | 18 | 2059 |
| content/skill-qa-visual.md | 1 | 10 | 2 | 3886 |
| **total** | **48** | **928** | **~232** | — |

**Calibration against the backlog's original 5–10% guess**: that estimate
predates A6/A7 (`skill-qa-visual.md`, `skill-pm.md` hand-rewrites), which
already captured the highest-density sites by hand — `skill-qa-visual.md` now
has exactly **1** tag left. The remaining opportunity is real but smaller: per
dispatch, savings run from **~2 tokens** (qa-visual leg of a qa-engineer
dispatch) to **~76 tokens** (skill-design-auditor, the densest remaining
file) plus a shared **~40-token** constitution contribution that partially
overlaps with content already removed by the existing chain-only/design-only
strips for non-chain / non-design dispatches. Net: roughly **0.5–2% of a
typical stripped bundle**, not 5–10%. This is a real, free, permanent
per-dispatch saving with no functional cost — worth shipping — but the spec
does not inflate the number to match the stale backlog guess. T-GTS-06
re-measures the exact post-implementation figures against the existing
token-cap tests.

## Decision: fence markup (`<!-- origin:start/end -->`), not regex

**Chosen: (a) explicit `<!-- origin:start -->…<!-- origin:end -->` fence
pairs**, authored by hand around each provenance substring, using the exact
same non-greedy-regex removal mechanism `stripChainOnly` / `stripRationale` /
`stripDesignOnly` already use in `prompts/build.ts`.

**Rejected: (b) a blind regex pass over `(vX.Y.Z…)`-shaped text.** Two
concrete findings from the inventory rule it out:

1. **Heterogeneous tag shapes.** Version tags are parenthesized
   (`(v3.26.0)`), but backlog codes are sometimes bare parens (`(R10)`,
   `(B10)`) and root-cause references are **not parenthesized at all** —
   `content/skill-design-auditor.md:23` reads literally `root cause A1` and
   `content/skill-sr-engineer.md:23` reads `root cause C1`, as free text
   embedded mid-sentence. A single regex that safely covers "any parenthetical
   containing a version" AND "bare root-cause phrases" AND "backlog codes"
   without over-matching normal prose is not one regex — it's several,
   independently prone to drift, which reproduces exactly the "governance
   text corruption is silent" failure class the backlog's own A3 ticket
   worries about.
2. **Mixed-content parens — the disqualifying finding.** Several tags share a
   parenthetical with real normative text, not just provenance:
   - `content/constitution.md:121` — `` `visual_round` (v3.14.0, §3.1) tracks
     pixel-fidelity iterations `` — the same parens carries the version stamp
     **and** a legitimate cross-reference to §3.1. A regex that deletes the
     whole paren drops the cross-reference; a regex that deletes only the
     version substring leaves a dangling `(, §3.1)`.
   - `content/skill-pm.md:24` — `` (v3.26.0; MANDATORY when
     `design/<feature>.md` mode ≠ no-design) `` — the parens carries the
     version stamp **and** the gate's arming condition. Deleting the whole
     paren silently deletes a real MUST-clause qualifier — a functional
     regression, not a token-budget win.
   - `content/skill-design-auditor.md:28` — `(v3.26.0 extended schema;
     pre-v3.26 4-column rows remain valid — missing columns read as
     `unspecified`)` — the parens carries backward-compat guidance, not pure
     provenance.

   A regex cannot tell "pure provenance paren" from "provenance-prefixed
   normative paren" without effectively re-deriving the per-site authoring
   judgment a human already has to apply — at which point it is not simpler
   than fencing, it is fencing with extra failure modes (silent deletion
   instead of a visible, reviewable content edit).

3. **Matches existing infra, survives A9 better.** `stripOriginTags` becomes
   a fourth sibling of `stripChainOnly`/`stripRationale`/`stripDesignOnly` —
   same regex shape, same idempotence contract, same call site. Reviewers
   already understand this mechanism. Under A9 (compose-not-strip, which
   replaces ALL fence-stripping with additive module composition), a fenced
   span degenerates trivially — the fenced text simply isn't copied into the
   composed module, or an "origin-fence pass" survives as a small
   pre-processing step on the authored partials. A regex-based tag-scrubber
   has no analogous soft landing; it would need to be reinvented as
   authoring discipline anyway once A9 lands, so building it as fencing now
   is not wasted work.

**Cost accepted**: fencing requires touching all **48 sites across 8
content files** by hand (T-GTS-02/03), and — because inserting fence-marker
bytes *inline*, mid-sentence, changes the **raw source bytes** at each tag
site — every existing test that does raw-substring `indexOf`/`includes`
matching against `content/constitution.md` at one of these 48 sites breaks
too, not just tests that check the final bundle. That full list is enumerated
below (T-GTS-04/05/06). This is a strictly larger test-blast-radius than a
regex would have caused (a regex touches only bundle-output assertions,
not raw-source ones) — accepted deliberately, because the regex's failure
mode (silently deleting a real MUST-clause) is a correctness bug, whereas the
fence's failure mode (a test needs its literal updated) is a compile-time-loud,
one-time, mechanical qa-engineer task.

## Acceptance Criteria

- **AC1 (bundle is clean)**: Given `content/constitution.md` and
  `content/skill-*.md` have `<!-- origin:start/end -->` fences around every
  provenance tag, when `buildPromptForRole()` builds a dispatch for any role
  (chain or lite, fullDetail or not, design-armed or not), then the returned
  bundle text contains none of the 48 fenced tag substrings.
- **AC2 (mixed-content sites keep their normative half)**: Given a site where
  a tag shares a parenthetical with normative text (e.g. skill-pm.md's
  `(v3.26.0; MANDATORY when …)`, constitution.md's `(v3.14.0, §3.1)`), when
  the fence wraps only the provenance substring, then the served bundle still
  contains the surviving normative clause / cross-reference verbatim (e.g.
  `(MANDATORY when …)`, `(§3.1)`).
- **AC3 (stripper contract)**: `stripOriginTags` is idempotent
  (`stripOriginTags(stripOriginTags(x)) === stripOriginTags(x)`) and a
  safety-default no-op on text without markers, matching the contract of the
  three existing strippers.
- **AC4 (order-independence)**: `stripOriginTags` composes order-independently
  with `stripChainOnly` / `stripRationale` / `stripDesignOnly` — origin fences
  never straddle/cross a chain-only, rationale, or design-only fence boundary
  (may nest inside one or sit beside one), so applying the four strippers in
  any order yields byte-identical output (extends the existing AC5/HC5
  contract). Wired into `buildPromptForRole` as the **first** strip applied
  (innermost span), unconditionally — not gated on `fullDetail`, lite, or the
  design arm, because provenance tags are pure noise at every detail level.
- **AC5 (existing pinned tests updated, not broken)**: every
  `test/context-budget.test.mjs` assertion enumerated in "Affected Tests"
  below is updated to match the post-fence, post-strip text, and
  `npm test` passes.
- **AC6 (caps re-baselined, not silently drifted)**: the four AC8
  ceiling-cap assertions (design-arm constitution ≤4523, non-design
  constitution ≤2409, teamwork bundle ≤8160, skill-pm ≤2850) are all `<=`
  upper bounds, so a shrinking bundle can only help them — EXCEPT the tests
  that call `stripRationale`/`stripDesignOnly` **directly on raw file
  content**, bypassing `buildPromptForRole` and therefore bypassing
  `stripOriginTags` entirely. For those, the *raw* file grows slightly (fence
  marker bytes: `<!-- origin:start -->` + `<!-- origin:end -->` ≈ 40 bytes ≈
  10 tokens per fenced site), which will tick the measured number **up**, not
  down, unless the test's composition chain is updated to include
  `stripOriginTags`. QA decides per test (T-GTS-06) whether to fold it in
  (recommended — keeps the test representative of what ships) and re-measures
  every cap and every `raw - stripped >= N` minimum-saving delta.
- **AC7 (error-code contract untouched)**: `test/error-code-contract.test.mjs`
  matches only `SCREAMING_CASE` tokens via `TOKEN_RE`/`SUFFIX_RE`/`PREFIX_RE`
  — a disjoint shape from every provenance tag. No change required; verified
  by re-running it after the content edits land.

## Copy / Strings

N/A — no user-facing strings introduced or changed; this is a governance-text
build-time transform, not a UI feature.

## Visual Tokens

N/A — no visual property introduced.

## Visual Widgets

N/A — no non-primitive control introduced.

## Visual Structural Assertions

N/A — non-design feature (no `design/<feature>.md`, `## Mode` = no-design by
absence). The design-only gates are inert for this ticket.

## Ordering / Idempotence Specification (for T-GTS-01)

`buildPromptForRole` currently composes, per dispatch:

```
rawConstitution → chainResolved (stripChainOnly, lite only)
                → rationaleResolved (stripRationale, unless fullDetail)
                → constitution (stripDesignOnly, unless design-armed)
rawSkill → { frontmatter, body } → skill (stripRationale, unless fullDetail)
```

`stripOriginTags` is added as the **first** transform on both raw inputs,
unconditionally (no fullDetail/lite/design gate):

```
rawConstitution = stripOriginTags(loadContent("constitution.md", ...))
...
rawBody = stripOriginTags(parseSkillFile(rawSkill).body)
```

Rationale for "first": origin-fenced spans are the smallest, most local
provenance markers in the text — they sit *inside* or *beside* the larger
chain-only/rationale/design-only fenced spans, never crossing their
boundaries (same disjoint/nested-marker invariant the other three already
rely on, per `stripDesignOnly`'s doc comment: "design-only fences are nested
inside chain-only … disjoint from rationale fences"). Stripping the smallest
spans first is a convention, not a correctness requirement — AC4 requires the
four strippers to be order-independent regardless.

**Explicitly out of scope**: `bin/agent-governance-context.mjs` (the
SessionStart hook) keeps its own duplicate of `stripChainOnly` only (per the
existing DR-3 3-copy-parity rule) and does **not** duplicate `stripRationale`
or `stripDesignOnly` (per `build.ts`'s DR-2 comment: those are single-copy,
`buildPromptForRole`-only). `stripOriginTags` follows the same DR-2 precedent
— single-copy, not mirrored into the hook. The SessionStart injection in this
repo will continue to carry origin tags after this ticket ships, exactly as
it already carries un-stripped rationale/design-only text today. A follow-up
ticket can extend hook parity if that gap matters later.

## Affected Tests (full enumeration)

`test/error-code-contract.test.mjs` — **no changes** (AC7).

`test/context-budget.test.mjs` — the only file with real byte-substring
hazards (13 other test files matched the tag regex but only in test
*names*/assertion *messages*, not content-equality assertions against
`content/*.md` — spot-checked, no action needed there per T-GTS-08):

1. `DESIGN_ONLY_SENTINELS` — `"Visual evidence gate (v3.16.0)"` and
   `` "`visual_round` sub-loop (v3.14.0)" `` — used both against
   `stripDesignOnly(CONSTITUTION)` directly and against 5 `buildOnFixture(...)`
   end-to-end calls. Update the literal to the post-fence form.
2. `ANTI_SWEEP_SENTINELS` — `"Sequential-context assumption + reconcile (R10)"`.
3. The raw-source anchor at the R10 byte-identity test:
   `CONSTITUTION.indexOf("- **Sequential-context assumption + reconcile (R10).**")`
   — breaks the instant the fence is inserted inline (raw file bytes shift at
   that exact position), independent of any strip logic.
4. `P2_S1_DESIGN_SENTINELS` — 3 entries, all version-tagged: "Visual Widgets
   exception (v3.14.0)", "Design-baseline scope (v3.27.0)", "Self-converge
   relaxation (v3.31.0)" — checked on both `buildOnFixture({mode:null})` and
   `buildOnFixture({mode:"figma"})` outputs.
5. `"AC4: every surviving (non-gated) rule on the non-design arm is
   byte-identical to source"` — `expectedConstitution =
   stripDesignOnly(stripRationale(CONSTITUTION))` must become
   `stripDesignOnly(stripRationale(stripOriginTags(CONSTITUTION)))`.
6. `"AC2/AC4: the gated spans on the DESIGN arm are byte-equal to the
   constitution source"` — `srcSpan` is sliced raw out of `CONSTITUTION` (so
   it still contains the fence markup) and compared via
   `text.includes(srcSpan)` against the stripped bundle (fence markup gone) —
   must run `srcSpan` through `stripOriginTags` before the comparison.
7. The four AC8 ceiling-cap tests (design-arm constitution ≤4523, non-design
   constitution ≤2409, teamwork bundle ≤8160) and the skill-pm ≤2850 cap —
   see AC6 above; each needs a decision (fold in `stripOriginTags` or not)
   and a re-measured constant either way.
8. `raw - stripped >= 49` and the two `>= 1830` minimum-saving-delta
   assertions — re-verify after re-baselining; expected to still hold since
   both sides of each delta shift by comparable amounts, but must be
   confirmed empirically, not assumed.

## Out of Scope

- A9 (compose-not-strip) — a separate, larger rewrite that replaces all
  fence-stripping wholesale; this ticket's fences are designed to degrade
  gracefully under it (see Decision rationale) but migrating to it is not
  this ticket's job.
- A3 (build-time fence-marker validator) — superseded by A9 per the backlog;
  not resurrected here. If a future incident shows unbalanced origin fences
  slipping through, revisit.
- Extending `bin/agent-governance-context.mjs` to strip origin tags — see
  "Explicitly out of scope" above; follows existing DR-2 single-copy
  precedent.
- Retrofitting the regex approach as a secondary pass for "obviously pure"
  sites — rejected in the Decision section; fencing is applied uniformly to
  all 48 sites for consistency and reviewability.

## Dependencies / Prerequisites

- No external references (Figma/JIRA/URLs) found in the backlog entry or this
  investigation — Resource Audit Gate: no action needed.
- T-GTS-04/05/06 (qa-engineer, test updates) depend on T-GTS-02/03
  (sr-engineer, content markup) landing first, since the exact post-fence
  byte offsets/literals cannot be finalized until the markup exists.
- Per constitution §2, only qa-engineer may create/modify files under `test/`.
  sr-engineer's tasks (T-GTS-01/02/03) touch `prompts/build.ts` and
  `content/*.md` only.
