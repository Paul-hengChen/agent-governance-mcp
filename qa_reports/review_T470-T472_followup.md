# QA Follow-up: v3.23.1 Version Pin Fix + Design Defect Report

**Date:** 2026-06-02
**Engineer:** qa-engineer (sonnet)
**Scope:** Post-release test-green recovery — version pin correction in `test/subagent-templates.test.mjs`

---

## 1. What was fixed

**File:** `/Users/paul.ph.chen/agent-governance-mcp/test/subagent-templates.test.mjs` lines 368–382

**Root cause:** The test `"v3.23.0 AC8: package.json + index.ts both at 3.23.0"` hard-coded the version string `3.23.0` in:
- The test name
- Two inline comments
- `assert.equal(pkg.version, "3.23.0", ...)`
- `assert.match(idx, /name: "agent-governance-mcp", version: "3\.23\.0"/, ...)`

After the drift-archived-task-exclusion bug fix bumped the package to `3.23.1`, these four assertions failed.

**Fix applied:** All four `3.23.0` literals updated to `3.23.1`. The test name and comment were also updated to describe the correct release (drift-archived-task-exclusion PATCH, not watermark-hide-model-tier).

---

## 2. Verification results

| Check | Result |
|---|---|
| `npm run build` | ZERO errors |
| `node scripts/check-version.mjs` | OK (3.23.1) |
| `npm test` (full suite, 498 tests) | 498 pass / 0 fail |

---

## 3. Design defect: hard-coded version pin recurs on every release

### Problem

The test `"vX.Y.Z AC8: ..."` pattern embeds the current version as a string literal in:
1. The test name
2. Assertion messages
3. Two `assert.equal` / `assert.match` values

Every PATCH or MINOR release that bumps `package.json` and `index.ts` will break this test. This has now occurred at least twice (v3.23.0 → v3.23.1).

### Recommendation (do NOT implement this release — record for next SOP improvement)

**Option A (preferred): Dynamic read from package.json**

Replace the hard-coded version string with a dynamic read:

```js
// At top of test file (already has fs/path imports):
const EXPECTED_VERSION = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf-8")
).version;

test(`vCURRENT AC8: package.json + index.ts both at ${EXPECTED_VERSION}`, () => {
  // version is already known from the read above — verify index.ts matches it
  const idx = fs.readFileSync(path.join(REPO_ROOT, "index.ts"), "utf-8");
  const escaped = EXPECTED_VERSION.replace(/\./g, "\\.");
  assert.match(
    idx,
    new RegExp(`name: "agent-governance-mcp", version: "${escaped}"`),
    `index.ts Server() literal must read ${EXPECTED_VERSION}`,
  );
});
```

This test would now verify package.json and index.ts agree with each other, without ever needing a manual update. The `scripts/check-version.mjs` script already does this check; the test would become a thin regression guard confirming the same invariant survives in CI.

**Option B: Collapse into check-version**

Remove the version-pin test entirely and rely solely on `scripts/check-version.mjs` (already run as `pretest` via `prebuild`). A separate test is redundant when the build gate already fails on mismatch.

### Recommendation priority

Option A is preferred because it keeps the test in the test suite (visible in `npm test` output) while eliminating the maintenance burden. Option B is acceptable if the team prefers fewer test files to maintain.

### Action required

- [ ] File as a follow-up task (assign to sr-engineer or pm for next sprint)
- [ ] Update release SOP to note: "after version bump, the AC8 pin test does NOT need manual update if Option A is adopted"

---

## 4. State note

Handoff status remains `PASS` (T470–T472 complete). This fix was a test-file maintenance correction only — no production source changed. No `tw_update_state` call was made (PASS → qa:In_Progress transition is not permitted by the state machine; the existing PASS is the correct terminal state).
