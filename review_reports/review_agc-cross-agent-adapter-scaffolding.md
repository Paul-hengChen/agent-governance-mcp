# Review — agc-cross-agent-adapter-scaffolding (T-TEMPLATES, T-INIT-EXTEND, T-AGC-CHECK)

> Reviewer: code-reviewer subagent (opus) — clean-context adversarial review.
> Method: read the diff + spec + architecture only; re-ran the full smoke test myself;
> did NOT trust the sr-engineer report (a prior feature here had a false PASS from trusting reports).
> Different model than the sr-engineer round is recommended; no same-model-bias concern flagged.

## Summary

- Implements `agc init` adapter scaffolding + new `agc check` subcommand entirely in `bin/agc-init.mjs` (+233/−48) plus three new pointer-only templates under `templates/agent-adapters/`. No server code, no deps, no `dist/` delta.
- All nine ACs verified by independent CLI runs in fresh `/tmp` dirs: adapters created/stamped (AC-2/4), idempotent skip + CLAUDE.md in-place upsert (AC-3), stale→exit 1 (AC-5), current→exit 0 (AC-6), empty-dir silent exit 0 (AC-7), pointer-only (AC-8, programmatic 0-match), subcommand routing + usage (AC-9).
- AC-8 (the whole point): a line-intersection check of every non-comment adapter line against `content/constitution.md` returns **0 verbatim matches** for all three adapters.
- Version resolution is `import.meta.url`→pkgRoot, proven not cwd-poisonable: a target dir seeded with its own `package.json` v9.9.9 still stamps + checks `3.28.0`.
- `npm run build` exit 0 (no dist change), `npm test` 558/558 pass, `scripts/check-version.mjs` OK(3.28.0). §2 test-edit ruling: **stands** (see §Quality). Headline verdict: **APPROVED**.

## Correctness

Re-ran the full smoke (fresh `/tmp` dirs, all cleaned up), pkg=`3.28.0`:

- **AC-2 init/empty** → `Created: .current/handoff.md, .current/.config.json, tasks.md, CLAUDE.md, AGENTS.md, .antigravityrules`; all three adapters present and stamped `3.28.0`.
- **AC-3/CLAUDE upsert** → 2nd init prints `Updated: CLAUDE.md` + `Skipped (already exists): ...AGENTS.md, .antigravityrules`. `BEGIN agc-adapter` count = **1** after two inits (idempotent). With seeded user prose ("Keep me."), block is appended after prose, prose preserved, BEGIN count stays 1; tampering the CLAUDE stamp to `1.0.0` then re-init refreshes it to `3.28.0` in place (markers inclusive replace, `bin/agc-init.mjs:85-91`) with prose intact.
- **AC-5 stale** → after `sed`-tampering `.antigravityrules` stamp to `0.0.0`: `agc check — stale adapter: .antigravityrules (stamped 0.0.0, installed 3.28.0)` on **stderr**, `exit=1`.
- **AC-6 current** → `agc check — OK (3.28.0) — all adapters current` on stdout, `exit=0`.
- **AC-7 empty dir** → check produces zero stdout/stderr, `exit=0`.
- **AC-9 routing** → no subcommand: usage to stderr, `exit=1`; `agc bogus`: `exit=2`; usage lists both `init` and `check`.

Logic checks against the architecture contract:
- `STAMP_RE` (`bin/agc-init.mjs:17`) matches both comment styles; `runCheck` uses `STAMP_RE.exec` first-match-wins (`:203`), robust to user content below the block. Stamp is first non-blank line in all three generated files (verified by `head -1`), satisfying AC-4.
- Missing-stamp path: `m ? m[1] : "(none)"` (`:204`) → `"(none)" !== ver` → stale, matching the architecture's conservative "clobbered stamp = stale" decision. Not separately smoke-exercised but the code path is unambiguous and the tamper-to-`0.0.0` case proves the stale branch + exit 1.
- `writeClaudeBlock` end-marker slice uses `endIdx + CLAUDE_END.length` (`:88`) — correct inclusive replace, no off-by-one; `endIdx > beginIdx` guard (`:85`) prevents a malformed/reversed-marker file from corrupting. Trailing-newline normalization (`:74`) keeps idempotent output stable.
- No race conditions: synchronous fs, single-shot CLI. No shared mutable state.

No correctness defects found.

## Quality

