---
schema_version: 13
active_feature: "e48-docs-skills-delete"
status: "In_Progress"
last_updated: "2026-08-17T08:47:36.538Z"
last_agent: "pm"
prd_path: "/Users/paul.ph.chen/agent-governance-mcp/docs/backlog.md"
scope_decision: "single-feature"
scope_decision_why: "E48 — HUMAN DECISION 2026-08-17 (coordinator's own chat turn): DELETE docs/skills/ entirely, no salvage (option c). Resolves .current/feature-split.md F1, parked awaiting exactly this call since 2026-08-12.\n\nEVIDENCE (coordinator-direct, measured this session): (1) 9 of the 12 files have exactly ONE commit — the creation commit 4c310fb (2026-06-24) — and were never updated across ~50 releases; the 3 that moved were dragged along by unrelated sweeps (E59, E64/E65, E19). Dead on arrival, not a mirror that drifts. (2) ZERO inbound links — README.md, docs/install.md, CONTRIBUTING.md, docs/architecture.md and CLAUDE.md all carry no reference; the tree has no entry point. (3) Not on any prompt path: prompts/build.ts and tools/role.ts compose from content/ only, so deletion has zero agent-behavior impact. (4) The other two options were already falsified — the order-6 measurement killed generate-from-source (no generator, none buildable; docs/skills/coordinator.md has no content/ source at all) and the 2026-08-13 correction killed the stale-quote guard (catches NEITHER headline instance).\n\nSALVAGE CONSIDERED, DECLINED: docs/skills/coordinator.md:240-286, the only orphan mermaid diagram, was read this session and is substantially WRONG rather than merely old — it routes on pending_notes (C9 replaced that with the next_role field at v3.55.0), draws hop>=10 as coordinator-counted (server-tracked hop_count since D2), and omits cut-approval, auto-tier, feature-lease, external-refs, source-credibility, amend-resume, Backlog Intake Loop and Crash-Resume. Moving it to specs/ would launder a falsehood; redrawing it is new work that belongs in content/.\n\nINTAKE = mini-chain (sr -> code-reviewer -> qa; PM/ARCH skipped, the E48 backlog row plus this decision ARE the spec). Auto-tier N/A: cutApprovalAutoTier is {} so conservative defaults apply (maxFiles 2, maxPriority P3) and this cut is 14 files at P2 — over both, halted for approval as designed. Precedent: E44+E49, E64+E65, E66+E67."
external_refs:
  - ref: "docs/backlog.md:171 E48 row — the ticket, incl. part (a) named stale sites and the part (b) three options"
    state: "fetched"
  - ref: ".current/feature-split.md:41-107 — the order-6 measurement that falsified generate-from-source, plus the 2026-08-13 correction that falsified the stale-quote guard"
    state: "fetched"
  - ref: "docs/skills/ — all 12 files enumerated via git ls-files; per-file git log confirming 9 carry only commit 4c310fb (2026-06-24)"
    state: "fetched"
  - ref: "test/release-staging.test.mjs:1283-1299 (E59 tree sweep) + :1301-1354 (9-site enumeration incl. the sites.length counter-guard) — qa-owned"
    state: "fetched"
  - ref: "scripts/check-transitions-sync.mjs:17 — the docs/skills/* contrast citation in a comment, dangling after deletion"
    state: "fetched"
  - ref: "docs/skills/coordinator.md:240-286 — the salvage-candidate flow diagram, read and declined as substantially wrong"
    state: "fetched"
  - ref: "tree-wide grep for docs/skills across *.md/*.ts/*.mjs/*.js/*.json — confirms README/install/CONTRIBUTING/architecture/CLAUDE carry zero references and that every other hit is inert history"
    state: "fetched"
dispatch_pins:
  sr-engineer: "fable"
evidence_schema: 2
qa_round: 0
review_round: 0
visual_round: 0
hop_count: 7
qa_rounds_total: 0
review_rounds_total: 1
visual_rounds_total: 0
---
# Handoff State

## Completed
- (none)

## Pending & Handoff Notes
- INTAKE COMPLETE — nothing in flight. Closes the step-14 (E55) terminal handback dispatch stamped by the v3.102.1 release-engineer at 2026-08-17T07:08:56Z, which reached 82 min unacknowledged and surfaced as a stale_dispatch advisory on every fresh tw_get_state. next_role deliberately OMITTED — the enum has no `human` value, so omitting it IS the escalate-to-human signal (3231bd7 precedent).
- PROVENANCE — the intake ran INLINE in the coordinator's own context; no pm subagent was dispatched, no tw_switch_role called. Stated explicitly because E72 (this feature's own spawn) is open precisely about writes whose agent_id overstates who acted. The pm identity reflects the dispatch being closed, NOT a separate pm context.
- FILED, committed 34e23bd (on origin/main): E73 (order 8g, P2) — agc has no artifact-isolation or feature-lifecycle story. Four constraints, all measured not asserted: per-FEATURE worktree trigger; harvest-before-teardown, teardown only on PASS; backlog + .config.json OUTSIDE the worktree (else the Backlog Intake done-mark dies with it); comment-reference hygiene (37 path citations / 658 ticket ids / 103 section cites over 77 non-test source files). Origin is a live human ADOPTION problem, not a release or review round — first row on the list about adopter ergonomics rather than this repo's drift, so it must be validated in an adopter workspace, not here.
- SHIPPED THIS SESSION: nothing. v3.102.1 (f02ea1e) shipped in the prior session; this one produced exactly one commit (34e23bd) — carried-over E48 close-out state plus the E73 filing.
- RECOMMENDED NEXT: order 8d (E69 + E71) — mini-chain, content/skill-release-engineer.md plus qa-owned pins in test/release-staging.test.mjs. Highest severity open, and the only row whose SHIPPED artifact is already wrong at HEAD: E69's two fence sites mis-render in the real tw_switch_role path, so every release-engineer dispatched today receives them; E71(a) and (b) both re-fired at v3.102.1, (b) gaining a second site. Do NOT split E69's render test from its fix — it reds until the fences move.
- ALSO OPEN: 8e (E70, P3 prose — batch with E61/E62, never alone), 8f (E72, investigate-first, ledger integrity), 8g (E73, design-pass-first). Separately .current/feature-split.md F2 (e56-drtwo-amendment) is still pending — coordinator-direct, ~1 file, runnable any time.
- TREE: clean at 34e23bd, synced with origin/main. Suite not re-run and did not need to be — markdown-only change; all 10 test files mentioning docs/backlog.md cite it in comments with zero content assertions (grep-verified pre-commit).

---
> System Note: Auto-generated by agent-governance-mcp. Do NOT edit manually.
