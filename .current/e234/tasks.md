<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E234-01 [P0] sr-engineer: hygiene-scan module core — scan-set enumeration (git ls-files cached+others+exclude-standard; no-git walk with node_modules/.git skip + 10000 cap), 7 shape categories (D2), placeholder-username skip (D3), binary/large/symlink content skip, output formatting with path masking, 50-line cap, summary (D4/D5); dist build | depends_on: none
- [x] T-E234-02 [P0] sr-engineer: hygiene-scan keyword layer — AGC_HYGIENE_KEYWORDS / git-common-dir default resolution + precedence, .current/ refusal, file format, literal case-insensitive ASCII-word-boundary matching, self-exclusion + tracked-source warning, none/unreadable lines (D1) | depends_on: T-E234-01
- [x] T-E234-03 [P0] sr-engineer: wire hygiene scan into bin/agc-init.mjs runCheck() after checkArtifactsDrift via dynamic import of the compiled module; load/throw failure -> one hyg.error line; exit code unchanged in every branch (AC1, AC15) | depends_on: T-E234-02
- [x] T-E234-04 [P1] sr-engineer: docs sync — docs/install.md agc check advisory paragraph + docs/config.md agc check rows only (AC17) | depends_on: T-E234-03
- [x] T-E234-05 [P0] qa-engineer: author test/e234-hygiene-scan.test.mjs covering AC1-AC16 with runtime-built temp repos, synthetic keywords only, hit-shaped literals assembled by concatenation (file must not trip the scan) | depends_on: T-E234-03
