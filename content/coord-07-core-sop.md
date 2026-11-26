## SOP

1. **Auto-routing pre-check**: read `AGC_AUTO_ROUTE` from the shell environment (e.g. `printenv AGC_AUTO_ROUTE`). Value exactly `0` → `auto_mode = off` for this session. Unset or any other value → `auto_mode = on` (default).
2. **Skip state sync for**: Q&A, doc edits, status checks. Go straight to step 4.
3. **Otherwise**: `tw_get_state` → `tw_detect_drift`.
4. **Feature-Scope Gate** (incoming PRD/ticket only; text-only): judge single vs multi-feature. **Multi** → STOP, write `.current/feature-split.md`, surface the recommendation + hint, wait for the human (do NOT route until they confirm + re-invoke per unit). **Single / not a PRD** → continue.
4a. **Cheapest-Compliant-Path Intake**<!-- origin:start --> (v3.85.0, E5)<!-- origin:end --> (incoming backlog ticket / non-trivial request only; Q&A, status checks, and single-file edits skip silently): BEFORE routing, decompose the ticket into phases and classify each phase:
   - **(i) coordinator-direct** — investigation, forensics, diagnosis, doc/bookkeeping, design-decision studies: read-only or no-test-no-verdict work.
   - **(ii) mini-chain** — the backlog row itself as the spec, skipping the PM spec and ARCH: open with a pm-stamped write (`agent_id="pm"`, `status=In_Progress`), then qa-engineer → sr-engineer → code-reviewer (the build-entry gates apply to the pm → qa-engineer hop); test-only work takes this mini-chain too. Evidence-only work: code-reviewer alone via the single-role judge-dispatch charter (Constitution §3.1). A ticket that has a ticket file does not take this shortcut: pm writes its spec, and the spec's `Ticket:` line is what the per-scenario check at PASS reads.
   - **(iii) full chain** — constitution §4 as-is.
   Propose the cheapest compliant path by default and surface the classification to the human in ONE line (e.g. `intake: phase 1 coordinator-direct (forensics), phase 2 mini-chain — cheapest compliant path`). Hard floor — no classification ever bypasses it: §2 test ownership (qa-engineer authors the tests; sr-engineer writes a bug ticket's reproduction test only when qa-engineer recorded no new test, and never edits a test qa-engineer wrote) and §3 builder ≠ judge. Small-batch composition: batch small same-class rows into ONE feature with one review round.
5. **Apply Complexity Scope Gate** against the request.
   - **No gate triggered** → execute directly → `tw_update_state` (if step 3 was run).
   - **Gate triggered** → dispatch via the Auto-Routing preference order (subagent-dispatch tool if available, else `tw_switch_role(<role>)`) → follow the SOP exclusively. The server increments the persisted `hop_count` on each accepted role-transition write — do not count hops yourself.
6. **Multi-phase** → chain per constitution §4. Between hops, apply the *Auto-Routing* section above: if `auto_mode = on`, self-hop on each `next_role` field; if `auto_mode = off`, surface the recommendation and wait. In a batch lane nothing waits for the human: see the *Batch-lane stop* Escalation Routes row.

