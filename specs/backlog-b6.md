# Spec: backlog-b6 — Derive release-staging guard from `tsconfig.include`

**Feature ID:** backlog-b6
**Priority:** P2
**Source backlog entry:** docs/backlog.md §B6

---

## Problem Statement

The AC-B5.5 guard in `test/release-staging.test.mjs` detects which top-level directories contain TypeScript source by scanning the repo root for `.ts`/`.mjs` files and subtracting a hand-maintained `EXCLUDED_DIRS` set. This `EXCLUDED_DIRS` set is exactly the drift source that caused `transport/` to slip through in v3.24.0 — it was mistakenly placed in the exclusion set, masking a staging gap. The authoritative list of TS source roots already exists in `tsconfig.json` `include`: `tools`, `guards`, `prompts`, `schema`, `transport`, `lib`. The guard should derive this list from the config file rather than maintaining a parallel hand-curated exclusion list.

---

## User Stories

As a release-engineer agent, I want the staging-coverage guard to derive expected source directories from `tsconfig.json` rather than a hand-maintained exclusion list, so that a newly added source directory cannot silently fall out of release staging.

As a developer adding a new TypeScript source directory, I want the CI guard to fail automatically if I forget to add that directory to the release-engineer SOP staging enumeration, without requiring a manual update to any test-side list.

---

## Acceptance Criteria

### AC-B6.1 — Helper exists and is typed
Given `lib/tsconfig-source-dirs.ts` is compiled,
When it is imported from a Node.js/TypeScript module,
Then it exports a single function `getTsConfigSourceDirs(tsconfigPath: string): string[]` that accepts an absolute path to a `tsconfig.json` file and returns the set of unique top-level directory names derived from the `include` globs (e.g. `["tools", "guards", "prompts", "schema", "transport", "lib"]`).
The function must use no `any` types; glob entries that resolve to individual files (e.g. `"index.ts"`) are silently skipped (only dir-level globs of the form `"<dir>/**/*.ts"` or `"<dir>/*.ts"` produce output).

### AC-B6.2 — Helper is covered by build
Given `tsconfig.json` already includes `lib/**/*.ts`,
When `npm run build` completes,
Then `dist/lib/tsconfig-source-dirs.js` exists and is importable.

### AC-B6.3 — AC-B5.5 guard uses `getTsConfigSourceDirs`, not `EXCLUDED_DIRS`
Given the updated `test/release-staging.test.mjs`,
When the AC-B5.5 test runs,
Then it calls `getTsConfigSourceDirs` (or a synchronous equivalent reading `tsconfig.json`) to obtain the expected source dirs, asserts that each returned dir appears in `FEATURE_DIRS`, and does NOT rely on `EXCLUDED_DIRS` for the guard logic. The `EXCLUDED_DIRS` constant may be removed or reduced to a comment-only remnant — it must not be the primary mechanism for filtering candidate dirs in the AC-B5.5 test.

### AC-B6.4 — Guard fails correctly when a tsconfig dir is absent from FEATURE_DIRS
Given `tsconfig.json` lists a directory `newmod` (hypothetically added),
When the AC-B5.5 test runs against a FEATURE_DIRS that omits `newmod/`,
Then the test reports a failure naming `newmod/` as missing — i.e., the assertion surfaces the gap automatically.
(This AC is verified by code review / reasoning; no live mutation of tsconfig.json required.)

### AC-B6.5 — B6 closed in docs/backlog.md
Given the feature ships,
Then `docs/backlog.md` §B6 carries a `**Status: done**` line (or equivalent closure marker consistent with how other completed items are marked in the file).

### AC-B6.6 — All existing AC1–AC5 / Fixture A–D tests remain green
Given the refactored test file,
When `npm test` runs,
Then all previously passing tests in `test/release-staging.test.mjs` continue to pass.

---

## Copy / Strings

| string id | exact text | source |
|---|---|---|
| S-B6-01 | `"Source directories from tsconfig.json missing from FEATURE_DIRS: ..."` | authored-here — error message in the updated AC-B5.5 assertion; replaces the existing message which named EXCLUDED_DIRS |

No other user-facing strings are introduced or changed.

---

## Visual Tokens

| token id | property | value | source |
|---|---|---|---|
| N/A | — | feature has no visual tokens | authored-here — CLI/test-only change |

---

## Visual Widgets

| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

---

## Out of Scope

- Rewriting any test other than the AC-B5.5 block in `test/release-staging.test.mjs`.
- Changing `FEATURE_DIRS` membership (that list is the staging enumeration, owned separately).
- Supporting tsconfig `extends` chains or path aliases in the helper — MVP only reads the direct `include` array of the given file.
- Changing `content/skill-release-engineer.md` or any non-test governance file.
- Closing any backlog item other than B6.

---

## Dependencies / Prerequisites

- `lib/` directory already exists (`lib/watermark-check.ts` present) and `lib/**/*.ts` is in `tsconfig.json` `include` — no new tsconfig entry required.
- `tsconfig.json` `include` globs (authoritative list at time of spec):
  - `index.ts` (file, skipped by helper)
  - `tools/**/*.ts` → dir `tools`
  - `guards/**/*.ts` → dir `guards`
  - `prompts/**/*.ts` → dir `prompts`
  - `schema/**/*.ts` → dir `schema`
  - `transport/**/*.ts` → dir `transport`
  - `lib/**/*.ts` → dir `lib`
- No external URL or design references.
- Non-design feature — no `design/<feature>.md`, scope gate not applicable.

---

## Task List

- [ ] T-B6-01 [P1] sr-engineer: create `lib/tsconfig-source-dirs.ts` — exports `getTsConfigSourceDirs(tsconfigPath: string): string[]`; typed, no `any`; skips file-level globs; also flip B6 status to done in `docs/backlog.md` | depends_on: none
- [ ] T-B6-02 [P1] qa-engineer: rewrite AC-B5.5 block in `test/release-staging.test.mjs` to import/use `getTsConfigSourceDirs` from `../dist/lib/tsconfig-source-dirs.js`; remove `EXCLUDED_DIRS` as the guard mechanism; assert every tsconfig-include dir appears in FEATURE_DIRS; keep AC1–AC5/Fixture A–D green | depends_on: T-B6-01
