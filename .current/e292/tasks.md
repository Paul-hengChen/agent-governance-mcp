<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E292-01 [P1] sr: SisterRepo + sisterRepos in WorkspaceConfig, non-fatal loadConfig filter (no schema bump); docs/config.md sisterRepos section; rebuild dist. qa: test/e292-config-sister-repos.test.mjs (AC-E292-1..3) | depends_on: none
- [x] T-E292-02 [P1] sr: 外部依賴 section reader + validateManifest format errors (EXTERNAL_DEPS_* codes), parseManifest untouched; rebuild dist. qa: test/e292-external-deps-validate.test.mjs (AC-E292-4..6) + validate baseline sweep (AC-HC-1) | depends_on: none
- [x] T-E292-03 [P1] sr: handoff --check compares each 外部依賴 sha with the sister branch now; SISTER_REPO_UNKNOWN / SISTER_REPO_NOT_GIT; rebuild dist. qa: test/e292-handoff-sister-sha.test.mjs (AC-E292-7, AC-E292-8) + byte-identity procedure (AC-HC-2) | depends_on: T-E292-01, T-E292-02
- [x] T-E343-01 [P2] sr: export LANE_PROTOCOL_POINTER + replaceLanePointer; render pushes TEMPLATE_POINTER_ABSENT; RenderOptions template test seam; template + provenance comment unchanged; rebuild dist. qa: test/e343-render-pointer-guard.test.mjs (AC-E343-1..3) + AC-HC-3 | depends_on: T-E292-02
- [x] T-E342-01 [P2] sr: docs/config.md ADDENDUM_INVALID bullet (first segment is ..) + run-render-from-primary sentence. qa: test/e342-config-doc-wording.test.mjs (AC-E342-1) | depends_on: T-E292-01
- [x] T-E292-04 [P1] sr: integrator SOP two-layer wording (Stage 3 check 1, Stage 3 Render, Stage 4 opening; E290 knock-on) + sister-repo wording (Status, Take-over step 4, Stage 1 step 6). qa: re-pin e178a AC10, test/e292-integrator-sop.test.mjs (AC-E292-9), AC-HC-4, AC-HC-5 | depends_on: T-E292-03
- [x] T-E344-01 [P2] sr: integrator SOP Stage 4 idle-stop resume sentence (restart lane-status --watch) + Stage 6 Write-the-handoff timing names the bookkeeping edits. qa: re-pin test/e285-integrator-session-handoff.test.mjs (AC-E344-1, AC-E344-2), AC-HC-6, final full suite AC-HC-7 | depends_on: T-E292-04
