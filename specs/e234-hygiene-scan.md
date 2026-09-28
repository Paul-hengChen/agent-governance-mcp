# e234-hygiene-scan

## Problem Statement
The constitution's *Information hygiene* rule (§6, `content/const-15-core-tail.md`) bans five classes of detail from every durable output: an employer-internal URL or work-item link, a third-party client/project codename, a design-tool file key, a credential, and an absolute local path/username (the E240 ruling adds adopter project directory names and personal config directories named after a person). Nothing mechanical catches a new instance once one is written. `agc check` already runs four advisory checks that warn without changing the exit code; it gets a fifth, an information-hygiene scan. The scan has two layers: built-in generic **shape** patterns that name nothing concrete, and a **keyword** list read only from a local, untracked source, so that no concrete name ever has to be written into a tracked file.

## User Stories
- As a maintainer about to commit, I want `agc check` to tell me which file and line hold a banned class of detail, so that I can describe it by class before it reaches a shared branch.
- As a maintainer, I want my list of sensitive names (people, company, client codenames, adopter names) to live outside the repo, so that the scan never becomes a leak itself.
- As a maintainer of a repo whose docs use placeholder usernames (for example a home path with a `me` segment), I want those skipped and counted rather than listed, so that the output stays readable.
- As a CI user, I want `agc check`'s exit code to stay the same whatever the scan finds, so that an advisory never fails a build.

## Decisions (PM, binding on architect unless flagged "architect may refine")

### D1 — Keyword source
- **Env var**: `AGC_HYGIENE_KEYWORDS`, whose value is a path to the keyword file. An empty value is treated as unset.
- **Default file**: `agc-hygiene-keywords` (no extension), directly under the directory `git rev-parse --git-common-dir` prints for the workspace. The default is resolved against the workspace, so every linked worktree of a repo shares one file.
- **Precedence**: a non-empty env var always wins. The default file is used only when the env var is unset or empty. In a workspace with no git repo, only the env var is consulted.
- **Never under `.current/`**: the default path cannot be there by construction. If the env var points at a path under the workspace's `.current/`, the keyword layer refuses to load it (Copy `hyg.kw.refused`) and only the shape layer runs.
- **Format**: UTF-8 plain text with one keyword per line. Surrounding whitespace is trimmed. Blank lines are ignored, and lines whose first non-whitespace character is `#` are comments. There are no inline comments, because `#` may be part of a keyword. Each keyword is a literal string, never a regex. Keywords shorter than 2 characters after trimming are ignored.
- **Matching**: case-insensitive. A keyword matches only when neither side touches an ASCII word character (`[A-Za-z0-9_]`), so a keyword `zorblax` matches `zorblax`, `Zorblax-app` and `-zorblax-`, but not `zorblaxing` or `zorblax_x`. Keywords with non-ASCII characters, such as CJK names, follow the same rule, so they match anywhere they are not glued to ASCII word characters.
- **Unreadable source**: if the chosen source does not exist or cannot be read, the keyword layer is skipped with one line (`hyg.kw.none` when no source was configured and the default file is absent, `hyg.kw.unreadable` when the env var names a path that cannot be read). Neither line echoes the path.
- **Self-exclusion**: the keyword file itself is never content-scanned, even when the env var points inside the workspace. If the keyword file is tracked by git, print `hyg.kw.tracked` once.

