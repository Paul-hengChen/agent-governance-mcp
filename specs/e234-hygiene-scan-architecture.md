# e234-hygiene-scan — architecture

Status: **final.** The cut is human-approved. The integrator pre-reviewed the Open Questions (`docs/lane-protocol.md` §5 rule 2) and accepted all seven recommendations; see *Resolved* below.

Scope: D6 of `specs/e234-hygiene-scan.md`, plus every item there marked "architect may refine" (the final regexes within the D2 coverage, and the concrete handling of the D3 placeholder list). Everything else in the spec is binding and is not restated here.

Authoring rule for this file, the module and every lane artifact: no pattern literal may match its own source text. Paths are described in prose ("the macOS Users root"), and regex fragments are written as below: a one-character class such as `[/]` instead of a bare slash, escaped dots in host names, and a character class right after each vendor prefix. A pattern written this way cannot match its own source text. A calibration dry run of the final patterns below over the lane base tree (tracked plus untracked, non-ignored files, with this file included) gave **0 listed hits and 16 placeholder skips**.

## Affected Files
- `tools/hygiene-scan.ts`: **new** (T-E234-01, T-E234-02). The name is the one the spec used as a working name. It holds the pure matchers, the keyword layer, scan-set enumeration, report formatting and the one I/O entry point, `runHygieneScan`. Its imports are limited to `fs`, `path` and `node:child_process` (`execFileSync` with an argv array, never a shell). It imports no other `tools/` module.
- `dist/tools/hygiene-scan.js`, `.js.map`, `.d.ts`, `.d.ts.map`: **new build output** of the file above (the tsconfig emits declarations and maps). They are committed, like the rest of `dist/`.
- `bin/agc-init.mjs`: **modify** (T-E234-03). Add `loadHygieneScan()` and `checkHygiene(cwd)`, and one `await checkHygiene(cwd);` line in `runCheck()` right after `checkArtifactsDrift(cwd);`. Nothing else in the file changes.
- `docs/install.md`: **modify** (T-E234-04), the `agc check` advisory paragraph only (currently around line 152).
- `docs/config.md`: **modify** (T-E234-04), the `agc check` rows only (currently lines 41–47).
- `test/e234-hygiene-scan.test.mjs`: **new**, qa-owned (T-E234-05). It needs no fixtures, because every hit-bearing input is built at runtime. `test/fixtures/e234/**` stays unused unless qa wants it.

Constraint from an existing test: `test/error-code-contract.test.mjs` harvests every UPPER_SNAKE token from `tools/*.ts`, and any token ending in `_REQUIRED`, `_MISSING`, `_INCOMPLETE`, `_EXCEEDED`, `_UNVERIFIED`, `_REJECTED`, `_UNRESOLVED`, `_MISMATCH`, `_HELD`, `_CHANGE` or `_SUSPECT`, or starting with `MISSING_`, must be a registered gate code. The module therefore uses camelCase or plain-word constant names (for example `limits.maxListed`, never an UPPER_SNAKE name with one of those suffixes).

