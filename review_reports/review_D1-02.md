# Review — D1-02

covers: D1-01, D1-02

## Summary
- Reviews the uncommitted working-tree diff for `d1-prompt-arg-workspace-fallback`: one production file (`index.ts`, +19 lines) plus rebuilt `dist/`.
- Change adds exported `looksLikePath()` and gates `resolveWorkspacePath()`'s arg-acceptance branch on it — byte-identical to the spec Mechanism section.
- Zero changes in `prompts/build.ts`; zero changes in `test/`. Confirmed against `git diff`.
- C6 footer test suite re-run independently: 16/16 green — no regression.
- Verdict: APPROVED.

## Correctness
No findings.
- `looksLikePath(s) = /[/\\]/.test(s) || s.startsWith(".") || s.startsWith("~")` (`index.ts:54-56`) is character-for-character the spec Mechanism definition (single- vs double-quote is immaterial).
- AC-1 (non-path-shaped arg): the new `&& looksLikePath(args.workspace_path)` conjunct (`index.ts:63-67`) makes prose fall through to the unchanged `CLAUDE_PROJECT_DIR`→`cwd` chain; `resolved` is never assigned the rejected string and it is not logged or surfaced. Satisfied.
- AC-2 (genuine existing-directory arg): path-shaped dir args (absolute/relative-with-separator) contain `/` or start with `.`, so `looksLikePath` is true and `resolved = arg`, `source = "workspace_path arg"` — unchanged. The one bare-single-word-name-that-exists edge is the accepted false-negative the Mechanism explicitly documents as a deliberate simplification (spec lines 88-93); implementation matches that documented precedence, so not a defect.
- AC-3 (path-shaped-but-missing): `looksLikePath` true → branch accepts, `resolved = arg`, `source = "workspace_path arg"`, `managed=false` from the unchanged existence probe → S01a footer fires. Byte-identical to pre-D1. Satisfied.
- AC-5 (absent arg): the leading `typeof … === "string"` guard is untouched; absent arg skips the branch entirely into the env chain. Byte-identical. Satisfied.
- The `else if (process.env.CLAUDE_PROJECT_DIR)` / `else` fallback chain and the downstream `managed` probe are unchanged.

## Quality
No findings. New function is exported with a doc comment explaining the shape-only rationale and the no-existence-check decision; naming (`looksLikePath`) is clear and colocated with `resolveWorkspacePath()` as the spec directs. `dist/index.js` compiled output matches source (`looksLikePath` present, gate wired in).

## Architecture
No findings. Change is confined to one gating condition in one function in `index.ts`, exactly as the spec's scope decision states. `prompts/build.ts` `WorkspaceSource` type and the S01a/S01b/S02 footer branches are reused unchanged — confirmed by empty `git diff -- prompts/build.ts`.

## Security
No findings. No new trust boundary; the heuristic is a pure shape check on an already-string-typed value. The rejected free-text arg is discarded, not forwarded or logged — narrowing (not widening) what is accepted as a path.

## Performance
No findings. Adds one regex test + two `startsWith` calls per resolution — O(1), off any hot path (invoked once per prompt fetch). No algorithmic regression vs base.

## Verdict
APPROVED — AC-1/2/3/5 match the spec Mechanism exactly, `prompts/build.ts` is untouched, no test files were edited, and the C6 footer suite (16/16) passes with no assertion weakened.
