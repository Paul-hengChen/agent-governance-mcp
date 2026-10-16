<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E316-01 [P2] sr-engineer: parseCutSection counts every /^ {0,3}##[ \t]+cut[ \t#]*$/i line toward CUT_SECTION_DUPLICATE; doc-comment names setext/homoglyph limit; rebuild dist (spec D5, AC-E316-1..4; qa test test/e316-cut-heading-variants.test.mjs) | depends_on: none
- [x] T-E283-01 [P1] sr-engineer: closed detection (status text starts with 已結案) + validate-only "## 接手步驟" checks (4 mandatory sub-items, 進行中的背景工作 = 無, no machine-local absolute path); render/check/check --cut untouched; rebuild dist (spec D1–D3, AC-E283-1..12 incl. hard-condition sweeps; qa test test/e283-validate-handoff.test.mjs) | depends_on: T-E316-01
- [x] T-E322-01 [P2] sr-engineer: new `owners <manifest> (--range <a>...<b> [--repo <dir>] | --paths <file|->)` subcommand reporting every lane whose 擁有 / implicit bookkeeping owns a path; exit 0/1/2; generic USAGE byte-identical; route + header in scripts/fanout.mjs; rebuild dist (spec D4, AC-E322-1..9; qa test test/e322-owners.test.mjs) | depends_on: T-E283-01