## Data Structures
```ts
// D2 order is also the output order of categories within one line.
export type HygieneCategory =
  | "home-path" | "encoded-home-path" | "temp-path" | "design-file-key"
  | "credential" | "work-item-link" | "internal-host" | "keyword";
export const hygieneCategories: readonly HygieneCategory[]; // D2 order

export const limits: {
  readonly maxListed: 50;          // D5 cap
  readonly maxWalkFiles: 10000;    // D4 no-git walk cap
  readonly maxContentBytes: 1048576; // 1 MiB, D4
  readonly binarySniffBytes: 8192; // D4 NUL sniff window
};

export const placeholderUsernames: ReadonlySet<string>; // the D3 built-in list, lowercase, verbatim

export interface MatchSpan {
  category: HygieneCategory;
  start: number;          // UTF-16 index into the tested text, inclusive
  end: number;            // exclusive
  placeholder: boolean;   // true only for a home-path / encoded-home-path span whose segment is a placeholder
}

export interface KeywordMatcher {
  readonly size: number;                                   // count of usable keywords
  spans(text: string): Array<{ start: number; end: number }>;
}

export interface LineVerdict {
  listed: HygieneCategory[];   // deduped, D2 order: categories with >= 1 non-placeholder span
  skipped: HygieneCategory[];  // deduped, D2 order: home categories whose spans are ALL placeholders
}

export interface Hit {
  path: string;          // workspace-relative, forward slashes, UNMASKED (masked only at format time)
  line: number | null;   // 1-based; null = file-name hit
  category: HygieneCategory;
}

export type KeywordSource =
  | { kind: "none" }        // no env var + no default file, or no git repo + no env var
  | { kind: "unreadable" }  // env var names a path that cannot be read
  | { kind: "refused" }     // env var path is under <cwd>/.current/
  | { kind: "loaded"; keywords: string[]; dev: number; ino: number; tracked: boolean };

export interface ScanSet {
  paths: string[];          // workspace-relative, forward slashes, deduped, in enumeration order
  mode: "git" | "walk";
  capped: boolean;          // walk mode only: more than maxWalkFiles files existed
}

export interface ScanOutcome {
  source: KeywordSource["kind"];
  keywordFileTracked: boolean;
  walkCapped: boolean;
  hits: Hit[];              // ALL hits in output order (formatReport applies the cap)
  skipped: number;          // D3 skip count (see Decision Records: skip unit)
}

export interface HygieneScanOptions {
  env?: Record<string, string | undefined>;  // default: process.env
  write?: (line: string) => void;            // one call per output line, no trailing newline; default: stderr
}
```

## Interface Contracts
The module has two layers. Everything in the **pure** layer is deterministic, performs no I/O, and can be unit-tested from `dist/tools/hygiene-scan.js` with strings alone. Only the **I/O** layer touches git or the filesystem.

### Pure layer
- `isPlaceholderSegment(seg: string): boolean`: normalizes `seg` (trailing characters in the set `. , ; : ! ? ) ] } > ' "` are stripped, and if that leaves nothing, the raw segment is used), lowercases it, then returns true when it is on `placeholderUsernames`, starts with one of `<`, `{`, `[`, `$`, `%`, or consists only of `.`, `…`, `*`, `_`, `x`, `X` (D3).
- `findShapeMatches(text: string): MatchSpan[]`: runs every shape pattern (table below) over `text`, sets `placeholder` for the two home categories through `isPlaceholderSegment`, and returns spans sorted by `start`.
- `parseKeywordList(text: string): string[]`: strips a leading U+FEFF and splits on `\r?\n`. Each line is trimmed. Blank lines and lines whose first non-whitespace character is `#` are dropped, as are entries shorter than 2 UTF-16 code units after trimming. Duplicates are removed case-insensitively and file order is kept (D1).
- `compileKeywordMatcher(keywords: readonly string[]): KeywordMatcher | null`: returns `null` when the list is empty. Otherwise it builds one `RegExp` with flags `giu`: an alternation of regex-escaped literals, longest first, wrapped in the ASCII word-character lookarounds `(?<![A-Za-z0-9_])` and `(?![A-Za-z0-9_])`. The escape set is `[.*+?^${}()|[\]\\/]` (valid under the `u` flag, and `-` is never escaped).
- `classifyLine(text: string, kw: KeywordMatcher | null): LineVerdict`: combines `findShapeMatches` with `kw.spans` (as `keyword`, never a placeholder).
- `maskText(text: string, kw: KeywordMatcher | null): string`: takes every span from both layers, placeholder spans included, merges spans that overlap or touch, and replaces each merged span with `***`. Used for every printed path and for every `hyg.error` message.
- `formatReport(o: ScanOutcome, kw: KeywordMatcher | null): string[]`: returns the exact output lines (Copy ids from the spec) in this order:
  1. one keyword-status line when applicable: `hyg.kw.none` / `hyg.kw.unreadable` / `hyg.kw.refused`; for `loaded` with `keywordFileTracked`, `hyg.kw.tracked`
  2. `hyg.walk.capped` when `walkCapped`
  3. up to `limits.maxListed` hit lines (`hyg.hit`, or `hyg.hit.name` when `line === null`), each path passed through `maskText`
  4. `hyg.more` with `n = hits.length - 50`, when positive
  5. `hyg.summary` with `n = hits.length` and `m =` the number of distinct `hit.path` values, when `hits.length > 0`
  6. `hyg.skipped` with `n = skipped`, when `skipped > 0`

  With zero hits and zero skips, the result is only line 1 (or nothing), which gives the D5 silence rule and AC15.

