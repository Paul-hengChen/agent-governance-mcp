## SOP

1. **Auto-routing pre-check**: read `AGC_AUTO_ROUTE` from the shell environment (e.g. `printenv AGC_AUTO_ROUTE`). Value exactly `0` → `auto_mode = off` for this session. Unset or any other value → `auto_mode = on` (default).
2. **Skip state sync for**: Q&A, doc edits, status checks. Go straight to step 4.
3. **Otherwise**: `tw_get_state` → `tw_detect_drift`.
4. **Feature-Scope Gate** (incoming PRD/ticket only; text-only): judge single vs multi-feature. **Multi** → STOP, write `.current/feature-split.md`, surface the recommendation + hint, wait for the human (do NOT route until they confirm + re-invoke per unit). **Single / not a PRD** → continue.
5. **Apply Complexity Scope Gate** against the request.
   - **No gate triggered** → execute directly → `tw_update_state` (if step 3 was run).
   - **Gate triggered** → dispatch via the Auto-Routing preference order (Task-tool subagent if available, else `tw_switch_role(<role>)`) → follow the SOP exclusively. The server increments the persisted `hop_count` on each accepted role-transition write — do not count hops yourself.
6. **Multi-phase** → chain per constitution §4. Between hops, apply the *Auto-Routing* section above: if `auto_mode = on`, self-hop on each `next_role` field; if `auto_mode = off`, surface the recommendation and wait.

