# QA Review — dependency-security-protobufjs (T330 fix + T331 verify)

## Round 1 — PASS — by qa-engineer

## Phase 1 — Review
- **Change**: `package.json` `overrides` pins `protobufjs ^7.5.8` (resolved 7.6.2) + `qs ^6.15.2`; lockfile updated; `tools/rag.ts` untouched.
- **Correctness/security**: independently re-ran `npm audit --audit-level=high` → **0 vulnerabilities** (was 1 crit / 3 high / 1 mod). No secrets, no boundary/injection surface (config-only).
- **3a Copy Audit**: spec *Copy / Strings* = N/A (no user-facing strings). Pass-through.
- **3b Visual Audit**: spec *Visual Tokens* = N/A (non-UI). Pass-through.

## Phase 1.5 — Visual Compare
Skipped (no `design/dependency-security-protobufjs.md`; no `## Visual Baselines`).

## Phase 2 — Discussion
No issues. The code-reviewer flagged AC2 (forced protobufjs 6→7 over onnx-proto's `^6.8.8`) as the load-bearing runtime risk — verified below.

## Phase 3 — Tests
Per the constitution conditional-test rule, no existing test covered a dependency-pin → asked the user; user opted for a **pin-regression test**. Added `test/dependency-overrides.test.mjs`.

Spec-to-Test / AC verification map:

| AC | Verification |
|---|---|
| AC1 (audit 0 high/crit) | `npm audit --audit-level=high` → 0 vulns (independently re-run) + `test/dependency-overrides.test.mjs` asserts the protobufjs≥7.5.8 / qs≥6.15.2 pin floors that clear the advisories |
| AC2 (RAG embedding intact, no rag.ts API change) | Ran real `embedText()` under the forced protobufjs 7.6.2 → **384-dim vector** produced (onnx-proto runtime OK); `git diff tools/rag.ts` = empty |
| AC3 (build + suite green) | `npm run build` clean; `npm test` **417/417** pass |
| AC4 (pin minimal + documented) | overrides floor at the first patched releases (`^7.5.8`, `^6.15.2`), no over-pin; rationale to land in release notes |

Note on AC2 coverage: a real-embedding assertion needs a network model download, so it is NOT added to the headless CI suite — it was verified manually this round; the pin-regression test guards the floor deterministically.

### Security smoke
Override-range parser tested against the actual `package.json` values; floors enforced.

## Phase 4 — Run
- `npm test`: **417/417 pass / 0 fail**, headless, zero interaction.
- Build clean (prebuild tsc + check:version 3.16.2).
- Dependency audit: **0 vulnerabilities** — the v3.16.2 protobufjs waiver is now fully cleared.

## Verdict
**PASS** — npm audit 5→0; protobufjs 6→7 override runtime-verified against the RAG embedding path; qs moderate also cleared; pin-regression test guards against silent reintroduction.
## 2026-05-31T10:45:14.970Z — PASS — by qa-engineer

PASS. npm audit 5→0 vulnerabilities via package.json overrides (protobufjs ^7.5.8→7.6.2, qs ^6.15.2). AC2 runtime-verified: real 384-dim embedding under forced protobufjs 6→7, tools/rag.ts unchanged. 417/417 tests (+3 pin-regression). v3.16.2 protobufjs waiver fully cleared. Evidence: qa_reports/review_T331.md.

