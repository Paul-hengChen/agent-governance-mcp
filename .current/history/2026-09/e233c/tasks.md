<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E233C-01 [P0] qa-engineer (author context): rewrite id-only test comments in the 60 owned test files to plain words, id as trailing pointer only; comments only; commit with T-E233C-01 in title; no tw_* state write | depends_on: none
- [x] T-E233C-02 [P0] qa-engineer (fresh context, not the author), after code-reviewer APPROVED: run AC1-AC7 (comment-stripped equivalence, file scope, residual-id heuristic, hygiene scan, post-commit full suite under test-lock, coupling check), write evidence and PASS | depends_on: T-E233C-01
