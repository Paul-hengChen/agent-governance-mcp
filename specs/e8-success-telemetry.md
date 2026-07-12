# e8-success-telemetry

## Problem Statement
D3 (`tools/telemetry.ts`, shipped v3.66.0) appends one line to
`.current/telemetry.jsonl` per gate *rejection* — it never records anything
about the features that succeed. Every claim this project makes about
process health ("fine-grained logic tickets ≈ near-100% one-pass; visual
features far lower") is hand-assembled from retrospectives after the fact.
Nothing accumulates, per feature: how many tickets it took, how many
QA/review/visual rework rounds, how many orchestrator hops, whether it
shipped first-pass, or what version it landed in. E5's tiered auto-approval
and E6's rule-retirement cadence both need this as real evidence rather than
anecdote.

## User Stories
- As the PM/coordinator running a retro, I want one machine-readable summary
  record per shipped feature, so that I can compute one-pass rate and
  average rework rounds without re-reading every handoff/qa_reports history
  by hand.
- As the architect designing E5's auto-approval tiers, I want empirical
  round/hop distributions by feature size, so that the "≤2 files, P3, no
  schema" auto-approve threshold is evidence-based, not a guess.
- As the release-engineer, I want the summary emitted automatically at the
  moment a release closes, so that no extra manual step is required to keep
  the record complete.

## Acceptance Criteria
- **AC1** — Given a feature reaches the release-engineer closing write (the
  exact terminal-marker signature `last_agent="release-engineer" ∧
  status="In_Progress" ∧ next_role="pm"` that `gates/feature-lease.ts`
  already recognizes as "feature shipped"), when that write succeeds, then
  exactly one JSON line is appended to `.current/metrics.jsonl` shaped
  `{ts, feature, tickets, qa_rounds, review_rounds, visual_rounds, hops,
  one_pass, released_version}`.
- **AC2** — Given the emit fails for any reason (disk full, permissions,
  malformed state), when the closing write's `tw_update_state` call
  resolves, then the returned `ToolResult` is byte-identical to what it
  would have been without the metrics hook — the emit is best-effort and
  never throws into the caller (same discipline as D3 AC-4).
- **AC3** — Given a feature that never had a QA FAIL, a code-reviewer
  CHANGES_REQUESTED, or a visual-round FAIL, when its record is emitted,
  then `one_pass` is `true` and `qa_rounds`/`review_rounds`/`visual_rounds`
  are all `0`. Given any one of those occurred at least once during the
  feature's lifetime, `one_pass` is `false` — even though the *current*
  `qa_round`/`review_round`/`visual_round` counters have already reset to 0
  by release time (they are cycle counters, not feature totals).
- **AC4** — `tickets` counts the feature's completed tickets by the same
  `<CODE>` derivation release-engineer's SOP step 7a already uses (leading
  alnum token of `active_feature` before its first `-`, uppercased) —
  counting `- [x] T-<CODE>-*` lines in `tasks.md` — so the two conventions
  never drift apart.
- **AC5** — `hops` is read from the existing `hop_count` field (already
  feature-scoped and cumulative — D2/d2-server-brake-accounting — no new
  field needed for this metric).
- **AC6** — `.current/metrics.jsonl` is a SEPARATE file and a SEPARATE
  module (`tools/metrics.ts`) from D3's `.current/telemetry.jsonl` /
  `tools/telemetry.ts` — same AC-7-style stream-separation precedent D2
  already established for `usage.jsonl` vs `telemetry.jsonl`. Disjoint key
  sets, disjoint writers, disjoint lifecycles (always-on gate-rejection
  telemetry vs. once-per-release success summary).
- **AC7** — `released_version` is read from `package.json` on disk at emit
  time (release-engineer's SOP step 4 has already applied the version bump
  in earlier tool calls this same turn, so the file is current by the
  closing write — no new parameter threading required).
- **AC8** — The new cumulative counters (`qa_rounds_total`,
  `review_rounds_total`, `visual_rounds_total` — see Mechanism) are
  feature-scoped exactly like `hop_count`: they persist across QA
  PASS/FAIL cycles and PM re-entries, and reset to `0` ONLY when
  `active_feature` changes. A stale-version handoff/SQLite row (schema <
  v12) migrates in with all three defaulted to `0` (additive, lossless,
  per `docs/schema-versions.md`'s migration constraints).
- **AC9** — `scripts/summarize-metrics.mjs` reads `.current/metrics.jsonl`
  and prints, per feature and in aggregate: one-pass rate, average
  qa/review/visual rounds, and average hops — usable directly in a retro
  without hand-tallying.

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| N/A | — | — | feature introduces no new user-facing copy — `metrics.jsonl` is a machine-readable sidecar, not rendered to any agent/human, mirroring D3's identical Copy/Strings disposition |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Retention/rotation/archival of `metrics.jsonl` (mirrors D3's identical
  out-of-scope disposition for `telemetry.jsonl`) — unbounded growth is an
  accepted future concern, not this feature's.
- Backfilling metrics for features shipped before this lands (E1, E1A, E2,
  etc.) — the record starts from this feature's release forward.
- Any dashboard, UI, or automated retro trigger — E6 (rule-retirement retro
  cadence) owns *running* the retro; this feature only supplies the data
  and a summarizer script.
- Token-cost totals — explicitly named in the original backlog framing but
  already covered by a disjoint stream (D2's `usage.jsonl` / `agent-*.jsonl`
  token telemetry per `content/coord-06-host-token.md`); duplicating it here
  would violate this feature's own AC6 stream-separation principle.

## Dependencies / Prerequisites
- **Depends on D3** (gate-fire telemetry, v3.66.0, done) and **D2**
  (hop_count, v3.68.0, done) — both ship. No blocking prerequisite work.
- **Design decision, recorded per PM delegation** ("your design call, record
  the decision" — assignment brief): emit at the **release-engineer closing
  write**, not at the QA PASS write, even though the round-total values are
  computed continuously starting at the first FAIL. Rationale: the record
  needs `released_version`, which is only known at release time; reusing
  the E1A terminal-marker predicate for the trigger condition means zero new
  gate/condition logic is invented — it's the same "feature has shipped"
  signal the codebase already trusts.
- **Design decision**: 3 new cumulative handoff fields, not a derived
  read of existing `qa_round`/`review_round`/`visual_round` — those reset
  to 0 on every PASS/pm-reentry by design (they gate round caps), so by
  release time they are always 0 and cannot answer "did rework happen at
  any point." A parallel, never-reset-until-feature-change counter (mirror
  of `hop_count`'s existing reset rule) is the minimal correct fix. This
  is a genuine `schema_version` bump (handoff v11→v12) — sized and routed
  accordingly (see ticket cut: routes to architect first, precedent: D2 and
  D5 both routed similarly-shaped schema-bump work through architect).
- **Open item for architect to pin**: whether the 3 new counters need
  SQLite-mode parity. Recommendation: yes — `hop_count`, the closest
  precedent, already has full SQLite parity (`tools/storage-sqlite.ts`
  ALTER TABLE + parse/write), and these three are structurally identical
  increment/reset counters. Architect should confirm or override.
- **Resource Audit**: no external references (URLs, Figma, tickets) appear
  in the backlog section or this assignment — Resource Audit Gate is a
  no-op, `external_refs` omitted.
- Non-design feature: no `design/e8-success-telemetry.md` exists — Scope
  Decision Gate, Visual State-Count Split, and Geometric-Density Split Gate
  are all non-triggering; Visual Structural Assertions section is omitted
  per the Spec Schema's non-design carve-out.
