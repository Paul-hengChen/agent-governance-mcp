## SOP

1. **Auto-routing pre-check**: read `AGC_AUTO_ROUTE` from the shell environment (e.g. `printenv AGC_AUTO_ROUTE`). Value exactly `0` → `auto_mode = off` for this session. Unset or any other value → `auto_mode = on` (default).
2. **Skip state sync for**: Q&A, doc edits, status checks. Go straight to step 4.
3. **Otherwise**: `tw_get_state` → `tw_detect_drift`.
4. **Feature-Scope Gate** (incoming PRD/ticket only; text-only): judge single vs multi-feature. **Multi** → STOP, write `.current/feature-split.md`, surface the recommendation + hint, wait for the human (do NOT route until they confirm + re-invoke per unit). **Single / not a PRD** → continue.
4a. **Cheapest-Compliant-Path Intake**<!-- origin:start --> (v3.85.0, E5)<!-- origin:end --> (incoming backlog ticket / non-trivial request only; Q&A, status checks, and single-file edits skip silently): BEFORE routing, decompose the ticket into phases and classify each phase:
   - **(i) coordinator-direct** — investigation, forensics, diagnosis, doc/bookkeeping, design-decision studies: read-only or no-test-no-verdict work.
   - **(ii) mini-chain** — sr-engineer → code-reviewer → qa-engineer with the backlog row itself as the spec, skipping PM/ARCH; or qa-engineer-only via the single-role judge-dispatch charter (Constitution §3.1) for test-only work.
   - **(iii) full chain** — constitution §4 as-is.
   Propose the cheapest compliant path by default and surface the classification to the human in ONE line (e.g. `intake: phase 1 coordinator-direct (forensics), phase 2 mini-chain — cheapest compliant path`). Hard floor — no classification ever bypasses it: §2 test ownership (only qa-engineer authors tests) and §3.2 builder ≠ judge. Small-batch composition: batch small same-class rows into ONE feature with a single review + QA round.
5. **Apply Complexity Scope Gate** against the request.
   - **No gate triggered** → execute directly → `tw_update_state` (if step 3 was run).
   - **Gate triggered** → dispatch via the Auto-Routing preference order (Task-tool subagent if available, else `tw_switch_role(<role>)`) → follow the SOP exclusively. The server increments the persisted `hop_count` on each accepted role-transition write — do not count hops yourself.
6. **Multi-phase** → chain per constitution §4. Between hops, apply the *Auto-Routing* section above: if `auto_mode = on`, self-hop on each `next_role` field; if `auto_mode = off`, surface the recommendation and wait.