### D2 — Categories (the `<category>` token in output)
| category | layer | what it covers (generic shape; no concrete names) |
|---|---|---|
| `home-path` | shape | an absolute home-directory path: macOS `/Users/<seg>`, Linux `/home/<seg>`, Windows `<drive>:\Users\<seg>` or `<drive>:/Users/<seg>` |
| `encoded-home-path` | shape | a hyphen-encoded home path as written by tools that flatten a path into one directory name: `-Users-<seg>-` or `-home-<seg>-`, including a leading drive form such as `C--Users-<seg>-`. The hyphen before `Users`/`home` must be at the start of the text or follow a non-alphanumeric character |
| `temp-path` | shape | a per-user or system temp directory: the macOS per-user temp root (the `folders` directory under `/var`, with or without a leading `/private`), the `tmp` directory under `/private`, and the Windows per-user `Temp` directory under `AppData` then `Local` (either slash). A hit requires at least one further path segment below the root. **Not flagged**: the bare `/tmp/` root (ubiquitous in docs and identity-free), and the bare macOS private temp root, meaning the `tmp` directory under `/private` with no further segment below it. Only a path that continues past the root with a further segment is flagged. Some tracked tests outside this lane mention the bare root and must stay silent |
| `design-file-key` | shape | a design-tool file URL that carries a file key: host `figma.com` (any subdomain), path `/file/`, `/design/`, `/proto/`, `/board/`, `/slides/` or `/make/`, followed by an alphanumeric key of 10 or more characters. Template tokens such as `<fileKey>` do not match |
| `credential` | shape | vendor-prefixed secret shapes: a PEM private-key header line, an AWS-style access-key id (the documented 4-letter prefix + 16 uppercase alphanumerics), GitHub token prefixes (`ghp_`/`gho_`/`ghu_`/`ghs_`/`ghr_` + 36 or more alphanumerics, and the fine-grained `github_pat` prefix), Slack `xox?-` tokens, and Anthropic-style keys with the `sk-ant` prefix. No generic `password = "…"` heuristic |
| `work-item-link` | shape | a hosted tracker's work-item or org link: any URL on the Azure DevOps host (`dev.azure.com`) or a `visualstudio.com` org subdomain, and an Atlassian-cloud (`atlassian.net`) issue-browse link with an issue key |
| `internal-host` | shape | an http(s) URL whose host ends in `.internal`, `.corp`, `.intranet` or `.lan` |
| `keyword` | keyword | any keyword from the D1 source |

The architect may refine the exact regexes. The coverage in this table is binding, and every pattern must stay generic, with no concrete name inside.

### D3 — Placeholder usernames (home-path false positives)
A `home-path` or `encoded-home-path` hit is **not listed** when its username segment (`<seg>`, compared case-insensitively) is a placeholder. It is counted instead, and the count goes into one `hyg.skipped` line. A segment is a placeholder when it is:
- on the built-in list: `me`, `user`, `username`, `you`, `yourname`, `your-name`, `your_name`, `name`, `someone`, `somebody`, `example`, `demo`, `test`, `foo`, `bar`, `alice`, `bob`, `jdoe`, `john`, `jane`, `johndoe`, `janedoe`, `dev`, `developer`, `admin`, `runner`, `ubuntu`, `root`, `node`, `vscode`, `shared`, `linuxbrew`, `x`, `xxx`; or
- a template token: it starts with `<`, `{`, `[`, `$` or `%`, or it consists only of the characters `.`, `…`, `*`, `_`, `x` or `X`.

This skip applies only to the two home-path categories. There are no inline suppression markers.

### D4 — Scan set
- **In a git workspace**: the paths git reports for the workspace directory (the `cwd` `agc check` runs in, as with `checkResearchBinaries`), namely tracked files plus untracked files that are not ignored (`git ls-files -z --cached --others --exclude-standard`, NUL-split). A tracked path that is missing from disk is skipped.
- **In a workspace with no git repo**: a recursive walk of `cwd`. The walk skips directories named `.git` and `node_modules`, never follows symlinks, and stops after 10,000 files with one `hyg.walk.capped` line.
- **File names**: every path in the scan set is checked against both layers, using its workspace-relative path.
- **File contents**: checked only for regular files (not symlinks) of 1 MiB or less that have no NUL byte in their first 8 KiB. Other files are skipped silently, though their names are still checked.

### D5 — Output
- Every line goes to **stderr** with the prefix `agc check — hygiene`, matching the other advisories.
- There is one line per distinct (file, line, category). A file-name hit is its own line.
- **The matched text is never echoed.** Any path that is printed is first masked: every span of it that matches either layer is replaced with `***`. Without this, printing a file name could reveal a keyword.
- **Cap**: at most 50 hit lines are listed, then one `hyg.more` line.
- **Summary**: when there is at least one listed hit, one `hyg.summary` line follows the list.
- **Silence**: with zero hits and zero skips, the scan prints nothing except `hyg.kw.none` or `hyg.kw.unreadable` when applicable.
- **Errors**: any unexpected error inside the scan is caught, one `hyg.error` line is printed, and `agc check` carries on.
- Order: the scan runs in `runCheck()` right after `checkArtifactsDrift(cwd)` and before the adapter-stamp check. It **never** changes the exit code in any branch.