### I/O layer
- `listScanSet(cwd: string): ScanSet`: runs `git ls-files -z --cached --others --exclude-standard` (`cwd` is the workspace, `maxBuffer` 256 MiB, and stderr is ignored). On success it NUL-splits and dedupes the output (unmerged index entries repeat). On any failure (not a repo, git missing) it switches to walk mode: a depth-first walk with sorted `readdirSync` that skips directories named `.git` or `node_modules`, uses `lstat` and never follows symlinks (a symlink counts as a file entry), and stops at `limits.maxWalkFiles` with `capped = true` when one more entry exists.
- `resolveKeywordSource(cwd: string, env: Record<string, string | undefined>, inGit: boolean): KeywordSource`:
  1. If `env.AGC_HYGIENE_KEYWORDS` is non-empty, `abs = path.resolve(cwd, value)`. The source is **refused** when `abs`, or its realpath when it exists, lies under `path.resolve(cwd, ".current")` or its realpath. Otherwise, if reading fails, it is **unreadable**. Otherwise it is **loaded**, and `tracked` = (`git ls-files --error-unmatch -- <basename>` run in `dirname(realpath)` exits 0).
  2. Otherwise, when `inGit` is true, the default file is `path.resolve(cwd, <git rev-parse --git-common-dir output, trimmed>)` joined with `agc-hygiene-keywords`. If it exists and is readable, the source is **loaded** (`tracked = false`: it lies in the git dir by construction). If it is absent, the source is **none**. For "exists but unreadable", see Open Question 2.
  3. Otherwise (no git repo, no env var) the source is **none**.

  The `dev`/`ino` pair comes from `statSync` of the realpath and is used for self-exclusion. No branch ever returns the path, and no output line prints it.
- `scanWorkspace(cwd, set, source, kw): ScanOutcome`: for each path in order:
  1. `lstat`. A missing path is skipped entirely (D4).
  2. Check the file name with `classifyLine(path, kw)`, producing hits with `line: null`.
  3. The content is read only when the entry is a regular file, `size <= maxContentBytes`, it is not the keyword file (by the `dev`/`ino` match), and there is no `0x00` byte in its first `binarySniffBytes`. It is decoded as UTF-8 and split on `\r?\n`, and each line goes through `classifyLine`.
  4. `listed` categories become `Hit`s. Each `skipped` category adds 1 to `skipped`.
- `runHygieneScan(cwd: string, opts?: HygieneScanOptions): ScanOutcome | null`: the single entry point `bin/` calls. It composes the functions above and writes `formatReport(...)` through `opts.write`. **It never throws.** Any error is caught, one `hyg.error` line is written with `{message}` = `maskText(String(err.message ?? err), kw)` and newlines flattened to spaces, and the function returns `null`.

### Final shape patterns (D2 coverage; architect refinement)
Written as `String.raw` fragments. `SEP` = `(?:\\{1,2}|/)` (one or two backslashes, or a slash). `SEG` = `[^\s/\\"'` + backtick + `]+` (the segment runs until whitespace, a separator, a quote or a backtick, so template tokens like an angle-bracket name are captured and then classified as placeholders). `LB` = `(?<![A-Za-z0-9_.~\-])`. Groups marked `(SEG)` feed `isPlaceholderSegment`.

