# QA review — v3105-2-corrective-record-integrity

<!-- Auto-appended by tw_update_state(qa_review=...). -->

## 2026-08-31T09:18:29.608Z — PASS — by qa-engineer

Verified against ground truth (not scope_decision_why) — all 5 items hold, PASS.

1. CHANGELOG E101 paragraph: re-derived `git show fd6153f -- templates/agent-adapters/claude.md` and `git show fd6153f -- AGENTS.md .antigravityrules CLAUDE.md`. Every path the corrected paragraph names as changed (templates/agent-adapters/claude.md, AGENTS.md, .antigravityrules) is in fd6153f's diff --stat; codex.md/antigravity.md, which the paragraph says were deliberately untouched, are indeed absent from that diff. The bullet's description of the claude.md diff (dispatch-is-standing-request + Task-mandatory-for-judge-roles + build-roles-still-may-inline) matches the actual diff hunk verbatim in substance.

2. Replaced Notes bullet: grepped content/const-*.md and content/skill-*.md for "host" (case-insensitive) and for "composer bundle"/"21%"/"lean coordinator". Zero relevant hits — the two matches found (skill-design-auditor.md:105 "host pattern" design-detection heuristic, skill-release-engineer.md:203 "host-agnostic" commit-trailer wording) are unrelated to declaring `host` or its cost. The original "already name the cost" claim was false; the replacement ("gains host only on re-run of agc init... never receives the E101 dispatch bullet") is accurate and matches bin/agc-init.mjs's upsert behavior.

3. Order rows 0d/0e: diffed docs/backlog.md against `git show fa3fc80:docs/backlog.md` — restored intake cells for both rows are byte-identical to fa3fc80. Diffed against `git show fd6153f:docs/backlog.md` — the done-mark text in the "why here" column is byte-identical to what fd6153f had wrongly parked in the intake slot, just correctly repositioned. Pipe-count check (no escaped `\|` present, confirmed via grep) gives 5 pipes / 4 columns on both rows, matching the table header and every sibling row (0a-0c, 0f, 0g).

4. E103 + order 0g + E99 amendment: `recommended_model: opus` confirmed at content/skill-release-engineer.md:2; `model: opus` confirmed at templates/claude-code-agents/release-engineer.md:3 (exact line). The false-assertion measurement is the same one re-verified in item 2. The "third recurrence" count is a defensible reading of E88's record (E74's 2026-08-17 filing = 1st, E88's 2026-08-28 "RECURRED" write-time column-miscount = 2nd, this v3.105.1 event = 3rd) — E88 never assigns its own global number, so this isn't contradicted, only interpretive; noting it as a judgment call rather than a hard fact. Order 0g row and E99's appended "SECOND INSTANCE" paragraph both restate only measurements already verified elsewhere in this pass — no new unverified claims.

5. `git diff --stat HEAD` shows only .current/handoff.md, .current/metrics.jsonl, .current/telemetry.jsonl, CHANGELOG.md, docs/backlog.md changed since fd6153f — no source or test file touched. `npm test` = 1796/1796 pass. `agc check` exits 0 (OK, 3.105.1 — all adapters current).

No corrections needed. Cleared to release-engineer for the 3.105.2 cut, including the published v3.105.1 GitHub release-notes fix per scope_decision_why.

