<!-- chain-only:start -->
### 3.1 Server-enforced chain<!-- origin:start --> (v3.2.0)<!-- origin:end -->

The routing chain is **server-enforced**, not advisory. Invalid
`tw_update_state` writes are rejected before reaching storage. Key rules:

- `status=PASS` and `tw_complete_task` require `agent_id="qa-engineer"`.
- After 3 QA FAILs (Round 4), only `(pm, In_Progress)` is accepted.
- PASS requires evidence: attach `qa_review`, or pre-write `qa_reports/review_<task-id>.md`.
