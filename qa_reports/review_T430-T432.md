# QA Review: T430–T432 (subagent-watermark-reminder)

## Round 1

### Test Results

- **Suite**: `npm test` — **461/461 pass**, 0 fail, 0 skip
- **Build**: `npm run build` — ZERO errors, `scripts/check-version.mjs` confirms 3.21.1
- **Audit**: `npm audit --audit-level=high` — 0 vulnerabilities

### AC Verification

| AC | Description | Verdict | Evidence |
|---|---|---|---|
| AC1 | Every `templates/claude-code-agents/*.md` body contains watermark reminder with literal `name`+`tier` from frontmatter | ✅ PASS | `v3.21.1 AC1` test iterates 12 templates, extracts frontmatter, asserts `raw.includes(expected)` |
| AC2 | `test/subagent-templates.test.mjs` has regression test for AC1 | ✅ PASS | Two new tests: `v3.21.1 AC1` (content match) + `v3.21.1 AC3` (frontmatter integrity) |
| AC3 | Prior AC1–AC6 tests still pass | ✅ PASS | 461/461 — all pre-existing tests green |
| AC4 | `package.json` + `index.ts` both read `3.21.1` | ✅ PASS | `v3.21.1 AC4` test asserts both |

### New Tests Added (T431)

1. `v3.21.1 AC1: every template body contains the watermark reminder with correct name+tier` — iterates EXPECTED_ROLES, extracts frontmatter name+model, asserts literal watermark line present
2. `v3.21.1 AC3: adding watermark line did not mutate any template frontmatter` — verifies --- fences intact, body has ≥ 2 non-empty lines (delegation + watermark)
3. `v3.21.1 AC4: package.json + index.ts both at 3.21.1` — version coherence

### Verdict: **PASS**
