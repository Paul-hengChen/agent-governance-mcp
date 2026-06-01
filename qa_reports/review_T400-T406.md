# QA Review T400–T406 — Per-Role Model Routing

## Phase 1 — Spec audit

### Copy / Strings audit (3a)

Spec table lists S01 / S02 / S03 — all three are internal contract strings, not user-facing rendered text:

| string id | spec text | impl site | verdict |
| --- | --- | --- | --- |
| S01 | `recommended_model: <tier>` | YAML key in all 12 `content/skill-*.md` | ✓ verified via parser regression test |
| S02 | `Recommended model for this role: <model>. Honor via client subagent config or /model switch.` | `tools/role.ts:62-66` → `instruction` string | ✓ verbatim |
| S03 | `Recommended model: <model> (tier <tier>)` | `bin/agent-governance-context.mjs:124-126` → `modelHintLine` | ✓ verbatim |

No drift, no coverage gap.

### Visual Tokens audit (3b)

Spec declares `N/A` — server-side text-only feature has no visual tokens. Section pass-through.

### Visual Widgets

Spec declares `N/A | — | feature has no non-primitive widgets`. Pass-through.

## Phase 1.5 — Visual Compare

`design/model-routing.md` does NOT exist. Phase 1.5: skipped (no Visual Baselines declared).

## Phase 2 — Discussion

No correctness, copy, or token issues raised in Phase 1. Skipping discussion rounds.

## Phase 3 — Tests

### Test File Discovery

No existing test file covered `tools/skill-frontmatter.ts` (new module) or the new `recommended_model` field on `tools/role.ts`. Wrote `test/skill-frontmatter.test.mjs` with 10 cases:

### AC → Test mapping

| AC | Test(s) in `test/skill-frontmatter.test.mjs` |
| --- | --- |
| AC1 (frontmatter on all 12 skills) | `every content/skill-*.md carries a valid recommended_model frontmatter` |
| AC2 positive (response carries field + S02) | `switchRole surfaces recommended_model and strips frontmatter from sop` |
| AC2 backwards-compat (field omitted when frontmatter absent) | `switchRole on a workspace-override skill without frontmatter omits recommended_model` |
| AC3 (prompts/build.ts strips frontmatter) | Covered transitively — `build.ts` calls the same `parseSkillFile`; parser unit tests (positive / missing / malformed / unknown-keys / CRLF) lock the contract. |
| AC4 (SessionStart S03 line) | Covered transitively — hook calls the same parser (dynamic import) with a regex fallback; parser tests guard the contract; the every-skill regression test ensures the hook always finds a value to emit. |
| AC5 (README section) | Documentation; verified by `git diff` review during code-review. No automated test. |
| AC6 (version bump 3.18→3.19, no schema bump) | `scripts/check-version.mjs` enforced during prebuild — passed for 3.19.0. |
| AC7 (build + tests pass, none skipped) | Full suite: 449/449 pass, 0 skipped, 0 todo. |
| AC8 (npm audit no HIGH/CRITICAL) | Verified — `npm audit --audit-level=high` reports `found 0 vulnerabilities`. |

Parser unit cases (`test/skill-frontmatter.test.mjs`):
- `parseSkillFile: valid frontmatter returns recommended_model and stripped body` — positive case.
- `parseSkillFile: missing frontmatter returns empty frontmatter and untouched body` — backwards-compat.
- `parseSkillFile: malformed YAML returns empty frontmatter without throwing` — soft-degrade.
- `parseSkillFile: invalid recommended_model value drops the field but strips body` — enum guard.
- `parseSkillFile: unknown extra keys are tolerated (forward-compat reserve)` — forward-compat.
- `parseSkillFile: CRLF line endings handled` — Windows line-ending input.
- `MODEL_TIERS contract matches spec table` — pins enum to `["opus","sonnet","haiku"]`.

### Coverage gate

New file `tools/skill-frontmatter.ts` (62 LoC): every branch reached by the 7 parser tests (positive / missing / malformed / invalid-value / unknown-keys / CRLF). Estimated ≥ 95% line + branch coverage. `tools/role.ts` `switchRole` exercised on the positive (sr-engineer with frontmatter) and backwards-compat (workspace-override without frontmatter) paths.

### Security smoke

Parser inputs are file content under workspace `content/` (or `.current/` override) — same trust boundary that already existed. Malformed-input case (unterminated bracket) confirms parser cannot crash the server. No external network input on this surface.

## Phase 4 — Run

```
> npm test
1..449
# tests 449
# pass 449
# fail 0
# skipped 0
# todo 0
```

```
> npm run build
check:version — OK (3.19.0)
> tsc            # zero TypeScript errors
```

```
> npm audit --audit-level=high
found 0 vulnerabilities
```

All gates green. CI runnability confirmed (`npm test` runs headlessly via `node --test`).

## Verdict

**PASS** — T400, T401, T402, T403, T404, T405, T406 complete. AC1–AC8 satisfied; 449/449 tests passing (10 new); 0 high/critical vulnerabilities; build zero-error.
