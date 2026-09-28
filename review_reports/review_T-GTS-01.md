# Review — T-GTS-01..03 (governance-tag-strip, sr-engineer scope)

Round 1 — APPROVED — by code-reviewer (opus)

Scope: `prompts/build.ts` (T-GTS-01) + provenance fencing across
`content/constitution.md` (T-GTS-02) and 6 `content/skill-*.md` files (T-GTS-03)
+ regenerated `dist/`. Base: uncommitted working tree vs HEAD. Contract:
`specs/governance-tag-strip.md` + `tasks.md` T-GTS-01..03. Test-update tasks
T-GTS-04..08 are qa-engineer scope and out of this review.

## Summary

- **T-GTS-01**: `stripOriginTags()` added as a fourth sibling stripper; wired
  into `buildPromptForRole` FIRST and unconditionally on both raw inputs
  (constitution at build.ts:324, skill body at build.ts:347). Clean match to
  the `stripChainOnly`/`stripRationale`/`stripDesignOnly` shape.
- **T-GTS-02/03**: 42 origin fences across 7 content files (constitution 14,
  design-auditor 11, sr-engineer 8, architect 3, coordinator 3, pm 2,
  qa-engineer 1); `skill-qa-visual.md` untouched. 6 sites deliberately left
  un-fenced to preserve test-pinned raw literals — verified correct.
- Every mixed-content paren keeps its normative half verbatim after strip
  (`(§3.1)`, `(MANDATORY when …)`, `(awareness-only)`, `(Constitution §3.1)`,
  `(extended schema; …)`) — AC2 holds. No dangling parens, double spaces, or
  broken sentences in any stripped output.
- `dist/` regenerated and deterministically in sync (`npm run build` reproduces
  the exact committed 4-file diff, no new churn).
- `npm test`: 11 failures, **all** in `test/context-budget.test.mjs`, **all**
  of the expected re-baseline class (cap/floor re-measure, sentinel-literal,
  raw byte-anchor, pipeline-composition). No functional defect. Headline
  verdict: **APPROVED**.

## Correctness

PASS criterion for this ticket is not "suite green" but "failures confined to
`context-budget.test.mjs`, each of the expected re-baseline class". Verified:

- **stripOriginTags logic** (build.ts:112–117): non-greedy span removal
  `/<!-- origin:start -->[\s\S]*?<!-- origin:end -->/g`; the lazy `*?` between
  two literal anchors cannot catastrophically backtrack (no nested/overlapping
  quantifiers). Idempotent — empirically confirmed
  `stripOriginTags(stripOriginTags(x)) === stripOriginTags(x)` for all 8 files.
  No-op without markers (safety default) confirmed on `skill-qa-visual.md`
  (0 fences, returned unchanged). Correctly **omits** the trailing-`\n?` that
  the block-level siblings consume — origin fences are inline (mid-sentence /
  end-of-heading), so eating a newline would fuse a fenced heading with the
  next line; the whitespace cleanup mirrors `stripRationale` exactly
  (`[ \t]+\n → \n`, then `\n{3,} → \n\n`). This deviation is deliberate,
  documented in the header comment, and correct.
- **First-in-pipeline, unconditional**: applied to `rawConstitution`
  (build.ts:324) before chain/rationale/design-only, and to the parsed skill
  `body` (build.ts:347, frontmatter parsed off first so YAML is never touched).
  No `fullDetail`/lite/design-arm gate — matches AC4.
- **Fence balance**: every file has start-count == end-count (14/14, 3/3, 3/3,
  11/11, 2/2, 1/1, 8/8, 0/0); zero residual `origin:` markers post-strip.
- **Mixed-content survivors** (AC2): confirmed verbatim in stripped output —
  `` `visual_round` (§3.1) tracks pixel-fidelity ``,
  `**Visual Harness** (MANDATORY when …)`,
  `Geometric-density flag (awareness-only)`,
  `Server-enforced at PASS (Constitution §3.1)`,
  `notes\` (extended schema; pre-v3.26 …)`. Provenance-only survivors read
  cleanly: `root cause; pass the structure through`, `**PASS GATE**:`,
  `See Constitution §1 Design-baseline scope: the canonical design`.
- **Nested fences** (sr-engineer.md:261, pm.md:221): origin fences sit fully
  inside rationale blocks; removing them leaves each `<!-- rationale:end -->`
  balanced → the four strippers compose order-independently (no straddle).