| category | pattern(s), flags `g` unless noted |
|---|---|
| `home-path` | `LB` + `[/](?:Users\|home)[/](SEG)` ; `(?<![A-Za-z0-9_])[A-Za-z]:` + `SEP` + `[Uu]sers` + `SEP` + `(SEG)` |
| `encoded-home-path` | `(?<![A-Za-z0-9])-(?:Users\|home)-([^\-\s/\\"'` + backtick + `]+)-` (the drive form is covered automatically, because its hyphen before `Users` follows a hyphen) |
| `temp-path` | `LB` + `(?:[/]private)?[/]var[/]folders[/]` + `SEG` ; `LB` + `[/]private[/]tmp[/]` + `SEG` ; `AppData` + `SEP` + `Local` + `SEP` + `Temp` + `SEP` + `SEG` (flag `gi`) |
| `design-file-key` | `(?<![A-Za-z0-9\-])(?:[A-Za-z0-9\-]+\.)*figma\.com/(?:file\|design\|proto\|board\|slides\|make)/[A-Za-z0-9]{10,}` (flag `gi`; the scheme is optional) |
| `credential` | `-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----` ; `(?<![A-Z0-9])AKIA[A-Z0-9]{16}(?![A-Z0-9])` ; `(?<![A-Za-z0-9_])gh[pousr]_[A-Za-z0-9]{36,}` ; `(?<![A-Za-z0-9_])github_pat_[A-Za-z0-9_]{22,}` ; `(?<![A-Za-z0-9_])xox[a-z]-[A-Za-z0-9\-]{10,}` ; `(?<![A-Za-z0-9_])sk-ant-[A-Za-z0-9_\-]{20,}` |
| `work-item-link` | `https?://(?:[A-Za-z0-9\-]+\.)*dev\.azure\.com(?![A-Za-z0-9.\-])` (flag `gi`) ; `https?://[A-Za-z0-9\-]+\.visualstudio\.com(?![A-Za-z0-9.\-])` (flag `gi`) ; `https?://[A-Za-z0-9\-]+\.atlassian\.net/browse/[A-Z][A-Z0-9_]+-[0-9]+` |
| `internal-host` | `https?://(?:[A-Za-z0-9\-]+\.)+(?:internal\|corp\|intranet\|lan)(?![A-Za-z0-9.\-])` (flag `gi`) |

(In the table, `\|` is Markdown escaping for a literal alternation bar.) Silent by construction: the bare temp roots D2 exempts (a segment is required after the root), a design-tool URL whose key is a template token (the key class rejects `<`), `.land`-style hosts (the lookahead), and a URL path such as a host followed by the Users root (`LB` rejects a preceding `.`, `m` and so on, because the character before the slash is part of the host).

### `bin/agc-init.mjs` wiring (follows the `loadLanePaths` / `loadTicketAllocation` dynamic-import precedent)
```js
// Pure-ish module, loaded from dist/ like loadLanePaths. Returns null instead
// of throwing: agc check must never fail over an advisory.
async function loadHygieneScan() {
  try {
    return await import(new URL("../dist/tools/hygiene-scan.js", import.meta.url).href);
  } catch {
    return null;
  }
}

async function checkHygiene(cwd) {
  const skipped = (why) => process.stderr.write(`agc check — hygiene: scan skipped (${why})\n`);
  const mod = await loadHygieneScan();
  if (mod === null || typeof mod.runHygieneScan !== "function") {
    skipped("cannot load dist/tools/hygiene-scan.js — run `npm run build`");
    return;
  }
  try {
    mod.runHygieneScan(cwd, { env: process.env, write: (l) => process.stderr.write(`${l}\n`) });
  } catch {
    skipped("unexpected error"); // runHygieneScan never throws by contract; belt and braces
  }
}
```
`runCheck()` gets `await checkHygiene(cwd); // advisory; never affects exit code` right after `checkArtifactsDrift(cwd);`. The raw `err.message` of a load failure is never printed, because it carries the absolute `file:` URL of the agc install, which is a local path. AC15's load-failure and throw cases need **no new env or test seam**. qa copies `bin/agc-init.mjs` and `package.json` into a temp install root: with no `dist/tools/hygiene-scan.js` for the load-failure case, and with a stub whose `runHygieneScan` throws for the throw case. qa runs it from a non-git cwd so the orphan-lane scan stays out of the output.

## Sequence Diagram
```mermaid
sequenceDiagram
  participant CLI as bin/agc-init.mjs runCheck
  participant M as dist/tools/hygiene-scan.js
  participant G as git (execFileSync)
  participant FS as filesystem
  CLI->>M: dynamic import (null on failure -> hyg.error, return)
  CLI->>M: runHygieneScan(cwd, {env, write})
  M->>G: ls-files -z --cached --others --exclude-standard
  alt git fails
    M->>FS: lstat/readdir walk (skip .git, node_modules; cap 10000)
  end
  M->>M: resolveKeywordSource(env var -> refuse/unreadable/loaded)
  opt env var unset/empty and in git
    M->>G: rev-parse --git-common-dir
    M->>FS: read default keyword file
  end
  opt env source loaded
    M->>G: ls-files --error-unmatch (tracked warning)
  end
  loop each path
    M->>FS: lstat, then read content if regular, at most 1 MiB, no NUL, not keyword file
    M->>M: classifyLine(name / each line)
  end
  M->>CLI: write(formatReport lines) to stderr
  CLI->>CLI: adapter-stamp check (exit code decided here only)
```