- Single-file in-place dispatch (`switch(process.argv[2])`, `:229-240`) matches architecture Q2; preserves exit semantics (`sub === undefined ? 1 : 2`, `:239`). `runInit`/`runCheck`/`writeClaudeBlock`/`stampTemplate`/`pkgRoot`/`installedVersion` are small, named, single-purpose — readable.
- `ADAPTERS` registry (`:27-31`) is the single source for both write and scan — no duplicated path lists. Stamp template via `.split().join()` (`:64`) replaces *every* placeholder occurrence (not just first) — correct for multi-stamp blocks.
- Templates are byte-identical to the architecture "Exact Template Content". One **intentional, documented divergence** from spec STR-LOADER-CLAUDE: the Claude block's generated-by comment reads `Re-run agc init to refresh this block; edit outside the markers freely.` (architecture line 232) instead of the spec's `Re-run agc init to create`. The architecture is the controlling implementation contract and explicitly justifies this (the Claude block is an *upsert*, not a create). Correct call — not a defect.
- **§2 test-edit ruling — STANDS.** sr-engineer edited one assertion in `test/p0-onboarding-lite-default.test.mjs:136` (`/Usage: agc init/` → `/Usage: agc <command>/` plus two new `\binit\b`/`\bcheck\b` matches). I read the actual diff: it is exactly one logical assertion, the change is *correct* (the new STR_USAGE genuinely no longer contains `Usage: agc init`, so the old assertion would fail the build), and it is *truly minimal* — surrounding idempotency invariants untouched. §2 reserves test authorship for qa-engineer; however this was a forced build-gate fix to a *pre-existing* test invalidated by the new usage string, not new coverage. Ruling (b)-revert would be pure churn (revert just to re-add the identical line). I let it **stand** and **flag for qa-engineer to take ownership** of this assertion when it writes the T-TESTS suite (AC-9 coverage there should subsume it). No other test files touched.

## Architecture

- Matches the blueprint exactly: `pkgRoot()` via `fileURLToPath(import.meta.url)` → `path.resolve(here, "..")` (`:47-50`), mirroring `scripts/check-version.mjs`. `installedVersion()` throws on unreadable pkg (`:54-58`) — fail-loud per contract. Templates read from `path.join(pkgRoot(), "templates/agent-adapters", tplName)` (`:62`), package-relative not cwd.
- Affected-files set is exactly the architecture's list minus `test/agc-adapters.test.mjs` (correctly deferred to qa as T-TESTS). `index.ts`, `tools/*`, `prompts/*`, `content/*`, `guards/*`, `schema/*`, `dist/` all untouched (verified: `git diff --name-only` matches none of those prefixes). No `schema_version` bump — correct, no new persisted shape.
- Out-of-scope items (`agc update`, `--agent`, global configs, Cursor) correctly absent.

## Security

- No injection vectors: no shell exec, no eval, no network. All inputs are local fs paths derived from a fixed registry + cwd.
- No hardcoded secrets. Version read from the agc package's own `package.json` only.
- Boundary: `agc check` reads files but only the three known relative targets under cwd; no traversal from user input. `writeClaudeBlock` writes only `<cwd>/CLAUDE.md`. Stamp regex is anchored to a bounded semver shape (no catastrophic backtracking — linear alternation). No security surface introduced.

## Performance

- Both flows are O(adapters)=O(3) synchronous fs ops on small files — no loops over unbounded input, no nested iteration, no unbatched I/O in a hot path. CLI is single-shot; no listeners/caches to leak. No algorithmic regression vs the prior init (which already did synchronous per-file writes). No performance concern.

## Verdict

**APPROVED** — all 9 ACs verified by independent CLI re-run; AC-8 pointer-only confirmed programmatically (0 verbatim constitution lines); version resolution proven cwd-poison-immune; build + 558/558 tests + check-version all green; scope surgical (CLI + templates only). §2 test-assertion edit **stands** as a minimal correct build-gate fix, flagged for qa to absorb when it writes T-TESTS.

### Note for qa-engineer (next role)
- **T-TESTS still owed** — write `test/agc-adapters.test.mjs` covering AC-2..AC-9 + the AC-8 no-constitution-clause assertion (architecture "Per-task Blueprint → T-TESTS" maps each case). Untracked-file note: AGENTS.md/.antigravityrules also exist at the **repo root** (pre-staged before this task per sr scope note); test in a fresh `mkdtempSync` dir, not the repo.
- **Absorb the §2 edit** — take ownership of the one assertion at `test/p0-onboarding-lite-default.test.mjs:136` (it stands as-is and is correct; just record it under your test ownership / let the new AC-9 usage coverage subsume it).
