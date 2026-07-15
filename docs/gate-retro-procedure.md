# Gate Retro Procedure (D3)

Periodic human-review SOP for retiring dead-weight gates. The server appends
one JSON line to `<workspace>/.current/telemetry.jsonl` for every
`GATE_REGISTRY`-cataloged rejection `tw_update_state` returns (see
`specs/d3-gate-fire-telemetry.md`); this procedure turns that sidecar into a
retirement signal. It is a manual/scripted grep + group-by — no built
analysis tool exists or is planned.

Each line has exactly 5 keys:

```json
{"ts":"2026-07-10T12:00:00.000Z","gate":"orchestrator","error_code":"CUT_APPROVAL_REQUIRED","agent_id":"sr-engineer","feature":"d3-gate-fire-telemetry"}
```

## Procedure

1. **Tail/parse the sidecar.** Read `.current/telemetry.jsonl` (append-only
   JSONL; a rare interleaved line under concurrent writes is an accepted
   cost — skip unparseable lines).

2. **Group by `error_code` and count fires.** Per feature (`feature` field)
   or across a window of features. One-liner:

   ```bash
   jq -r .error_code .current/telemetry.jsonl | sort | uniq -c | sort -rn
   ```

   Per-feature breakdown:

   ```bash
   jq -r '[.error_code, .feature] | @tsv' .current/telemetry.jsonl | sort | uniq -c | sort -rn
   ```

3. **Rank by fire count.** High-fire gates are load-bearing — their
   constitution/skill prose is earning its token cost. Low-fire gates are
   candidates for scrutiny.

4. **Flag zero-fire gates as retirement candidates.** Any `error_code` in
   `GATE_REGISTRY` (`gates/registry.ts`, 22 entries) with **zero fires across
   the last N shipped features** is a retirement candidate.
   **Default N = 5** — adjustable: raise N for gates guarding rare edges
   (e.g. round-cap sentinels fire only on pathological loops), lower it if
   the sidecar spans many features. "Shipped features" = distinct
   `active_feature` values released since the window start (cross-check
   `docs/backlog.md` / `CHANGELOG.md`).

5. **Human review, not auto-delete.** A flag is a *prompt* for a human to
   review whether the gate's corresponding constitution/skill prose still
   earns its token cost (the `gates/registry.ts` doc-file mapping comment
   lists where each code's prose lives). Zero fires can also mean "the gate
   deters perfectly" — judge deterrence value before retiring. Retirement
   itself is an ordinary ticket (constitution/skill edit + gate removal),
   not part of this procedure.

## Caveats

- **Rejection-only counts.** Pass-through (successful) writes are not
  recorded (MVP scope), so counts are raw fire counts, not firing *rates* —
  there is no denominator. Revisit only if retro data shows a rate is needed.
- **Unbounded growth.** No rotation/retention exists for `telemetry.jsonl`;
  truncate manually if it grows large (it is an observability sidecar, never
  authoritative state — safe to delete wholesale).
- **`gate` field values.** `"validateTransition" | "orchestrator"` come from
  `gate(code).producer` in `gates/registry.ts`; `"unknown"` means the emitted
  code was not in the registry at emit time (e.g. a gate added/removed
  mid-window) — investigate rather than count.

## Success-metrics summary

`telemetry.jsonl` is rejection-only; the success side of the retro lives in a
separate sidecar, `.current/metrics.jsonl` — one JSON line per SHIPPED feature
(`tickets`, cumulative qa/review/visual rework rounds, hops, `one_pass`,
`released_version`), appended automatically at the release-engineer closing
write (see `specs/e8-success-telemetry.md` / `tools/metrics.ts`). Summarize it
for the retro with:

```bash
node scripts/summarize-metrics.mjs   # default: .current/metrics.jsonl
```

which prints a per-feature table plus the aggregate one-pass rate and mean
rounds/hops.

## Cadence & retired-rule ledger (E6, instituted 2026-07-13)

- **Cadence:** re-run this retro after every **5 shipped features** or at the
  **first design-armed feature** since the last retro, whichever comes first.
  The release-engineer's DONE ticket for the 5th feature since the last retro
  should carry a "retro due" pending note; the coordinator may run the retro
  directly (analysis-only, no chain — 2026-07-13 precedent).
- **Retro log:** one file per run, `docs/retro-<date>-gate-fire.md`.
  - 2026-07-13 — first run (`docs/retro-2026-07-13-gate-fire.md`): no
    retirements; EXTERNAL_REFS_UNRESOLVED placed on WATCH. Next retro due:
    5 features after v3.82.0 (~v3.87) or first design-armed feature.
  - 2026-07-15 — second run (`docs/retro-2026-07-15-gate-fire.md`): no
    retirements; EXTERNAL_REFS_UNRESOLVED escalated WATCH → formal
    retirement candidate (second consecutive zero-fire, zero lifetime —
    human decision pending); visual-gate family (12 codes) categorized
    unexercised (no design-armed feature in window), not candidates.
    Next retro due: 5 features after v3.87.0 (~v3.92) or first
    design-armed feature.
- **Retired-rule ledger** (auditable removals; empty so far):
  | date | code/prose retired | evidence | removal commit |
  |---|---|---|---|