### D6 — Module shape (architect decides; PM expectation)
Scan logic lives in a new TypeScript module (working name `tools/hygiene-scan.ts`, compiled to `dist/tools/`). `bin/agc-init.mjs` loads it with a dynamic `import()` of the compiled file, following the existing `loadLanePaths` pattern. If the module cannot be loaded, the result is one `hyg.error` line and the exit code does not change. The architect makes the final call on the file name, the exported function signatures, and how the pure matchers are separated from the git/fs I/O so that they can be unit-tested.

## Acceptance Criteria
All proofs refer to `test/e234-hygiene-scan.test.mjs` (qa-authored). Tests build every hit-bearing input at runtime inside temp git repos. **No tracked file, including the test file itself, may contain a literal string that trips the scan.** Hit-shaped strings are assembled by concatenation, and keywords are synthetic nonsense words. **Hermetic env**: every AC1–AC16 case deletes `AGC_HYGIENE_KEYWORDS` from the child process env unless that case sets it on purpose. A case that must have no default keyword file uses its own temp git dir, never a git common dir shared with the checkout running the suite.

- **AC1 (exit-code invariance)** — Given a workspace with adapters that are current, when `agc check` runs with a temp repo that contains hits in every category, then its exit code equals the exit code of the same run with the hits removed (0). The same holds for the stale-adapter case (1).
  proof: `node --test --test-name-pattern "AC1" test/e234-hygiene-scan.test.mjs`
- **AC2 (shape coverage)** — Given one runtime-built file per shape category in D2, when `agc check` runs, then stderr contains a hit line for each of the seven shape categories with the correct 1-based line number.
  proof: `node --test --test-name-pattern "AC2" test/e234-hygiene-scan.test.mjs`
- **AC3 (no echo)** — Given hits in every category, including a keyword and a non-placeholder username segment, when `agc check` runs, then neither stderr nor stdout contains any matched substring (the keyword, the username segment, the file key, or the credential body).
  proof: `node --test --test-name-pattern "AC3" test/e234-hygiene-scan.test.mjs`
- **AC4 (file-name hits, masked)** — Given an untracked, non-ignored file whose name contains a synthetic keyword, when `agc check` runs, then a file-name hit line of category `keyword` is printed, the path in it shows `***` in place of the keyword, and the keyword does not appear anywhere in the output.
  proof: `node --test --test-name-pattern "AC4" test/e234-hygiene-scan.test.mjs`
- **AC5 (scan set)** — Given a tracked hit file, an untracked non-ignored hit file, and a gitignored hit file, when `agc check` runs, then the first two are reported and the ignored one is not.
  proof: `node --test --test-name-pattern "AC5" test/e234-hygiene-scan.test.mjs`
- **AC6 (keyword source precedence)** — Given a keyword file at the default git-common-dir location with keyword A and a second file named by `AGC_HYGIENE_KEYWORDS` with keyword B, when `agc check` runs, then only B is matched. With the env var unset, only A is matched. With the env var set to the empty string, only A is matched. Run from a linked worktree, the default file of the shared common dir is used.
  proof: `node --test --test-name-pattern "AC6" test/e234-hygiene-scan.test.mjs`
- **AC7 (no keyword source)** — Given no env var and no default file, when `agc check` runs, then shape hits are still reported and exactly one `hyg.kw.none` line is printed. Given the env var names a missing path, exactly one `hyg.kw.unreadable` line is printed and the path does not appear in it.
  proof: `node --test --test-name-pattern "AC7" test/e234-hygiene-scan.test.mjs`
- **AC8 (never under `.current/`)** — Given `AGC_HYGIENE_KEYWORDS` pointing at a file under the workspace's `.current/`, when `agc check` runs, then one `hyg.kw.refused` line is printed and no `keyword` hit is reported.
  proof: `node --test --test-name-pattern "AC8" test/e234-hygiene-scan.test.mjs`
- **AC9 (keyword file format + word boundaries)** — Given a keyword file with a comment line, a blank line, surrounding whitespace, a 1-character keyword, and the synthetic keyword `zorblax`, when a file contains `Zorblax-app`, `zorblaxing`, `zorblax_x` and a lone 1-character keyword, then exactly one `keyword` hit is reported (the `Zorblax-app` line), and a keyword containing regex metacharacters matches only literally.
  proof: `node --test --test-name-pattern "AC9" test/e234-hygiene-scan.test.mjs`
