# Feature Split Plan: docs/backlog.md execution order 6 (E39 + E48(b) + E56, + E58 folded in)   (text-only assessment — no design read)

## Assessment

- verdict: **multi-feature (3 units)** — signals fired: separable units with materially different review surfaces; one unit needs a human design decision that cannot be pre-resolved; the batch's own "it is one mechanism" premise was **falsified by measurement** (below).

### Measurement (coordinator-direct, read-only, 2026-08-12)

Order 6's row says *"measure first"*. Measured:

**E39 — worse than the row's "roughly 5 places", and mechanically checkable.**
`ALLOWED_TRANSITIONS` in `tools/transitions.ts` has **21 keys**. The mirror table at
`specs/qa-flow-enforcement-architecture.md:145` has **16 rows**. The 5 missing are exactly
the `code-reviewer:{In_Progress,Blocked,FAIL}` and `design-auditor:{In_Progress,Blocked}`
groups — matching the row's claim. Enumerated precisely against the built source (`dist/tools/transitions.js`), the drift is
**9 sites, not "roughly 5"**: of the mirror's 16 rows, **12 are correct, 4 are wrong**, and
**5 rows are missing entirely**.

- Missing rows: `design-auditor:{In_Progress,Blocked}`, `code-reviewer:{In_Progress,FAIL,Blocked}`.
- Wrong rows: `null:null` (missing both `design-auditor` entries), `researcher:In_Progress`
  (missing `design-auditor,In_Progress`), `pm:In_Progress` (missing `design-auditor,In_Progress`),
  and `sr-engineer:In_Progress`, which names **`(qa-engineer, In_Progress)`** where the source
  says **`(code-reviewer, In_Progress)`** — the most misleading single cell, since it describes
  a chain that has not existed since the code-reviewer role was extracted.

One *mechanism paragraph* in the same section is also stale, and was NOT in the row's account:
the **Amend-Resume** paragraph describes the legacy `pending_notes` `resume_of:` string-grep
mechanism. Verified stale at `tools/transitions.ts:39-44,522-535`: the source uses the
structured `next_resume_of` field and its own comment says it *"Replaces the former
next_pending_notes substring grep"*; the constitution calls the legacy line **inert**.

**Correction to an earlier draft of this file**: it claimed the round-cap paragraph
(`prev_qa_round >= 4`) contradicted the constitution's `qa_round` cap of 3. It does not —
`tools/transitions.ts:365` sets `ROUND_CAP = 4` and compares `>= 4`, and its own comment at
:368 reads *"3 fails then Round 4 lock"*. The two count different things and agree. **Do not
"fix" this paragraph.**

Both sides here are structured data derivable from source, so a `scripts/`-based sync check
(pattern: `scripts/check-version.mjs`) is genuinely implementable for this artifact.

**E48(b) — the "one mechanism" premise is FALSE. `docs/skills/*` are not mirrors.**

| file | docs/skills lines | content/ source lines |
|---|---|---|
| architect.md | 321 | 88 |
| design-auditor.md | 321 | 105 |
| qa-visual.md | 288 | 132 |
| coordinator.md | 286 | **no `content/skill-coordinator.md` exists** |
| sr-engineer.md | 236 | 63 |
| pm.md | 236 | 109 |
| qa-engineer.md | 234 | 113 |
| release-engineer.md | 204 | 163 |
| code-reviewer.md | 187 | 89 |
| coordinator-lite.md | 160 | 52 |
| doc-writer.md | 160 | 36 |
| researcher.md | 153 | 44 |

They are 2–4× their sources — hand-written human-oriented **expansions**, not copies.
**12 of 12** carry mermaid diagrams; only **1 of 11** `content/skill-*.md` files does.
There is **no generator** anywhere (`scripts/`, `package.json`, `bin/` all return zero hits).
`docs/skills/coordinator.md` has no single source file at all — the coordinator SOP is 7
`coord-*.md` fragments composed per `prompts/skill-manifest.ts`.

Consequences for the row's three stated options:
- *generate from `content/` at build time* — **not viable** as written; it would destroy 12
  diagrams and ~2,800 lines of material that has no source to generate from.
- *pin with a sync check, shared with E39* — **not the same mechanism**. You cannot diff 236
  lines against 63. E39's check compares structured data to structured data; nothing of that
  shape exists here.
- *delete and link to `content/`* — still open, but it discards the diagrams. Note E59's code
  review used one of those mermaid flows as a real defect site, so they are load-bearing for
  human readers, not decoration.

A fourth option the row does not list, and the one that actually fits the measured shape:
a **stale-quote guard** — assert that no `docs/skills/*.md` file quotes a string that no
longer exists in its `content/` source. Implementable, keeps the diagrams, and would have
caught both E48's named instances and all 8 of E59's mirror sites.

**E58 folds in free.** Its own row says *"If E39 is picked up first, fold E58 into that cut
rather than shipping a one-edge release."* We are picking up E39, so that condition is met:
E58's edge, its mirror row, and its one sweep line land in the same table re-derive.

**E56 shares nothing.** One dated amendment paragraph in a different spec. The backlog is
explicit that the sync check must NOT be pointed at it — a dated design record is *supposed*
to describe the past.

## Split Table

| order | feature id | scope | figma link | depends_on | key visual widgets | notes / 注意事項 | status |
|---|---|---|---|---|---|---|---|
| 0 | e39-e58-transition-matrix-sync | Re-derive all 21 rows of the `specs/qa-flow-enforcement-architecture.md` matrix from `ALLOWED_TRANSITIONS`; correct the two stale mechanism paragraphs (round cap, Amend-Resume); fold in E58's `pm:Blocked → design-auditor:In_Progress` edge in `tools/transitions.ts` + mirror row + `test/qa-flow.test.mjs` sweep line; add a `scripts/` sync check pinning table⟷source so the next edit cannot silently desync | | none | — | **PASS 2026-08-12** — 3 review rounds (C1/C2 → C4), QA 1704/1704. Not yet released. Crash-resumed mid-chain: an sr context died after applying C1/C2/C3/Q1 without a state write. Spawned E62 (stale `transitions.ts:NNN` citations, 5 sites + N7/N8) | done |
| 1 | e48-docs-skills-policy | Decide what `docs/skills/*` **is** (delete / stale-quote guard / accept-unchecked), then execute that decision incl. E48 part (a): reconcile the named stale sites (`qa-visual.md:69,:168,:189`, `qa-engineer.md:73`, `release-engineer.md:125`, `qa-visual.md:2`'s retired `content/constitution.md` cite) | | F0 (share the check pattern if a guard is chosen) | — | **needs a human design decision before any chain starts — the row's own three options are invalidated or reshaped by the measurement above** | pending |
| 2 | e56-drtwo-amendment | One dated amendment paragraph in `specs/governance-text-load-architecture.md` recording that DR-2's *premise* was falsified by E51 (two production call-sites; `tools/role.ts` `switchRole` is the busier one) while its *decision* still holds (one implementation, relocated to `prompts/text-transforms.ts`). Do NOT edit the historical record in place | | none | — | coordinator-direct, ~1 file, can run at any time incl. alongside F0 | pending |

## How to proceed

Fill blanks → build order 0 first → re-invoke `/teamwork` per row in `order` (or say "do F<n>").
Coordinator flips each row to `done` on PASS; resume skips `done`.
