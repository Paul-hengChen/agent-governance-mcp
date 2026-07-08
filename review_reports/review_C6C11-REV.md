# Review: c6-c11-prompt-state-injection

covers: C6-01, C6-02, C11-01

Reviewer: code-reviewer (opus). Base: uncommitted working tree vs HEAD.
Clean-context inputs: the working-tree diff, `specs/c6-c11-prompt-state-injection.md`,
`specs/c6-c11-prompt-state-injection-architecture.md`. Cross-checked against
`prompts/build.ts`, `index.ts`, `tools/registry.ts`, `bin/agent-governance-context.mjs`,
`tools/handoff.ts`, `tools/storage.ts`, and the affected tests.

## Summary
- **C6-01** (fail-loud footer, `prompts/build.ts`): the old single silent `catch {}`/"Fresh project"
  line is replaced by a four-way tree — JSON state / S02 parse-error / S01a not-managed / S01b genuine-fresh.
  All name the resolved path; S01a/S01b also name the resolution source.
- **C6-02** (`resolveWorkspacePath` in `index.ts` + declarative `skillFile` registry in `tools/registry.ts`):
  fallback chain preserved (arg → CLAUDE_PROJECT_DIR → cwd), path never redirected, `managed` is annotation-only.
- **C11-01** (two-layer dedup, `index.ts` + hook marker + `.gitignore`): L1 in-memory Set + L2 120s marker,
  both fail-safe-to-emit; `buildPromptForRole` stays pure (omit is a param).
- **Headline verdict: APPROVED.** `tsc --noEmit` clean; no `any`; no test file or golden fixture touched;
  scope confined to the 5 intended source files (+ expected `dist/`, `tasks.md`, `.current/handoff.md`).
- The one failing test (`teamwork-lite.test.mjs` AC3b) is a **confirmed test-isolation artifact**, not a
  product defect — qa-owned to fix (§2). Detail below.

## Correctness
- **Fail-safe asymmetry (DR-4) — enumerated and proven safe.** `omit = constitutionDeliveredFor.has(ws) || hookMarkerFresh(ws)`
  (`index.ts:143`). omit is `true` ONLY on positive evidence:
  - L1 `has(ws)` — true only after a *prior* prompt fetch in this process added `ws`; first fetch is always `false`
    (`.add` runs after the read). ✓
  - L2 `hookMarkerFresh` — `true` only when the file reads, `JSON.parse` succeeds, the value is a non-null object,
    `ts` is a `number`, AND `Date.now()-ts <= 120_000` (`index.ts:99-113`). Every other branch — absent, unreadable,
    JSON throw, non-object, missing/non-number `ts`, stale — returns `false` via the guard or the `catch`. ✓
  No branch yields `omit` without a concrete "already delivered" signal; the catastrophic direction (false-omission)
  is unreachable without a live in-window marker or a prior same-process fetch. Correct.
- **Parse-error can never render as "fresh" (AC-3).** Footer branch order is `state` → `stateError` → managed probe
  (`build.ts:382-408`). `getActiveStorage().parse` returns `null` on missing file (`handoff.ts:106`) and *throws* on
  malformed YAML (`handoff.ts:121`) or future `schema_version` (`runMigrations`); the `catch` at `build.ts:324-327`
  captures the throw into `stateError`, so a real read/parse error routes to S02 and can never fall through to
  S01a/S01b. Verified against the actual `readAndMigrate` contract. ✓
- **`resolveWorkspacePath` never redirects (DR-1).** `path` is set straight from arg/env/cwd; `managed` is a
  separate boolean (`index.ts:76-85`). Fallback order preserved. Empty-string arg and empty-string env both fall
  through exactly as the old `||` chain did (`&& args.workspace_path` / truthy env check) — behavior-identical. ✓