## Decision Records
| Context | Decision | Consequences |
|---|---|---|
| Where the logic lives | A new `tools/hygiene-scan.ts`, compiled to `dist/`, not inline in `bin/` | Unit-testable pure layer and one import point. `bin/` gains about 20 lines. The advisory depends on `dist/` being built (the same as the lane tooling), and degrades to `hyg.error` otherwise |
| Pure/I/O split | The pure functions take strings and return spans, verdicts and lines. Only `listScanSet`, `resolveKeywordSource`, `scanWorkspace` and `runHygieneScan` touch git or fs | qa can table-test every regex, the placeholder list, keyword parsing, masking, and the cap/summary/order from strings alone. The CLI ACs remain the end-to-end proofs |
| Output is collected, then formatted | The scan collects every hit, then `formatReport` emits in a fixed order (status, walk cap, hits, more, summary, skipped) | Deterministic output, and the cap and summary need the full count anyway. Memory grows with the hit count, which is bounded by files times lines, and that is acceptable for an advisory |
| Skip-count unit | One skip per distinct (file, line, home category) whose spans are all placeholders. A tuple with any real span is listed, and its placeholder siblings are not counted | Mirrors the hit dedup unit and satisfies AC10 (four lines give 4). See Resolved 1 |
| Self-exclusion identity | `dev` + `ino` from `lstat` (already taken per file) against `stat` of the keyword file's realpath | No extra realpath call per file. Robust to relative or symlinked env paths |
| Tracked-keyword-file test | `git ls-files --error-unmatch -- <basename>` run in the file's own directory, env source only | Works for a keyword file in any repo, not only the workspace. The default location is never tracked, so it is not tested |
| Common-dir resolution | `git rev-parse --git-common-dir` output resolved against `cwd` | Matches the `readSharedExclude` precedent. Modern git prints the path relative to `cwd` (verified on a primary checkout and a subdirectory), and a linked worktree gets an absolute path |
| URL-shaped categories require a scheme | `work-item-link` and `internal-host` require `http://` or `https://`. `design-file-key` does not (the key is the secret) | Bare host names in prose, including the spec's own D2 table, stay silent. A schemeless tracker link is not flagged (Resolved 3) |
| Home-path left boundary | The root separator must not follow `[A-Za-z0-9_.~-]` | URL paths and longer paths that merely contain the Users or home word are not flagged (Resolved 5). A Windows drive form also matches the macOS pattern on the same line, which is harmless because hits are deduped per (line, category) |
| Keyword regex flags | One alternation, longest first, flags `giu`, ASCII-only word lookarounds | Correct case folding for non-ASCII, and no ReDoS (pure literals). A folding edge exists: under `iu` a keyword with `k` or `s` also matches the Kelvin sign and the long s. This is accepted |
| Load-failure message | A fixed `hyg.error` text for a load failure. Runtime errors go through `maskText` | No absolute install path or matched text can leak through an error line (Resolved 4) |
| No test seam | No env var or flag to force the load or throw paths | Less public surface. qa exercises AC15 with a copied install root |

## Deferred Resources
_None — the spec's Dependencies / Prerequisites shows zero ignored/deferred refs._

## Open Questions
None.

### Resolved (integrator pre-review)
The integrator accepted all seven recommendations unchanged. They are binding on sr-engineer.
1. **Skip-count unit**: one skip per distinct (file, line, home category) whose spans are all placeholders.
2. **Default keyword file present but unreadable**: prints `hyg.kw.none`. No Copy change.
3. **URL scheme**: `work-item-link` and `internal-host` require `http(s)://`. `design-file-key` keeps an optional scheme.
4. **`hyg.error` message**: fixed text on a load failure ("cannot load dist/tools/hygiene-scan.js — run `npm run build`", as in the wiring sample above). Runtime errors are passed through `maskText` and flattened to one line.
5. **Home-path left boundary**: the root slash must not follow `[A-Za-z0-9_.~-]`.
6. **Windows forms**: a lowercase `users` word and one or two backslashes are accepted. The macOS and Linux forms stay case-sensitive.
7. **AWS key prefix**: the long-term access-key prefix only.
