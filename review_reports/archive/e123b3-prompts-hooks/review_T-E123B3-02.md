# Review — T-E123B3-02

covers: T-E123B3-01, T-E123B3-02

## Round 1 — APPROVED — by code-reviewer

## Summary
- Reviews T-E123B3-01's uncommitted diff (`git diff main -- prompts bin dist`). It touches 3 source files and the rebuilt `dist/prompts/build.*`: `prompts/build.ts`, `bin/agent-governance-context.mjs` and `bin/agent-governance-usage-hook.mjs`.
- In each file, the `handoff.md` path is now built by `resolveCurrentLanePaths(path.resolve(<ws>)).handoffPath`. The two `.mjs` hooks load it dynamically from `SERVER_ROOT/dist/tools/lane-paths.js`.
- Spec: `.current/feature-split.md` row 1.3, tasks.md T-E123B3-01..03, and the frozen interface in `tools/lane-paths.ts`. The interface is unchanged.
- Verdict: APPROVED.

## Correctness
No blocking findings. I checked each AC:
- **AC1**: none of the 4 files quotes a lane filename as a path any more. `grep -nE "handoff\.md|telemetry\.jsonl|metrics\.jsonl|usage\.jsonl|dispatch\.jsonl"` still finds a few hits, but all are comments or user-facing prose:
  - comments at usage-hook:7,101 and agc-init:9,351,352;
  - the S01a/S01b footer text at prompts/build.ts:471,473,480 ("No handoff.md found at ...").
  The prose is not a path. Changing it would break AC6 (the goldens). For QA: a plain grep for "literal = 0" will hit these lines. Read AC1 as "no path-construction literal".
- **AC2**: every site calls `resolveCurrentLanePaths(path.resolve(...))`. See build.ts:448, context hook `resolveHandoffPath()` (around :155-162) and usage hook main (around :151-157).
- **AC3**: the non-lane paths are untouched. These are `.config.json` (usage-hook:137, context:105), the `loadContent` override `.current/<file>` (context:53), the `.current`/`tasks.md` existence checks (build.ts:465-467, context:33-35, usage-hook:128) and `.agc-hook-marker.json`. The diff shows only the handoff lines changing.
- **AC4**: `git diff --exit-code main -- tools/lane-paths.ts content test bin/agc-init.mjs` exits 0. I checked the judgement that agc-init reads no lane file. Its only fs reads are `package.json`, the templates, `.current/.config.json` (upsertHostKey), `tasks.md` and the adapter stamp files. `handoff.md` appears there only in comments. The judgement holds.
- **AC5**: `npm run build` is clean, and rebuilding produced no new dist diff. `npm test` gave 2311 pass / 4 fail. The 4 fails are exactly the deferred set: check-md-tables AC7 (#155), CQ-9 (#156), CALLERS2 (#1306) and CALLERS3 (#1329).
- **AC6**: `git diff --exit-code main -- test/fixtures/compose-golden` exits 0.
- **AC7**: I ran main's hook copies (`git show main:bin/...`) and this diff's copies against the same `AGC_SERVER_ROOT`, in a scratchpad workspace with an absolute path:
  - Context hook stdout is byte-identical, both with a handoff present and with no handoff.
  - The usage hook's `usage.jsonl` record is byte-identical once `ts` is masked (feature, dispatch and usage all match). Both versions exit 0.
  - Fail-closed, context hook: with a fake SERVER_ROOT that has everything except `dist/tools/lane-paths.js`, it prints the misconfigured-hint JSON, exits 0 and writes no `.agc-hook-marker.json`. Copying `lane-paths.js` back restores the full output, so the missing module alone caused the hint.
  - Fail-closed, usage hook: under the same fake root it exits 0 and writes no `usage.jsonl`.
- **AC8**: `npm audit --audit-level=high` exits 0.

On the two questions I was asked to judge:
1. *Does the context hook's import-failure handling change any reachable non-failure output?* No. When the import succeeds, `resolveCurrentLanePaths` always returns a non-empty string: it never throws, and `resolveCurrentLane` swallows its own errors. So `!handoffPath` can only be true on an import or call failure. `handoffPath` is used only for `existsSync`/`readSafe` and never appears in the output. `path.resolve(workspace)` and the old `path.join(workspace, ...)` point at the same file under the same process cwd. The new resolve step runs before `parseSkill` and only reads through fs, so moving it earlier has no side effects. The byte-identical stdout above confirms this.
2. *Does the usage hook's import placement change when a record is written?* No. The import comes after every early return (non-Task tool, missing `.current`, the budget gate), so the conditions for writing a record are unchanged. Before this diff, an import failure (usage-accounting) already produced "no record, exit 0", and a lane-paths failure now ends the same way. The only effect is that `ts` is sampled a few ms later, after one extra dynamic import. That does not affect behaviour.

## Quality
No findings. The comments name E123 F1 L3 and L-SCHEMA-NEW-9 in the same style as the file's existing comments. Renaming the parameter from `readActiveFeature(currentDir)` to `(handoffPath)` is clearer. The dynamic import follows the pattern the hook already uses for `constitution-manifest.js`/`skill-manifest.js`. One non-blocking nit: the usage hook still computes `currentDir`, but that is correct because the `.config.json` read and the existence gate use it, and both are non-lane paths.

## Architecture
The diff uses exactly the frozen S0 interface (`resolveCurrentLanePaths`) and adds no local fallback path. That satisfies both the "never a hard-coded flat path" rule and row 1.3's "the `.mjs` hooks import from `dist/`" requirement. Build.ts imports it statically from `../tools/lane-paths.js`, and dist resolves it because `dist/tools/lane-paths.js` is already shipped. There is no layering violation.

## Security
No findings. There is no new input boundary. The `workspace` values come from the same sources as before (CLAUDE_PROJECT_DIR / payload.cwd / the resolved workspace_path), and the import URL is built from SERVER_ROOT, as the existing imports already are.

## Performance
No findings. There is one extra dynamic ESM import per hook run, plus 2-3 small `statSync`/`readFileSync` calls for `.git`/HEAD in `resolveCurrentLane`. build.ts gains the same few fs reads on each prompt build. None of these is on a hot path.

## Verdict
APPROVED. All of AC1-AC8 hold. Under an absolute workspace the behaviour is byte-identical to main, including both fail-closed paths. The only reds are the ones the human deferred.