- **Hook marker written only on successful full emit (C11).** The misconfigured-hint branch `process.exit(0)`s at
  `bin/agent-governance-context.mjs:130`, before the marker write at `:183-190`. `workspace`/`fs`/`path` all in scope;
  `try/catch`; no `mkdir` (a `tasks.md`/`TODO.md`-only workspace with no `.current/` simply fails the write → no
  marker → server re-emits — the documented fail-safe). ✓
- **DR-6 purity.** `buildPromptForRole` composes the constitution afresh each call when `omitConstitution=false`;
  the new footer `fs.existsSync` probes are deterministic given the same disk, and the state-block/footer live after
  the skill separator so they are outside the golden-fixture slice. Repeated same-process `omit=false` calls are
  byte-identical. Golden fixtures confirmed clean by `git status`. ✓

## Quality
- **N1 (cosmetic, acceptable — not a regression).** Per DR-2 the handler now feeds `entry.description` to
  `buildPromptForRole`, so the `GetPromptResult.description` **metadata** field for `design-auditor` and
  `teamwork-lite` changes from the old wrapper strings to the registry strings. This is metadata only — the
  `description` param is never injected into the message text (`build.ts:414` assembles the prompt from
  constitution+skill+modelHint+stateBlock; `description` only sets the return field at `:417`). The prompt TEXT is
  byte-identical for all 11 roles (every wrapper's first arg matches the registry `skillFile`, verified). `ListPrompts`
  output is unchanged, and GetPrompt/ListPrompts descriptions now *agree* — a consistency improvement. Judged acceptable.
- Comments are accurate and load-bearing; the S03 recovery clause (DR-5) is present verbatim.

## Architecture
- Matches the blueprint exactly: S01a/S01b/S02 tree (DR-3), `resolveWorkspacePath {path,source,managed}` with
  never-redirect (DR-1), declarative `skillFile` registry with wrappers left exported for tests (DR-2), L1+L2 dedup
  at the handler with a pure `buildPromptForRole` (DR-4/DR-6), no schema bump, marker gitignored. No deviation.

## Security
- No injection vector: marker is `JSON.parse`d behind full type-narrowing; a hostile/corrupt marker degrades to
  `false` (emit). No secrets, no shell, no unvalidated path concatenation beyond the workspace the caller already
  controls. `unknown` + narrowing throughout `hookMarkerFresh` — no `any`.

## Performance
- Per prompt fetch: one marker `readFileSync` + up to two `existsSync` probes (footer + resolution). Negligible,
  no loops, no regression. L1 `Set` is O(1) and bounded by distinct workspace paths per process (bounded by session).

## Verdict
**APPROVED.** All ACs' server-visible contracts are met; the diff matches the architecture with no deviation;
purity and the fail-safe asymmetry hold under adversarial enumeration.

Notes for qa (not blockers):
- **N2 — AC3b failure is test-isolation, CONFIRMED not a product bug.** `test/context-budget.test.mjs:172` runs the
  hook with `CLAUDE_PROJECT_DIR: ROOT` (the repo root), writing a real L2 marker into the dogfooded repo's own
  `.current/`. `test/teamwork-lite.test.mjs` AC3b (`:104`) then spawns a fresh server and fetches `teamwork-lite`
  for `PROJECT_ROOT` within the 120s window → `hookMarkerFresh` correctly returns `true` → S03 replaces the
  constitution → the `# Constitution v` assertion fails. This is intended AC-7 behavior colliding with a shared
  on-disk marker across test processes (the marker is cross-process *by design* — DR-4). Product code is correct.
  qa owns the fix per §2: isolate context-budget's hook to a temp workspace, and/or clean the marker in AC3b setup,
  and/or assert the S03-or-constitution disjunction. Do NOT loosen — reconcile per AC-10/AC-11.
- **N3 — dogfooding operational note.** `npm test` leaves a 120s marker in this repo's `.current/`; a live
  `/teamwork*` fetch within that window will get S03. Self-heals (120s expiry + S03 recovery clause). Acceptable.
