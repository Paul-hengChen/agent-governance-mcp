# Review T400-T405 — Per-Role Model Routing

## Round 1 — APPROVED — by code-reviewer

## Summary

- Frontmatter `recommended_model` added to all 12 `content/skill-*.md` files; tier mapping matches `specs/model-routing.md` table.
- New `tools/skill-frontmatter.ts` provides the single-source-of-truth parser using `js-yaml`; consumed by `tools/role.ts`, `prompts/build.ts`, and `bin/agent-governance-context.mjs`.
- `tw_switch_role` response gains optional `recommended_model` and an S02-augmented `instruction`; `sop` returns the body with frontmatter stripped.
- Prompt builder appends `Recommended model for this role: <model>.` between skill body and handoff block; SessionStart hook emits `Recommended model: <model> (tier <tier>)` after its banner.
- Version: `package.json` + `index.ts` Server literal bumped 3.18.0 → 3.19.0; CHANGELOG 3.19.0 entry added.

## Correctness

- `tools/skill-frontmatter.ts:20` — `FRONTMATTER_RE` handles CRLF line endings via `\r?\n` and is anchored to the file start. Closing-fence non-capture also tolerates trailing-newline-or-EOF — correct.
- `tools/skill-frontmatter.ts:38-43` — malformed YAML triggers a stderr warning and still strips the block from the body. Matches architecture DR "soft-degrade on malformed frontmatter (no throw)". Correct.
- `tools/skill-frontmatter.ts:46-58` — guards against non-object YAML payloads (array, scalar, null) by checking `typeof === "object" && !Array.isArray`. Off-by-one / nullable misses checked — none.
- `tools/role.ts:55-77` — when frontmatter absent, `recommended_model` is **omitted** from the response (not `null`) per AC2 backwards-compat. Verified by `if (frontmatter.recommended_model)` guarding both the S02 instruction tail and the field assignment.
- `prompts/build.ts:260` — `modelHint` is empty string when absent, so the prompt structure for frontmatter-less skills is byte-identical to the previous behavior. Backwards-compat preserved.
- `bin/agent-governance-context.mjs:69-86` — dynamic import resolved via `pathToFileURL(...).href` (avoids Windows path-as-URL bugs); regex fallback only kicks in when dist parser unavailable. Fallback regex uses anchored multiline match `^\s*recommended_model\s*:\s*(opus|sonnet|haiku)\s*$` — safe for the single-key contract we ship; will silently miss an exotic YAML form (quoted value, alias, anchor), but those are non-conventions for our own files.
- `bin/agent-governance-context.mjs:137-139` — `modelHintLine` is conditionally appended via `headerLines.push`, so the unchanged hook output for frontmatter-less skills differs only by absence of a trailing line. AC4 satisfied.

No off-by-one, race condition, or missing edge case found.

## Quality

- Naming consistent (`ModelTier`, `parseSkillFile`, `SwitchRoleResponse`, `modelHint`).
- Zero dead code; no commented-out blocks left behind.
- TS strict typing preserved: `as const` on `MODEL_TIERS`, type guard `isModelTier`, response type `SwitchRoleResponse` explicit. No `any` introduced.
- Single low-severity nit (not blocking): `tools/skill-frontmatter.ts:23` casts to `readonly string[]` to satisfy `.includes()` on a `readonly tuple`. Idiomatic for TS < 5.5; acceptable since the project's `typescript` devDep is `^6.0.3` but the cast keeps the helper self-contained and obvious. No action.
- Conforms to existing project style (`// Coded by @sr-engineer` header, `js-yaml` import shape mirrors `tools/handoff.ts:6`).

## Architecture

- Implementation follows `specs/model-routing-architecture.md` **Affected Files** exactly — no surprise modules touched, no architecture spec contradicted.
- DR-1 (single shared parser) honored: `tools/skill-frontmatter.ts` is the only frontmatter-handling implementation in TS; the `.mjs` hook either delegates to its compiled output or uses an inline regex fallback — both routes drop the YAML block out of the body before injection.
- DR-2 (`js-yaml` reuse) honored: no new dependency added (`package.json:dependencies` unchanged; `js-yaml ^4.1.1` was already present).
- DR-5 (hook dynamic import) honored: `pathToFileURL` + `await import` pattern keeps the hook as plain ESM; the regex fallback is the documented safety net.
- DR-7 (no persisted-state schema bump) honored: `schema/versions.ts` and migration registries untouched; only `content/`, `tools/`, `prompts/`, `bin/`, `README.md`, `CHANGELOG.md`, `package.json`, `index.ts` modified.

## Security

- No hardcoded secrets / API keys introduced.
- No new external input parsing surface. The frontmatter source is server-shipped `content/skill-*.md` (or a workspace-controlled `.current/skill-*.md` override — already a trusted execution surface that today injects arbitrary skill bodies into the prompt; the parser does not widen that boundary).
- `js-yaml.load()` (not `dump`) on bounded, locally-controlled input — no deserialisation gadget risk.
- No injection vectors (SQL, command, XSS, path traversal). `pathToFileURL` neutralises any Windows-path edge cases on the dist import. ✓
- Mirrors sr-engineer security checklist: secrets / input-validation / injection — all clear.

## Performance

- Parser: single regex `match` + single `yaml.load` on a string typically < 200 bytes. O(n) on file size. No hot-path regression.
- `tools/role.ts` switchRole: one extra parse per `tw_switch_role` call; pre-change cost was a single `readFileSync`. New cost dominated by the disk read, not the parse.
- `prompts/build.ts buildPromptForRole`: same — one extra parse per prompt invocation; identical frequency to prior raw read.
- `bin/agent-governance-context.mjs`: one extra dynamic `await import` per session-start hook invocation (sessions are coarse-grained — sub-millisecond cost is negligible).
- No O(n²) loops, no unbatched I/O, no event-listener / cache leak. No measurable regression vs base.

## Verdict

`APPROVED` — implementation matches PRD AC1–AC6 and architecture decision records; build + suite + audit all green; no correctness, quality, security, or performance regression detected. Unit tests for `tools/skill-frontmatter.ts` parser (positive / missing / malformed) and a `tools/role.ts` integration assertion remain for qa-engineer per T406.
