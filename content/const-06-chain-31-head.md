<!-- chain-only:start -->
### 3.1 Server-enforced chain<!-- origin:start --> (v3.2.0)<!-- origin:end -->

The routing chain is **server-enforced**, not advisory. Invalid
`tw_update_state` writes are rejected before reaching storage. Key rules:

- `status=PASS` and `tw_complete_task` require the chain's judge, `agent_id="code-reviewer"`, on a feature whose PM write set `chain_path: "test-first"` (PM sets this marker on every feature it routes).
- Each code-reviewer rejection counts once in `review_round`, whichever role it routes to; each `(sr-engineer, In_Progress) → (qa-engineer, In_Progress)` return counts toward the `sr_return` cap, past which that return is rejected and only `(pm, In_Progress)` may take the feature.
- PASS requires evidence: attach `qa_review`, or pre-write `qa_reports/review_<task-id>.md`.
