<!-- schema_version: 2 -->
# Tasks

## Active

- [x] T-E259-01 [P0] sr-engineer: table-driven refactor per architect blueprint — language-table type + registry, route JS/TS through it unchanged, add .cjs/.mts/.cts and .d.mts/.d.cts exclusion, summary extension list derived from registry (D2, D8) | depends_on: none
- [x] T-E259-02 [P1] sr-engineer: non-nested // and /* */ tables — java (text blocks), c-like (R"delim( )delim"), go (backticks); char/string forms, trailing comments | depends_on: T-E259-01
- [x] T-E259-03 [P1] sr-engineer: nested-comment // tables — rust (r#"…"#, lifetimes), kotlin, swift (#"…"#, triple quotes), csharp (@"…", raw """) | depends_on: T-E259-02
- [x] T-E259-04 [P1] sr-engineer: # tables — python (docstrings as comments, triple quotes elsewhere as code), shell (word-start #), ruby (=begin/=end), shebang | depends_on: T-E259-03
- [x] T-E259-05 [P1] sr-engineer: per-language doc-tag exclusion rules (spec D6) for the block-length count | depends_on: T-E259-04
- [x] T-E259-06 [P2] sr-engineer: docs sync — docs/install.md comment-scan paragraph and docs/config.md comment-length row only (AC27) | depends_on: T-E259-05
- [x] T-E259-07 [P1] qa-engineer: author tests + fixtures for AC1-AC4, AC5 (//), AC6-AC15, AC25; edit e258b AC8 lists and AC11 summary assertion (AC2/AC3) | depends_on: T-E259-03
- [x] T-E259-08 [P1] qa-engineer: author tests + fixtures for AC5 (#), AC16-AC24, AC26 | depends_on: T-E259-05
- [x] T-E259-09 [P1] qa-engineer: verify AC27-AC29, full suite after commit, quote lane-diff agc check output | depends_on: T-E259-06, T-E259-07, T-E259-08
