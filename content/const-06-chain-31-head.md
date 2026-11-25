<!-- chain-only:start -->
### 3.1 Server-enforced chain<!-- origin:start --> (v3.2.0)<!-- origin:end -->

The routing chain is **server-enforced**, not advisory. Invalid
`tw_update_state` writes are rejected before reaching storage. Key rules:

- `status=PASS` and `tw_complete_task` require the chain's judge, `agent_id="code-reviewer"`.
- Each code-reviewer rejection counts once in `review_round`, whichever role it routes to; each `(sr-engineer, In_Progress) → (qa-engineer, In_Progress)` return counts toward the `sr_return` cap, past which that return is rejected until the next `(pm, In_Progress)` write resets the count (file mode only).
- PASS requires evidence: attach `qa_review`, or pre-write `qa_reports/review_<task-id>.md`.
