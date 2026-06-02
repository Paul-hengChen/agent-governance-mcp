# Review — T478 (B5-fix: add `transport/` to release staging list)

## Summary

- T478 is the post-review HIGH-finding fix from the prior v3.24.0 review round: `transport/` was omitted from the release-engineer staging enumeration, recreating the exact source/dist divergence B5 was created to prevent.
- Scope is **two `.md` files only**: `content/skill-release-engineer.md` (SOP) and `templates/claude-code-agents/release-engineer.md` (subagent shim). No version bump, no source/test changes — matches the task contract (T478 `depends_on: none`; bump deferred to T481).
- The SOP `transport/` insertion is applied at all three required locations and is byte-consistent with the template shim's single dir list.
- `transport/` is verified to be first-class source, so its inclusion is correct (not a spurious add).
- Headline verdict: **APPROVED**.

## Correctness

T478 changes are documentation-text only; correctness here means the four dir lists are internally consistent and `transport/` legitimately belongs.

`transport/` source status verified independently of the diff:
- `index.ts:13` — `import { createHttpTransport } from "./transport/http.js";` (used at index.ts:1049/1051).
- `tsconfig.json:24` — `include` contains `"transport/**/*.ts"`.
- `dist/transport/http.js` (+ `.d.ts`, `.map`) is git-tracked.

Therefore `transport/` is compiled source whose dist output ships; omitting it from the staging list is precisely the B5 defect. Adding it is correct (AC-B5.6).

All four locations now carry an identical, complete dir list `lib/ tools/ schema/ guards/ prompts/ bin/ transport/ scripts/ content/ templates/ specs/ test/ qa_reports/ review_reports/`:
- `content/skill-release-engineer.md` step 7 `git add` enumeration (a) — present.
- `content/skill-release-engineer.md` pre-commit verify FEATURE_DIRS `{...}` (b) — present, same membership.
- `content/skill-release-engineer.md` Failure-modes "Expected vs unrelated" list (c) — present, same membership.
- `templates/claude-code-agents/release-engineer.md` staging scope hint — present, same membership.

No off-by-one, no missing/duplicate entry, no ordering divergence between the three SOP sites and the template. No version string touched in either file (confirmed by grep).

## Quality

- Insertion preserves the established ordering convention: `transport/`+`scripts/` slotted directly after the existing source dirs (`bin/`) and before the content/docs dirs, matching the order already used in step 7. Consistent across all four sites — no convention drift.
- Wording around the inserted dirs is unchanged; no dead text, no duplication introduced.
- The `git add` line and FEATURE_DIRS `{...}` set use their respective existing delimiters (space vs comma) — formatting is internally consistent with each surrounding block.

## Architecture

- T478 is SOP/template text only — no code, no schema, no `tools/transitions.ts` change. Consistent with spec "Out of Scope" (no schema_version bump, no transitions change).
- Fits the documented fix strategy in the spec Dependencies note ("transport/ post-review fix"): patch the three artefacts (SOP + template) for `transport/` inclusion; the test-side guard (`EXCLUDED_DIRS` removal + `FEATURE_DIRS` add) is explicitly T479 (qa-engineer), and the tsconfig-derivation root-cause fix is explicitly deferred (AC-B5.5 note / MEDIUM finding). T478 stays correctly within its narrow slice.

## Security

- No injection vectors, secrets, or boundary changes — pure governance-doc text edits. No security surface.

## Performance

- No runtime code path touched; no performance implication. No regression.

## Verdict

**APPROVED** — `transport/` (and `scripts/`) added consistently to all three SOP locations and the template staging hint; `transport/` confirmed as tracked compiled source via index.ts import + tsconfig include + tracked dist; no version bump, scope held to the two `.md` files per the T478 contract.

### Note for qa-engineer (next role)
T478 only fixes the SOP/template. The companion test-side work is NOT done and the diff still shows the old state:
- **T479** — `test/release-staging.test.mjs`: add `transport/` to `FEATURE_DIRS` and remove it from `EXCLUDED_DIRS` (AC-B5.4/B5.5/B5.6).
- **T480** — `test/subagent-templates.test.mjs`: escape all semver metachars in the version regex, or use `===` literal compare (AC-B3.4).
- Then run the full suite (expected 499/0) green before T481 (version bump 3.23.1 → 3.24.0, sr-engineer).
