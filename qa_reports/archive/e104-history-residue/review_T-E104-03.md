# QA Review — T-E104-03

Feature: `e104-history-residue` (phase 3 of 3 — prevention (c), `agc check` research/ binary advisory).
Reviewed: `bin/agc-init.mjs` diff (code-reviewer APPROVED, Round 2 — `review_reports/review_T-E104-03.md`). No `specs/e104-*.md` or `design/e104-*.md` exists; the `docs/backlog.md` E104 row is the contract, per code-reviewer's own framing.

## Phase 0.5 — Expected-Red Diff

Skipped (no `qa_reports/expected-red_e104-history-residue.txt` manifest declared).

## Phase 1 — Review

Re-verified independently (not trusting the coordinator's or code-reviewer's assertions blindly, since the SOP requires my own read):

- `bin/agc-init.mjs`: `checkResearchBinaries(cwd)` uses `execFileSync("git", ["ls-files", "-z", "--", "research"], ...)`, splits on `"\0"`, no `.trim()`, filters via `RESEARCH_BINARY_RE` (`/\.(png|jpe?g|gif|pdf|fig|sketch|xd|webp|mp4|zip)$/i`), warns per hit on stderr, never touches the exit code. Confirmed by reading the source directly (lines ~391-436).
- `npm run build`: exit 0, `check:version` OK (3.106.0), `check:transitions-sync` OK.
- `npm test`: **1815/1815 pass, 0 fail.**
- `npm audit --audit-level=high`: exit 0, 0 HIGH (6 moderate/low, pre-existing, unrelated — `@hono/node-server`, `body-parser`, `esbuild`, `hono`, `protobufjs`, `qs`).
- Scope: `git diff --stat -- docs/backlog.md .gitignore CONTRIBUTING.md` empty. Only `bin/agc-init.mjs` (sr-engineer's reviewed diff), `.current/handoff.md` + `.current/telemetry.jsonl` (bookkeeping), and `test/agc-adapters.test.mjs` (mine) are touched.

**Copy Audit Gate / Visual Audit Gate (3a/3b):** N/A — no spec file exists with Copy/Strings or Visual Tokens H2s; the backlog row is the contract and carries neither.

## Phase 1.5 — Visual Compare

Skipped — no `design/e104-*.md` exists, no Visual Baselines declared.

## Phase 2 — Discussion

None needed. Code review is APPROVED at Round 2 with no open items assigned to sr-engineer; the sole carried-forward item (the test-authorship ratchet) is QA's own scope per Constitution §2, addressed in Phase 3 below.

## Phase 3 — Tests

**Test-file placement**: per dispatch brief, `test/agc-adapters.test.mjs` — the existing file. No new test file created; this is the file that already covers `bin/agc-init.mjs`'s adapter/check surface.

### AC → Test map

The code-reviewer's carried-forward note (Round 1 and Round 2, both rounds of `review_reports/review_T-E104-03.md`) is the operative acceptance contract for this phase: the CLI is advisory-only, so nothing enforces E104 prevention (c) except the qa-owned pin, and that pin needs BOTH halves.

| AC (from code-reviewer's carried-forward note) | Test |
|---|---|
| (i) behavioural assertion on a fixture repo, MUST include a non-ASCII filename (the exact case Round 1's non-`-z` `git ls-files` silently missed under `core.quotePath=true`) | `E104(i): agc check warns on tracked binaries under research/, INCLUDING a non-ASCII (CJK) filename, and stays silent on a text decoy and on a nested out-of-pathspec binary` |
| (ii) standing assertion that THIS repo has zero tracked binaries under `research/` (the day-one-green ratchet `docs/backlog.md` promises), implemented via `-z` + NUL split — NOT a naive `git ls-files` + `split("\n")` re-implementation, which would reintroduce the exact blind spot (i) exists to catch | `E104(ii): this repo has zero tracked binaries under research/ (the day-one-green ratchet), verified via -z + NUL split so the assertion itself cannot inherit the core.quotePath blind spot` |

### Test design notes

- **E104(i)** drives the real CLI (`spawnSync(node, [bin/agc-init.mjs, "check"], {cwd})`) against a synthetic git fixture with: an ASCII-named tracked binary (`research/assets/leak.png`), a CJK-named tracked binary (`research/assets/螢幕截圖.png`), a tracked text decoy (`research/notes.md`), and a binary nested outside the pathspec (`sub/research/deep.png`). Asserts: both binaries warn, the decoy and the nested file stay silent, exit code is 0 throughout (advisory, never a hard fail).
  - **Regression-guard verification performed (not merely asserted):** I patched a scratch copy of `bin/agc-init.mjs` back to the pre-fix Round-1 shape (`execSync("git ls-files -- research")` + `.split("\n").map(trim)`, no `-z`) and ran it against the identical fixture. Result: it warned on `leak.png` but produced **no warning at all** for `螢幕截圖.png` before erroring on an unrelated path issue in the scratch copy — confirming this test would have failed the code-reviewer's original Round 1 defect had it existed then, i.e. it is a real regression guard, not a vacuous pass. Scratch files deleted after.
- **E104(ii)** does NOT call `checkResearchBinaries()` or `agc check` at all — it independently lists `research/` via `git ls-files -z -- research` against `PROJECT_ROOT` (this repo), splits on `"\0"`, and filters against `RESEARCH_BINARY_RE`. The regex is reconstructed at test time by extracting the literal `const RESEARCH_BINARY_RE = ...;` text out of `bin/agc-init.mjs` via `new Function(...)` — never retyped — so the test's allowlist can never silently drift from the shipped implementation's allowlist. This keeps the ratchet independent of the CLI's own advisory logic (a future regression in `checkResearchBinaries()` itself would not blind this specific assertion) while still avoiding the naive-split blind spot the code-reviewer flagged, per their explicit instruction.
- Both tests pass as of this write. Ran in isolation (`node --test --test-name-pattern="E104" test/agc-adapters.test.mjs`) — 2/2 pass — and as part of the full 1815/1815 suite.

**Coverage Gate**: `checkResearchBinaries()` is a small (~35 line) leaf function; both branches (git-listing succeeds / git-listing throws) and all four fixture classes (ASCII binary, non-ASCII binary, text decoy, out-of-pathspec binary) are exercised. Tooling doesn't measure per-function coverage in this repo; noting explicitly per SOP.

**Security Smoke**: boundary/edge coverage is inherited from the code-reviewer's own verified matrix (non-git dir, zero-commit repo, git absent from PATH — all silent/exit 0) and re-confirmed independently in Phase 1 above via the full suite; no new attack surface is introduced by the test additions themselves (fixture-only, temp-dir-scoped, no shell interpolation).

## Phase 3.5 — AC Execution

Skipped (no `proof:`-annotated ACs — no spec file exists for this feature).

## Phase 4 — Run

- Project build: **0 errors.**
- CI runnability: `npm test` runs headlessly, zero human interaction, deterministic (temp-dir-scoped fixtures, no network).
- Full regression: **1815/1815 pass, 0 fail.**
- `npm audit --audit-level=high`: exit 0, 0 HIGH.

**Verdict: PASS.**

Task completed: T-E104-03 (added to `tasks.md` at PASS time — this mini-chain, tracked only via `docs/backlog.md` + handoff/review-report state through PM/architect/sr-engineer/code-reviewer, had no prior `tasks.md` ledger entry for any of its three phases; QA adds one now so `tw_complete_task` has a checkbox line to flip, matching this repo's own "Task list edits go through tools" convention rather than hand-editing the file).
## 2026-09-14T07:06:18.130Z — PASS — by qa-engineer

PASS. E104 phase 3 of 3 (prevention (c)) closed. Both ratchet halves landed in test/agc-adapters.test.mjs: E104(i) fixture-driven behavioural test on the real CLI including the CJK filename that broke Round 1 (verified as a real regression guard by patching a scratch copy back to the pre-fix naive-split shape and confirming it silently misses the CJK file); E104(ii) standing zero-tracked-binaries ratchet against this repo's own research/ tree, via -z + NUL split, regex reconstructed from bin/agc-init.mjs source (never retyped) so it can't drift from the shipped allowlist. npm run build exit 0; npm test 1815/1815 pass 0 fail; npm audit --audit-level=high exit 0 (0 HIGH, 6 pre-existing moderate/low unrelated). Scope clean: docs/backlog.md/.gitignore/CONTRIBUTING.md diff-empty. No specs/e104-*.md or design/e104-*.md exists (backlog row is the contract) — Copy/Visual/AC-Execution/Visual-Compare phases all N/A, logged as such in qa_reports/review_T-E104-03.md. tasks.md had no prior ledger entry for any of E104's three phases; added T-E104-03 via tw_add_task before completing it, per this repo's "task list edits go through tools" convention.