- **11 failing assertions — each classified** (all `test/context-budget.test.mjs`):
  1. `skill-sr ≤2210 cap` — fence-byte cap re-measure (T-GTS-06; the 5th cap
     sr flagged PM missed).
  2. `design-arm constitution ≤4304 floor` — cap re-measure (T-GTS-06).
  3. `teamwork bundle ≤7768 floor` — cap re-measure (T-GTS-06).
  4. `DESIGN arm LOADS §3.2 + visual §3.1` — `DESIGN_ONLY_SENTINELS` literal
     lost its fence bytes (T-GTS-04).
  5. `gated spans byte-equal (srcSpan)` — `srcSpan` sliced raw still carries
     fence markup; needs `stripOriginTags(srcSpan)` before compare (T-GTS-05).
  6. `R10 carve-out byte-equal both arms` — raw R10 anchor shifted by inline
     fence bytes (T-GTS-04/05).
  7. `surviving rule byte-identical` — `expectedConstitution` must add
     `stripOriginTags` to its composition (T-GTS-05).
  8. `non-visual contracts survive both arms` — scope-decision/R10 bundle text
     now fence-stripped vs raw literal (T-GTS-04).
  9. `non-design constitution ≤2409 floor` — cap re-measure (T-GTS-06).
  10. `§1 L16/L17+L19 absent/present` — `P2_S1_DESIGN_SENTINELS` literals lost
      fence bytes (T-GTS-04).
  11. `§4 reflow byte-present` — raw byte-anchor shifted by inline fence bytes
      (the `AC-P2-5 s4` anchor sr flagged, same class as R10; T-GTS-04/06).

  None indicate a defect in `stripOriginTags` or prose corruption; all are the
  compile-loud, mechanical re-baseline the spec (§Affected Tests) predicted and
  explicitly assigned to qa. Cross-check: `error-code-contract` 9/9 (AC7),
  `widget-shape-spec` + `qa-visual-skill-split` + `design-auditor-volume-guard`
  32/32 (skip-site pins intact).

## Quality

- Header comment on `stripOriginTags` is thorough and matches the sibling
  documentation convention (idempotence contract, single-copy DR-2 rationale,
  inline-vs-block newline explanation). Two clear inline comments at the wiring
  sites (build.ts:320-323, 345-346).
- Naming (`taggedBody` → `rawBody`) is consistent with the pre-existing
  `frontmatter, body: rawBody` destructure it replaces; no confusion introduced.
- Skip sites are internally consistent with the grep-stability rationale: the 6
  un-fenced provenance tags all coincide with raw literals that T-GTS-04..06 do
  NOT re-baseline (`Visual Widgets exception (v3.14.0)`, volume-gate,
  lazy-load, widget-shape table header). Correct call — fencing them would have
  broadened the test blast radius for no bundle-saving reason.
- **Non-blocking observation**: a few inline version mentions remain un-fenced
  where they are woven into cross-reference phrasing or rationale spans —
  e.g. `Constitution §1 v3.14.0 exception` and `Design-sourced assets v3.28.0.`
  (skill-sr-engineer.md), `v3.14.0 Visual Widgets shape checklist`
  (skill-qa-engineer.md), and `C1` inside a rationale block. Leaving a
  provenance tag un-stripped is not a correctness defect (only removing
  normative text would be), and these sit inside legitimate cross-refs /
  rationale that the other strips already handle. No action required; noted for
  a future completeness pass if desired.

## Architecture

Fits `specs/governance-tag-strip.md` exactly. The Decision section mandated
fencing over regex (heterogeneous tag shapes + mixed-content parens); the
implementation is fencing with the shared non-greedy-regex removal mechanism,
added as the fourth sibling per the "Ordering / Idempotence Specification".
DR-2 single-copy precedent honored — `stripOriginTags` is NOT mirrored into
`bin/agent-governance-context.mjs` (verified absent), consistent with
`stripRationale`/`stripDesignOnly` and the spec's "Explicitly out of scope".
No new data model, schema, or cross-cutting API — matches the recorded
`scope_decision: single-feature`. No architecture spec exists for this feature
(non-design build-time transform); none required.

## Security

No new boundary, input source, secret, or injection vector. `stripOriginTags`
is a pure string transform over trusted repo-local content already loaded by
`loadContent`; it only deletes bytes and collapses whitespace. Removing HTML
comment markers cannot introduce executable content. `npm audit` clean above
the high threshold (per build). No concern.

## Performance

Three linear `String.replace` passes over already-loaded content, run once per
dispatch alongside three identical sibling passes — same complexity class as
the existing pipeline, no added I/O, no loop, no allocation growth. Lazy
quantifier between literal anchors → linear, no backtracking risk. No
regression vs base. Measured saving (for the record): constitution ~176 tok,
skill-design-auditor ~144 tok, skill-sr ~106 tok; the served teamwork bundle
(constitution + skill-coordinator inputs) shrinks ~857 chars (~214 tok) — a
free, permanent per-dispatch reduction consistent with the spec's 0.5–2%
estimate.

## Verdict

**APPROVED** — `stripOriginTags` is a correct, idempotent, order-independent
fourth sibling stripper; all 42 fences are balanced and preserve every
normative clause verbatim; `dist/` is in sync; and the 11 test failures are
without exception the expected re-baseline class confined to
`context-budget.test.mjs`, which is qa-engineer's T-GTS-04..06 to close.
