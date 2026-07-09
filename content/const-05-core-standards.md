
## 2. Dev & Tech Standards

- **Strict typing**: Detect language and enforce — TS: no `any`; Python: type hints; Rust: no `unwrap()` in lib code.
- **Test ownership**: ONLY qa-engineer writes test files, with one narrow carve-out — mechanical import/require-path retargets: when another role moves or renames a module a test imports, that role MAY update the affected test file's import/require path(s) to the new location, provided no test logic, assertion, or expected-value text changes (precedent: A10 gate-registry module split, `specs/gate-registry.md` — "assertions unmodified — only import paths may change"). No other exceptions.
- **Build gate**: Every role hands off with ZERO compile/type errors.
- **Test strategy** (qa-engineer): unit for pure logic, integration for I/O boundaries. Mock only external dependencies.
- **Conditional test writing** (qa-engineer): Not every task needs new tests. If existing test files cover the scope, modify them. If NO relevant test file exists, qa-engineer MUST ask the user before creating any — do not assume.
- **Match conventions**: Follow existing codebase style (naming, structure, patterns) before introducing new ones. When in doubt, grep. Conformance > personal taste; if a convention is genuinely harmful, surface it — don't fork silently.

## 3. State Synchronisation

- **Pre-flight read**: Before any state-modifying `tw_*` call (`tw_update_state`, `tw_complete_task`, `tw_rollback_task`, `tw_add_task`, `tw_sync`), you MUST first call `tw_get_state`. Server-enforced; skipping returns `⛔ BLOCKED`. Q&A / doc edits that don't touch state may skip both.
- **Drift check**: After `tw_get_state`, call `tw_detect_drift`. Report any drift to the human before writing.
- **State update**: At the end of any state-modifying execution, call `tw_update_state`. On crash/failure, still call it with the failure summary in `pending_notes`.
- **Task list edits go through tools**: Use `tw_add_task` to append, `tw_complete_task` to mark `[x]`, `tw_rollback_task` to revert. Do NOT hand-edit the task-list file from a role — only PM's initial bootstrapping write is exempt (when no list exists yet). `tw_sync` is the only sanctioned ledger→tasks.md reconcile operation (mirrors handoff.completed_tasks onto tasks.md; never promotes a tasks.md-only [x]).
- **`tw_complete_task` ownership**: ONLY qa-engineer flips the final `[x]` (after Phase 4 PASS). Sr-engineer signals "ready for QA" via `pending_notes` in `tw_update_state`. This prevents double-completion races.
- **Escalation call format**: every escalation state write uses one canonical shape — `tw_update_state(status=<Blocked|FAIL>, agent_id=<role>, pending_notes=["<Role>: <situation> — <detail>", "next_role: <role>"])`. Skill SOPs list their escalation sites as rows of an `## Escalation Routes` table (columns `situation | status | note token | next_role`) and reference rows by situation name instead of restating the call. Note tokens keep their existing owning-site definitions and are NOT redefined here: `visual_fail:` (§3.1 / skill-qa-visual), `review: APPROVED` / `review: CHANGES_REQUESTED` (skill-code-reviewer), `resume_of:` (§3.1 Amend-Resume), `scope_decision_why` (PM scope attestation), `covers:` (batched evidence manifests).
- **Rule grammar (WHEN/DO/ELSE)**: a normative gate rule reads WHEN `<trigger>` → DO `<action>` → ELSE `<escape>` — either as literal prose in that shape, or as one Escalation Routes table row (a row is the same triple collapsed to columns).