- **AC10 (placeholder usernames)** — Given home-path lines with the segments `me`, `<name>`, `$USER`, `…` and a synthetic non-placeholder segment, when `agc check` runs, then only the non-placeholder line is listed and one `hyg.skipped` line reports the count 4. The same holds for `encoded-home-path`.
  proof: `node --test --test-name-pattern "AC10" test/e234-hygiene-scan.test.mjs`
- **AC11 (keyword file self-exclusion + tracked warning)** — Given `AGC_HYGIENE_KEYWORDS` pointing at an untracked, non-ignored file inside the workspace, when `agc check` runs, then that file produces no content hits. Given it points at a tracked file, one `hyg.kw.tracked` line is printed.
  proof: `node --test --test-name-pattern "AC11" test/e234-hygiene-scan.test.mjs`
- **AC12 (output cap + summary)** — Given 60 distinct hit lines, when `agc check` runs, then exactly 50 hit lines are listed, followed by a `hyg.more` line naming 10 and a `hyg.summary` line naming 60 hits.
  proof: `node --test --test-name-pattern "AC12" test/e234-hygiene-scan.test.mjs`
- **AC13 (binary / large / symlink skip)** — Given a file with a NUL byte in its first 8 KiB, a file over 1 MiB, and a tracked symlink, each of which would otherwise hit, when `agc check` runs, then none produces a content hit (a hit in the name still reports).
  proof: `node --test --test-name-pattern "AC13" test/e234-hygiene-scan.test.mjs`
- **AC14 (no-git workspace)** — Given a directory that is not a git repo with a hit file, a `node_modules/` hit file, and `AGC_HYGIENE_KEYWORDS` set, when `agc check` runs, then the hit file (shape and keyword) is reported, `node_modules/` is not, and the exit code does not change.
  proof: `node --test --test-name-pattern "AC14" test/e234-hygiene-scan.test.mjs`
- **AC15 (silence + resilience)** — Given a clean git workspace with a keyword file, when `agc check` runs, then no `agc check — hygiene` line is printed. Given that the scan module fails to load or throws, one `hyg.error` line is printed and the exit code does not change.
  proof: `node --test --test-name-pattern "AC15" test/e234-hygiene-scan.test.mjs`
- **AC16 (this repo stays readable, hermetic)** — Given an isolated copy of this repo's committed HEAD tree with its own git dir, made by a temp `git clone` or by extracting `git archive HEAD` into a fresh temp git repo and **never** by running in the live checkout, with `AGC_HYGIENE_KEYWORDS` cleared and no keyword file in the copy's git dir, when `node bin/agc-init.mjs check` runs at the copy's root, then zero hit lines are listed. It must be hermetic for two reasons. Untracked drafts in the checkout running the suite would change the result. The integrator will also later create a real keyword file in the primary checkout's git common dir, which every worktree shares. That covers the lane's own spec, tests, evidence and module source, whose pattern literals must be written so they do not match themselves. Only `hyg.kw.none` and, optionally, one `hyg.skipped` line appear.
  proof: `node --test --test-name-pattern "AC16" test/e234-hygiene-scan.test.mjs`
- **AC17 (docs sync)** — Given the change, when a reader opens `docs/install.md`'s `agc check` advisory paragraph and `docs/config.md`'s `agc check` rows, then both describe the hygiene scan: that it is advisory, the env var name, the default file location and format, the categories, and the fact that matches are never echoed. No other section of those files changes.
  proof: `git diff main...HEAD -- docs/install.md docs/config.md` shows only the `agc check` advisory paragraph and rows changed, and each names `AGC_HYGIENE_KEYWORDS`.

### AC → implementing task
Mapping route: this table in the spec. The task ledger descriptions are left as first written (roles do not hand-edit `tasks.md`, and void-plus-re-add would add id churn for a documentation-only change). T-E234-05 (qa) authors the tests for every AC in the table.

| AC | implementing task(s) |
|---|---|
| AC1 | T-E234-03 |
| AC2 | T-E234-01 |
| AC3 | T-E234-01 |
| AC4 | T-E234-01 (masking) |
| AC5 | T-E234-01 |
| AC6 | T-E234-02 |
| AC7 | T-E234-02 |
| AC8 | T-E234-02 |
| AC9 | T-E234-02 |
| AC10 | T-E234-01 |
| AC11 | T-E234-02 |
| AC12 | T-E234-01 |
| AC13 | T-E234-01 |
| AC14 | T-E234-01 (no-git walk), T-E234-02 (keyword part) |
| AC15 | T-E234-03 |
| AC16 | T-E234-01 (module pattern literals, spec and evidence do not match themselves), T-E234-04 (docs do not match themselves) |
| AC17 | T-E234-04 |

## Copy / Strings
| string id | exact text (quote verbatim) | source |
|---|---|---|
| hyg.hit | `agc check — hygiene: {path}:{line} {category}` | authored-here — mirrors the `agc check — <kind>:` prefix of the existing advisories; file:line is grep/IDE-clickable |
| hyg.hit.name | `agc check — hygiene: {path} (file name) {category}` | authored-here — a file-name hit has no line number |
| hyg.more | `agc check — hygiene: … {n} more hit(s) not listed` | authored-here — the D5 cap |
| hyg.summary | `agc check — hygiene: {n} hit(s) in {m} file(s) — advisory; describe each by class, never the literal text (constitution §6 Information hygiene)` | authored-here — points at the rule being enforced |
| hyg.skipped | `agc check — hygiene: skipped {n} home-path hit(s) with a placeholder username` | authored-here — the D3 skip count required by the human ruling |
| hyg.kw.none | `agc check — hygiene: no keyword list found — only built-in shape patterns ran (set AGC_HYGIENE_KEYWORDS or create agc-hygiene-keywords in the git common dir)` | authored-here — the scope's required one-line explanation |
| hyg.kw.unreadable | `agc check — hygiene: keyword list named by AGC_HYGIENE_KEYWORDS cannot be read — only built-in shape patterns ran` | authored-here — does not echo the path |
| hyg.kw.refused | `agc check — hygiene: keyword list under .current/ refused (it may be tracked) — move it outside the repo; only built-in shape patterns ran` | authored-here — human ruling: never under `.current/` |
| hyg.kw.tracked | `agc check — hygiene: warning: the keyword list is a tracked file — move it outside the repo and untrack it` | authored-here — a tracked keyword list is itself a leak |
| hyg.walk.capped | `agc check — hygiene: stopped after 10000 files (no git repo to list files) — results are partial` | authored-here — the D4 no-git walk cap |
| hyg.error | `agc check — hygiene: scan skipped ({message})` | authored-here — mirrors the orphan-lane advisory's "scan skipped (…)" line |

## Visual Tokens
| token id | property | value (quote verbatim) | source |
|---|---|---|---|
| N/A | — | — | feature has no visual literals |

## Visual Widgets
| widget id | description | source-node |
|---|---|---|
| N/A | — | feature has no non-primitive widgets |

## Out of Scope
- Blocking, meaning any change to `agc check`'s exit code.
- Auto-fixing or rewriting hits.
- Scanning git history, commit messages or PR bodies.
- A pre-commit hook.
- Inline suppression markers and per-repo allowlist config.
- Rewriting rule prose (`content/**`) or any SOP text. If one turns out to be needed, stop and mail the integrator.
- Generic `password = "…"` style credential heuristics, private-IP detection, and a bare `/tmp/` path.
- E250.

## Dependencies / Prerequisites
- E231 ✓ (rule wording final), E232 ✓, E240 ✓ (adopter project directory names and person-named config directories are sensitive, and are covered by the keyword layer, since no generic shape identifies them).
- Human rulings (binding, `specs/fanout-e234.md` Decisions, 2026-09-28): (1) the scan set includes untracked, non-ignored file contents and the file names of tracked and untracked files; (2) the keyword file defaults to the git common dir, can be overridden by an env var, and is never under `.current/`; (3) false positives are handled by a built-in placeholder-username list that prints only a skipped count.
- Calibration (PM, lane base): a shape-layer dry run over this repo's tracked tree found only home-path hits, all with placeholder or template-token segments (covered by D3), and zero hits in the other shape categories. AC16 locks this in.
- Architect hop: **yes** (D6 module shape, exported surface, how pure matchers split from I/O, final regexes). The architect's Open Questions go to the integrator mailbox for a second pre-review, per `docs/lane-protocol.md` §5 rule 2.
- Visual Structural Assertions: omitted (no `design/<feature>.md`, mode = no-design).
