// Coded by @qa-engineer
// Tests for backlog row E69 (docs/backlog.md:192) — the render-structure
// regression test the row mandates in the SAME cut as the fence relocation:
// "assert on applyTextTransforms({fullDetail:false}) output that every
// numbered step header and top-level bullet still begins a line. ONE
// assertion covers the whole class across all 11 role SOPs, not just this
// file; nothing in the suite renders any SOP through the strip pass today."
//
// Spec-to-Test map (backlog row is the spec — mini-chain, no specs/<feature>.md):
//   E69 AC (fence relocation, content/skill-release-engineer.md)
//     -> "T-E69-01 AC", "detector soundness against the ffa4082 baseline"
//   E69 AC (class-wide regression test, all 11 role SOPs + constitution)
//     -> "structural sweep", "cross-SOP render sweep (switchRole)",
//        "cross-SOP render sweep (buildPromptForRole)", "constitution fragments"
//
// WHY: `stripRationale`'s trailing `\n?` (prompts/text-transforms.ts:28) exists
// to swallow the blank line a BLOCK-style rationale fence would otherwise leave
// behind. The contract this depends on (prompts/text-transforms.ts:33-54,
// comment only — never enforced in code) is that a rationale fence is
// SYMMETRIC: either both `<!-- rationale:start -->` and `<!-- rationale:end -->`
// sit alone on their own source line (the intended block shape), or neither
// does. An ASYMMETRIC fence — `start` glued inline to trailing prose, `end`
// followed immediately by `\n` — makes the `\n?` eat a newline that was load-
// bearing: whatever prose preceded `start` ends up fused, same rendered line,
// directly onto whatever line followed `end`. When that following line is a
// numbered step header (`7b. **...`) or a top-level bullet (`- **...`, `` - ` ``,
// `- [ ]`), the fused result no longer parses as a list item or heading at all
// — exactly the two release-engineer sites E69 was filed over (backlog.md:192),
// found by hand, twice, across two review rounds.
//
// Two independent detectors are used and cross-checked against each other and
// against the known ffa4082 baseline (2 findings, byte-reproduced) before being
// trusted against the rest of the corpus (guard against the guard rotting —
// dispatch brief for this ticket, and review_reports/review_T-E69-01.md's own
// "detector sound on a known positive" methodology):
//   1. `findAsymmetricRationaleSpans` — SOURCE-level, purely structural: for
//      every `<!-- rationale:start -->...<!-- rationale:end -->` span, flag it
//      when `end` is immediately followed by `\n` (the exact trigger condition
//      for the newline-eating replace) AND `start` is NOT preceded only by
//      whitespace back to the previous newline (i.e. `start` is inline). This
//      needs no guess at bullet/header syntax and has zero false-positive risk
//      — it is the root-cause invariant, not a symptom pattern.
//   2. `findLineGlueFindings` — RENDER-level (post `applyTextTransforms`,
//      `fullDetail:false`), symptom-level: per rendered line, flags a numbered
//      step header (`\d+[a-z]?\. \*\*`) or a top-level bullet marker (`- **`,
//      `` - ` ``, `- [ ]`/`- [x]`) that appears somewhere OTHER than the line's
//      own leading (post-indent) position — i.e. it does not begin its own
//      rendered line. This is what the backlog row's AC literally asks for,
//      and it is exercised through BOTH real render paths (`tw_switch_role` /
//      tools/role.ts, and the MCP prompt / prompts/build.ts) per the dispatch
//      brief's instruction that both paths matter — `tw_switch_role` is the
//      one E69's two live instances actually shipped through (prompts/text-
//      transforms.ts:1-18, E51 note).
//
// Both detectors agree exactly on every finding below (cross-validated during
// authorship): the 2 known ffa4082 sites, 0 in the fixed content/skill-release-
// engineer.md, and — newly discovered by this test, never audited before because
// nothing rendered any OTHER role SOP through the strip pass — 3 more live sites
// in content/skill-pm.md (x2) and content/skill-qa-engineer.md (x1) and
// content/skill-architect.md (x1). Those 4 are OUT OF SCOPE for this ticket
// (T-E69-01/T-E71-01 touch only content/skill-release-engineer.md) — see the
// "KNOWN, TRACKED debt" block below and qa_reports/review_T-E69-02.md for the
// escalation. Recorded here as an exact ratchet (not silently excluded): any
// NEW instance beyond this list, in any file, reds the suite immediately; a fix
// to any of the 4 listed sites also reds the suite, forcing this list to be
// updated rather than silently going stale.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const { switchRole } = await import(path.join(ROOT, "dist", "tools", "role.js"));
const { buildPromptForRole, composeConstitution } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { applyTextTransforms, stripOriginTags, stripRationale } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));

// ---------------------------------------------------------------------------
// Detector 1 (source-level, structural — see WHY above).
// ---------------------------------------------------------------------------
const RATIONALE_SPAN_RE = /<!-- rationale:start -->[\s\S]*?<!-- rationale:end -->/g;

function findAsymmetricRationaleSpans(text) {
  const findings = [];
  for (const m of text.matchAll(RATIONALE_SPAN_RE)) {
    const startIdx = m.index;
    const endIdx = m.index + m[0].length;
    if (text[endIdx] !== "\n") continue; // end not block-triggering -> no fusion risk
    let p = startIdx - 1;
    while (p >= 0 && text[p] !== "\n") p--;
    const before = text.slice(p + 1, startIdx);
    if (before.trim().length > 0) {
      findings.push({
        before: before.slice(-60),
        after: text.slice(endIdx + 1, endIdx + 60),
      });
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Detector 2 (render-level, symptom — the literal AC wording).
// ---------------------------------------------------------------------------
const NUMHEADER_RE = /\d+[a-z]?\.\s\*\*/g;
const BULLET_RE = /-\s(?:\*\*|`|\[[ xX]\])/g;

function findLineGlueFindings(text) {
  const findings = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const leadWS = line.match(/^\s*/)[0].length;
    for (const re of [NUMHEADER_RE, BULLET_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        // Exclude an inline CODE-SPAN example of bullet/checkbox syntax, e.g.
        // "Example cut line: `- [ ] T-BUG-01 ...`" (skill-pm.md:88) — a
        // backtick immediately before the marker means this is a quoted
        // illustration, not a rendered list item, and it is legitimately
        // mid-line by design (verified false-positive during authorship:
        // structural Detector 1 does NOT flag skill-pm.md's third instance,
        // and reading the source confirms the whole sentence sits on one
        // line with no rationale fence anywhere near it).
        const precedingChar = m.index > 0 ? line[m.index - 1] : "";
        if (m.index > leadWS && precedingChar !== "`") {
          findings.push({ lineNo: i, marker: m[0], line });
        }
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Soundness: both detectors must reproduce EXACTLY the 2 known historical
// sites (docs/backlog.md:192) against the pre-fix baseline, and nothing else.
// A detector that matches nothing on a known-broken input is worse than no
// detector (dispatch brief instruction) — this is the guard-the-guard check.
//
// HERMETIC FIXTURE (E77, docs/backlog.md:200, fixed 2026-08-18): this used to
// build the baseline by reading repository history —
// `execFileSync("git", ["show", "ffa4082:content/skill-release-engineer.md"])`
// — which requires the `ffa4082` commit object to exist in the clone. CI
// (.github/workflows/ci.yml:17, actions/checkout@v4, no fetch-depth ⇒ action
// default of 1) does not fetch it, so the call died
// `fatal: invalid object name 'ffa4082'` on CI (run 32093068950) while passing
// on every developer machine with a deep clone — the fixture was repository
// history, so the test passed or failed on clone depth, not on the code under
// test. Fixed by embedding the two known-broken spans as literals below,
// copied verbatim from `git show ffa4082:content/skill-release-engineer.md`
// lines 119-120 (BASELINE_EXCERPT_MKDIR_P) and lines 126-129
// (BASELINE_EXCERPT_DRIFT_BASELINE) on 2026-08-18 — `ffa4082` is cited here
// as PROVENANCE only, never read at test time. Verified byte-for-byte against
// a full deep-clone `git show` of the same commit before this swap (both
// detectors' finding counts and content unchanged) — this is a fixture swap,
// not a weakened guard: the two excerpts below still exercise the identical
// detector code paths (RATIONALE_SPAN_RE / findAsymmetricRationaleSpans over
// raw text, applyTextTransforms + findLineGlueFindings over the rendered
// text) against the identical bytes the historical file contained at those
// two sites; only the surrounding, uninvolved prose (the rest of the ~170-line
// file) is omitted, and omitting it cannot change either detector's output
// since both operate on fixed-width local context (a rationale span, or a
// single rendered line) that never crosses outside these excerpts.
// ---------------------------------------------------------------------------

// content/skill-release-engineer.md @ ffa4082, lines 119-120 verbatim — the
// "already makes" / `mkdir -p` asymmetric rationale span (fence end followed
// by `\n`, fence start not alone on its own line).
const BASELINE_EXCERPT_MKDIR_P =
  "   - **Log `<CODES>` even when empty (E50)**: print the derived set to the release transcript before acting on it — `echo \"step 7a: <CODES> = {${CODES:-∅}}\"`, expanding the `CODES` variable bound by the derivation above (never a fresh, uncaptured pipeline) — the same self-documenting move step 8's AC4 SKIP branch already makes. <!-- rationale:start -->`<CODES> = ∅` is a legitimate, non-fatal outcome (e.g. a purely docs-only release) and MUST stay non-fatal — but with nothing logged, a correct empty-by-design no-op and a broken empty-by-breakage run are indistinguishable in the transcript. That exact ambiguity is what let a prior derivation's empty-set defect survive two full code-review rounds before a reviewer caught it by hand-backtesting six releases in detached worktrees — the step ran, swept nothing, and told nobody.<!-- rationale:end -->\n   - `mkdir -p` the archive dir for each tree that is NOT `EXCLUDE_*` above: `[ -z \"$EXCLUDE_QA\" ] && mkdir -p qa_reports/archive/<active_feature>/` ; `[ -z \"$EXCLUDE_RR\" ] && mkdir -p review_reports/archive/<active_feature>/` (idempotent). Two PARALLEL per-release directories, one per PARTICIPATING source tree, both named after `active_feature` — regardless of how many codes are in `<CODES>` — one release, one archive dir per participating tree (a participating tree that happens to match zero codes this release can still leave an empty dir behind; harmless and git-invisible, same residual as before — N11). NEVER fold `review_reports/` evidence into `qa_reports/archive/<active_feature>/` (E50, pinned at cut time): the two streams can share basenames (e.g. `review_T-E4X-03.md` existed simultaneously at `qa_reports/archive/e44-e49-.../` and at `review_reports/` root within the same v3.96.0 commit `27f59e2`), so a single shared destination would make `mv -n` silently skip whichever of the two arrives second — exactly the silent-orphan class this step exists to kill.\n";

// content/skill-release-engineer.md @ ffa4082, lines 126-129 verbatim — the
// "MUST NOT be touched." / "7b. **Drift-baseline" asymmetric rationale span
// (an origin:end/rationale:start pair glued inline, fence end followed by
// `\n` directly into the next numbered step header).
const BASELINE_EXCERPT_DRIFT_BASELINE =
  "   - **Zero matches = silent no-op**: if nothing matches any code in `<CODES>`/the `covers:` rules, do nothing — never guess-move unrelated files, never fail the release over it (now visible in the transcript via the logging bullet above, rather than genuinely silent). **MUST NOT**: files whose ids do NOT match `^T-<CODE>-` for any `<CODE>` in `<CODES>` — i.e. not new since `$PREV_TAG` — MUST NOT be touched.<!-- origin:start --> (rescoped across three revisions: originally \"outside the single `active_feature` prefix\"; E49 rescoped to \"outside the commit range\"; E49 round 3 rescoped again to \"not new since `$PREV_TAG`\"; E50 extends scope from `qa_reports/` alone to both `qa_reports/` and `review_reports/`, each confined to its own parallel archive dir)<!-- origin:end --><!-- rationale:start -->\n   - **On the premise this replaces**: the pre-E49 wording justified that MUST NOT as protecting \"concurrent in-flight features\". That premise is false by construction for same-release tickets — the E1 feature lease permits only one non-terminal feature per workspace at a time, so every ticket that ships in the same release closed sequentially, one before the next opened; there is no concurrency to protect against within a single release's commit range. The MUST NOT still has a real job (a different, not-yet-released feature's evidence sitting at the root must not be swept in), it was just mis-labeled as guarding against concurrency instead of scope.\n<!-- rationale:end -->\n7b. **Drift-baseline acknowledgment** (moved ahead of the release commit — E65; was step 10 through v3.100.0. Both `11cc082` (v3.99.0) and `3c4b39e` (v3.100.0) made this write before tagging, landing it inside the release commit rather than after it — this step now describes what those two releases actually did, not a new invention): append this release's newly-completed task IDs (from `tw_get_state`'s `completed_tasks` or `tw_detect_drift`'s `tasksCompleted`) into the `driftBaselineIds` array in `.current/.config.json` — deduplicated, creating the array if absent. This is the sanctioned baseline write (release-engineer only, post-PASS); mechanism and rationale live in `specs/drift-baseline-exemption.md`. This step is part of release bookkeeping — do NOT skip it: without the append, every shipped task ID resurfaces as drift noise in the next session's `tw_detect_drift`. The append takes effect immediately — `loadConfig` re-stats `.config.json`'s mtime on every call (v3.58.0, C18), so any `tw_detect_drift` in the same server process sees the new baseline with no restart needed. `.current/.config.json` is one of the paths step 8's `git add` now stages explicitly.\n";

test("detector soundness: both detectors reproduce exactly the 2 known ffa4082 glue sites, byte-identical", () => {
  const body = BASELINE_EXCERPT_MKDIR_P + BASELINE_EXCERPT_DRIFT_BASELINE;

  // Detector 1, source-level (pre-strip).
  const structural = findAsymmetricRationaleSpans(body);
  assert.equal(structural.length, 2, "structural detector must find exactly 2 asymmetric spans in the ffa4082 baseline");
  assert.ok(structural.some((f) => f.before.includes("already makes")), "must find the mkdir-p bullet's asymmetric span");
  assert.ok(structural.some((f) => f.after.includes("7b. **Drift-baseline")), "must find the 7b header's asymmetric span");

  // Detector 2, render-level (post-strip, the real dispatch text).
  const rendered = applyTextTransforms(body, { fullDetail: false });
  const glued = findLineGlueFindings(rendered);
  assert.equal(glued.length, 2, "render detector must find exactly 2 glue findings in the ffa4082 baseline");
  assert.ok(glued.some((f) => f.line.includes("already makes") && f.line.includes("`mkdir -p`")), "must find the mkdir-p bullet glued mid-line");
  assert.ok(glued.some((f) => f.line.includes("MUST NOT be touched.7b.")), "must find the exact glued string the round-1 review grepped for");
});

// ---------------------------------------------------------------------------
// T-E69-02 AC: content/skill-release-engineer.md — the file this ticket fixed
// — is clean through BOTH real render paths. Positive assertions (each
// bullet/header DOES begin its own rendered line), not just "0 findings",
// per the ticket's literal wording.
// ---------------------------------------------------------------------------

test("T-E69-02 AC: content/skill-release-engineer.md renders glue-free via tw_switch_role (tools/role.ts)", () => {
  const resp = JSON.parse(switchRole("release-engineer", ROOT));
  const findings = findLineGlueFindings(resp.sop);
  assert.deepEqual(findings, [], "tw_switch_role(release-engineer) dispatch text must have zero glue findings");

  const lines = resp.sop.split("\n").map((l) => l.trim());
  assert.ok(
    lines.some((l) => l.startsWith("- `mkdir -p`")),
    "the mkdir-p archive-dir bullet must begin its own rendered line",
  );
  assert.ok(
    lines.some((l) => l.startsWith("7b. **Drift-baseline acknowledgment**")),
    "step 7b's header must begin its own rendered line",
  );
});

test("T-E69-02 AC: content/skill-release-engineer.md renders glue-free via buildPromptForRole (MCP prompt path)", () => {
  const text = buildPromptForRole("skill-release-engineer.md", "probe", ROOT, false).messages[0].content.text;
  const findings = findLineGlueFindings(text);
  assert.deepEqual(findings, [], "buildPromptForRole(skill-release-engineer.md) dispatch text must have zero glue findings");

  const lines = text.split("\n").map((l) => l.trim());
  assert.ok(lines.some((l) => l.startsWith("- `mkdir -p`")), "the mkdir-p archive-dir bullet must begin its own rendered line");
  assert.ok(lines.some((l) => l.startsWith("7b. **Drift-baseline acknowledgment**")), "step 7b's header must begin its own rendered line");
});

// ---------------------------------------------------------------------------
// Class-wide structural sweep — every content/{skill-,const-,coord-}*.md
// fragment on disk, source-level. This is the single assertion that covers
// "all 11 role SOPs" (9 tw_switch_role roles + the 7 coord-*.md fragments that
// compose skill-coordinator.md for `teamwork` + skill-coordinator-lite.md for
// `teamwork-lite`) plus the 15 const-*.md constitution fragments, in one pass,
// independent of any render-path wiring.
//
// KNOWN, TRACKED debt (escalated to pm in qa_reports/review_T-E69-02.md —
// NOT this ticket's scope, which touches only content/skill-release-engineer.md):
// content/skill-pm.md carries 2 live asymmetric spans and content/skill-
// qa-engineer.md and content/skill-architect.md carry 1 each — same defect
// class as E69, never audited before this test existed. Recorded here as an
// EXACT allowlist, not a blanket exclusion: the count is asserted per file, so
// a NEW asymmetric span anywhere (including growth in these 3 files) reds the
// suite, and fixing any of the 4 listed spans ALSO reds the suite (the count
// drops below the pinned expectation) until this list is updated — a silent
// fix can't quietly widen the exemption either.
// ---------------------------------------------------------------------------

const KNOWN_ASYMMETRIC_SPAN_COUNTS = {
  "skill-pm.md": 2,
  "skill-qa-engineer.md": 1,
  "skill-architect.md": 1,
};

test("structural sweep: every content/{skill-,const-,coord-}*.md fragment has zero UNTRACKED asymmetric rationale spans", () => {
  const contentDir = path.join(ROOT, "content");
  const files = fs.readdirSync(contentDir).filter((f) => /^(skill-|const-|coord-)/.test(f));
  assert.ok(files.length >= 9 + 15, "sanity: must see at least the 9 unsplit skill files plus the 15 constitution fragments");

  const actual = {};
  for (const f of files) {
    const raw = fs.readFileSync(path.join(contentDir, f), "utf-8");
    const count = findAsymmetricRationaleSpans(raw).length;
    if (count > 0) actual[f] = count;
  }

  assert.deepEqual(
    actual,
    KNOWN_ASYMMETRIC_SPAN_COUNTS,
    "the set of files carrying asymmetric rationale spans, and their counts, must exactly match the tracked debt list above — " +
      "a mismatch means either a NEW glue site appeared (fix it, or if genuinely new tracked debt, update this list with an escalation) " +
      "or a listed one was fixed (update this list down, do not leave it stale)",
  );
});

// ---------------------------------------------------------------------------
// Cross-SOP render sweep — both real render paths, for every tw_switch_role
// role plus teamwork/teamwork-lite. Render-level cross-check of the structural
// sweep above: confirms the source-level findings actually do (or don't)
// produce a symptom in the real dispatch text, through both paths E51 unified.
// ---------------------------------------------------------------------------

const ROLE_TO_SKILLFILE = {
  "pm": "skill-pm.md",
  "researcher": "skill-researcher.md",
  "design-auditor": "skill-design-auditor.md",
  "sr-engineer": "skill-sr-engineer.md",
  "code-reviewer": "skill-code-reviewer.md",
  "qa-engineer": "skill-qa-engineer.md",
  "architect": "skill-architect.md",
  "doc-writer": "skill-doc-writer.md",
  "release-engineer": "skill-release-engineer.md",
};

// Expected glue-finding counts through the RENDERED (post-strip) dispatch
// text, keyed by role name — must track KNOWN_ASYMMETRIC_SPAN_COUNTS above
// 1:1 (same root cause, same files), plus 0 for every clean role.
const EXPECTED_RENDER_GLUE_COUNTS = {
  "pm": 2,
  "researcher": 0,
  "design-auditor": 0,
  "sr-engineer": 0,
  "code-reviewer": 0,
  "qa-engineer": 1,
  "architect": 1,
  "doc-writer": 0,
  "release-engineer": 0,
};

test("cross-SOP render sweep (tw_switch_role): glue-finding counts match the tracked debt list exactly, for every role", () => {
  for (const role of Object.keys(ROLE_TO_SKILLFILE)) {
    const resp = JSON.parse(switchRole(role, ROOT));
    const findings = findLineGlueFindings(resp.sop);
    assert.equal(
      findings.length,
      EXPECTED_RENDER_GLUE_COUNTS[role],
      `switchRole("${role}") glue-finding count must match the tracked expectation (found: ${JSON.stringify(findings.map((f) => f.marker))})`,
    );
  }
});

test("cross-SOP render sweep (buildPromptForRole): glue-finding counts match the tracked debt list exactly, for every role", () => {
  for (const [role, skillFile] of Object.entries(ROLE_TO_SKILLFILE)) {
    const text = buildPromptForRole(skillFile, "probe", ROOT, false).messages[0].content.text;
    const findings = findLineGlueFindings(text);
    assert.equal(
      findings.length,
      EXPECTED_RENDER_GLUE_COUNTS[role],
      `buildPromptForRole("${skillFile}") glue-finding count must match the tracked expectation (found: ${JSON.stringify(findings.map((f) => f.marker))})`,
    );
  }
});

test("cross-SOP render sweep: teamwork (skill-coordinator.md, coord-*.md fragments) and teamwork-lite (skill-coordinator-lite.md) are glue-free", () => {
  for (const [label, skillFile] of [["teamwork", "skill-coordinator.md"], ["teamwork-lite", "skill-coordinator-lite.md"]]) {
    const text = buildPromptForRole(skillFile, "probe", ROOT, false).messages[0].content.text;
    const findings = findLineGlueFindings(text);
    assert.deepEqual(findings, [], `${label} (${skillFile}) dispatch text must have zero glue findings`);
  }
});

// ---------------------------------------------------------------------------
// Constitution fragments — all 4 chain x design compose combinations, both
// strip passes applied exactly as buildPromptForRole applies them.
// ---------------------------------------------------------------------------

test("constitution fragments: all 4 chain x design compose combinations are glue-free", () => {
  for (const chain of [true, false]) {
    for (const design of [true, false]) {
      const composed = composeConstitution({ chain, design }, ROOT);
      const rendered = stripRationale(stripOriginTags(composed));
      const findings = findLineGlueFindings(rendered);
      assert.deepEqual(findings, [], `composeConstitution({chain:${chain}, design:${design}}) must have zero glue findings`);
    }
  }
});

// ---------------------------------------------------------------------------
// T-E77-02 (docs/backlog.md:200, 2026-08-18 amendment, folded into the same
// cut/dispatch as T-E77-01 above by human decision — same file, same qa
// review surface): class-wide meta-test asserting that NO file under test/
// reads repository HISTORY as a fixture — a pinned sha, `git show
// <rev>:<path>`, or `git log` used to source expected test data. This is
// exactly the class T-E77-01 fixed one instance of (the `git show
// ffa4082:content/skill-release-engineer.md` call two sections above, before
// this ticket).
//
// SCOPE TRAP (recorded in the row, restated here per the row's own
// instruction): do NOT ban `git` outright. test/feature-lease.test.mjs,
// test/context-budget.test.mjs, test/e16-judge-dispatch-charter.test.mjs,
// test/release-staging.test.mjs, and test/verify-release.test.mjs all invoke
// git legitimately — reading WORKING-TREE state (status, diff --cached,
// ls-files, rev-parse HEAD/@{u}, init/add/commit/tag/push/config/checkout/
// remote/reset against a throwaway fixture repo the test itself created) —
// or merely regex-match SOP prose that *mentions* a git command as a string
// under test (e.g. release-staging.test.mjs:1571 asserting the SOP defines
// PREV_TAG via `` `git describe --tags --abbrev=0` ``: that is a string
// literal being checked with .includes(), never an actual git invocation).
// The predicate below is "reads history as a fixture", not "calls git" — a
// coarser guard false-positives on all five files, which per E74's own
// lesson is worse than no guard: it trains readers to ignore it.
//
// The detector purposely does NOT do a flat textual grep of the whole file
// for the word "git" (E74-shaped trap) — it looks for actual subprocess
// invocations whose git subcommand is `show`/`log`, or whose argument is a
// bare pinned commit sha, using a small tokenizer that strips comments and
// string/regex literal contents first so:
//   (a) a COMMENT that merely quotes or describes such a call (e.g. this
//       very file's own T-E77-01 provenance note two sections above, which
//       literally spells out the old `execFileSync("git", ["show", ...])`
//       call for provenance) is never mistaken for a live call site, and
//   (b) a regex literal containing a bare backtick or quote character (e.g.
//       `BULLET_RE` above, `` /-\s(?:\*\*|`|\[[ xX]\])/g ``) never desyncs
//       the scanner into treating the rest of the file as "inside a string"
//       (hit and fixed during authorship: a naive quote-only tokenizer
//       swallowed real `//` comments for the next ~30 lines because of
//       exactly this backtick).
// ---------------------------------------------------------------------------

function isRegexLiteralContext(lastSignificant) {
  if (lastSignificant === "") return true;
  return "([{,;:=!&|?+-*%^~<>".includes(lastSignificant);
}

// Strip //, /* */ comments and treat string/template/regex literal contents
// as opaque (their bytes are preserved verbatim in the output, just never
// re-interpreted as comment/regex syntax) -- see the block comment above for
// why a plain quote-tracking pass is not sufficient on this codebase.
function stripJsCommentsForHistoryScan(source) {
  let out = "";
  let i = 0;
  const n = source.length;
  let lastSignificant = "";
  while (i < n) {
    const c = source[i];
    const c2 = i + 1 < n ? source[i + 1] : "";
    if (c === "/" && c2 === "/") {
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && c2 === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] === "\n") out += "\n";
        i++;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      out += c;
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\") {
          out += source[i];
          i++;
          if (i < n) {
            out += source[i];
            i++;
          }
          continue;
        }
        if (source[i] === "\n") out += "\n";
        out += source[i];
        i++;
      }
      if (i < n) {
        out += source[i];
        i++;
      }
      lastSignificant = quote;
      continue;
    }
    if (c === "/" && isRegexLiteralContext(lastSignificant)) {
      let j = i + 1;
      let inClass = false;
      let sawClose = false;
      while (j < n) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === "[") {
          inClass = true;
          j++;
          continue;
        }
        if (source[j] === "]") {
          inClass = false;
          j++;
          continue;
        }
        if (source[j] === "/" && !inClass) {
          sawClose = true;
          break;
        }
        if (source[j] === "\n") break; // a JS regex literal never spans a line
        j++;
      }
      if (sawClose) {
        let k = j + 1;
        while (k < n && /[a-z]/i.test(source[k])) k++; // flags
        out += source.slice(i, k);
        i = k;
        lastSignificant = "/";
        continue;
      }
      // no closing "/" on this line -> this was division, not a regex.
    }
    if (!/\s/.test(c)) lastSignificant = c;
    out += c;
    i++;
  }
  return out;
}

function matchBracket(text, openIdx, openCh, closeCh) {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === openCh) depth++;
    else if (text[i] === closeCh) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function findUnescapedQuote(text, fromIdx, quote) {
  for (let i = fromIdx; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text[i] === quote) return i;
  }
  return -1;
}

// Locate exec-family calls whose command is the literal "git": array form
// (execFileSync/spawnSync/spawn/execFile) or shell-string form (execSync/
// exec), plus calls to a local `git(args, cwd)` wrapper (the
// test/verify-release.test.mjs convention: `function git(args, cwd) { return
// execFileSync("git", args, ...); }`, called elsewhere as `git([...], root)`)
// -- only activated when the file actually defines such a wrapper, so an
// unrelated `git(...)` identifier is never matched.
function findGitInvocations(source) {
  const invocations = [];

  const arrayCallRe = /\b(?:execFileSync|spawnSync|spawn|execFile)\s*\(\s*["'`]git["'`]\s*,\s*\[/g;
  for (const m of source.matchAll(arrayCallRe)) {
    const arrStart = m.index + m[0].length - 1;
    const close = matchBracket(source, arrStart, "[", "]");
    if (close !== -1) invocations.push({ index: m.index, argsText: source.slice(arrStart, close + 1) });
  }

  const stringCallRe = /\b(?:execSync|exec)\s*\(\s*(["'`])git\s+/g;
  for (const m of source.matchAll(stringCallRe)) {
    const quote = m[1];
    const contentStart = m.index + m[0].length;
    const closeIdx = findUnescapedQuote(source, contentStart, quote);
    if (closeIdx !== -1) invocations.push({ index: m.index, argsText: source.slice(contentStart, closeIdx) });
  }

  if (/\bfunction\s+git\s*\(|const\s+git\s*=\s*\(/.test(source)) {
    const wrapperCallRe = /(?<![.\w])git\s*\(\s*\[/g;
    for (const m of source.matchAll(wrapperCallRe)) {
      const arrStart = m.index + m[0].length - 1;
      const close = matchBracket(source, arrStart, "[", "]");
      if (close !== -1) invocations.push({ index: m.index, argsText: source.slice(arrStart, close + 1) });
    }
  }

  return invocations;
}

// Extract quoted string-literal tokens (the git argv) from an argsText blob,
// whether a JS array literal (`["show", "sha:path"]`) or a raw shell-command
// tail (`show sha:path`).
function extractGitArgTokens(argsText) {
  const tokens = [];
  const quotedRe = /["'`]((?:[^"'`\\]|\\.)*)["'`]/g;
  let any = false;
  for (const m of argsText.matchAll(quotedRe)) {
    tokens.push(m[1]);
    any = true;
  }
  if (!any) tokens.push(...argsText.trim().split(/\s+/).filter(Boolean));
  return tokens;
}

const PINNED_SHA_RE = /^[0-9a-f]{7,40}$/i;

// The T-E77-02 predicate: a git invocation reads HISTORY as a fixture when
// its subcommand is `show` or `log`, or when any of its arguments is a bare
// pinned commit sha used as a ref.
function findHistoryFixtureReads(rawSource) {
  const source = stripJsCommentsForHistoryScan(rawSource);
  const findings = [];
  for (const { index, argsText } of findGitInvocations(source)) {
    const tokens = extractGitArgTokens(argsText).filter((t) => t.length > 0 && !t.startsWith("-"));
    const subcommand = tokens[0];
    const lineNo = source.slice(0, index).split("\n").length;

    if (subcommand === "show") {
      findings.push({ lineNo, reason: "git show <rev>:<path> reads a historical blob as a fixture", snippet: argsText.slice(0, 160) });
      continue;
    }
    if (subcommand === "log") {
      findings.push({ lineNo, reason: "git log reads commit history as a fixture", snippet: argsText.slice(0, 160) });
      continue;
    }
    for (const t of tokens) {
      const shaCandidate = t.split(":")[0];
      if (PINNED_SHA_RE.test(shaCandidate)) {
        findings.push({ lineNo, reason: `pinned sha '${shaCandidate}' used as a git ref argument (history-as-fixture)`, snippet: argsText.slice(0, 160) });
        break;
      }
    }
  }
  return findings;
}

function listMjsFilesUnder(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMjsFilesUnder(full));
    else if (entry.isFile() && entry.name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

test("T-E77-02 meta-test: no file under test/ reads repository history as a fixture (pinned sha / git show <rev>:<path> / git log)", () => {
  const testDir = path.join(ROOT, "test");
  const files = listMjsFilesUnder(testDir);
  assert.ok(files.length >= 80, "sanity: must see roughly the full test/ tree, not an empty/partial glob");

  const allFindings = [];
  for (const f of files) {
    const src = fs.readFileSync(f, "utf-8");
    for (const finding of findHistoryFixtureReads(src)) {
      allFindings.push({ file: path.relative(ROOT, f), ...finding });
    }
  }

  assert.deepEqual(
    allFindings,
    [],
    "no test/ file may read repository history as a fixture (pinned sha / `git show <rev>:<path>` / `git log`) — " +
      `found: ${JSON.stringify(allFindings)}`,
  );
});

// Assembles the reconstructed pre-fix invocation text from parts at runtime
// (never as one static contiguous `execFileSync("git", [...` literal in THIS
// file's own source) so the T-E77-02 sweep test above -- which scans this
// same file among test/*.mjs -- does not mistake this guard-the-guard demo
// DATA for a live call site in render-structure.test.mjs itself. The
// assembled STRING VALUE handed to findHistoryFixtureReads below is
// byte-identical to the real pre-fix line either way; only how it is
// spelled out in THIS file's source changes.
function assembleReconstructedCall(execFn, bin, subArgs, opts) {
  return `const baselineRaw = ${execFn}(\n  ${JSON.stringify(bin)},\n  ${JSON.stringify(subArgs)},\n  ${JSON.stringify(opts)},\n);\n`;
}

test("T-E77-02 guard-the-guard: the history-fixture detector reds against the pre-fix `git show ffa4082:...` line", () => {
  // Reconstructed verbatim from the pre-E77-01 render-structure.test.mjs
  // (see git blame / the E77 backlog row for the original commit) -- NOT
  // read via `git show` here, since this guard-the-guard check must itself
  // never read repository history. Demonstrates the detector would have
  // caught the actual historical defect, per the row's instruction to
  // demonstrate rather than merely assert this.
  const preFixSnippet = assembleReconstructedCall(
    "execFileSync",
    "git",
    ["show", "ffa4082:content/skill-release-engineer.md"],
    { cwd: "ROOT", encoding: "utf-8" },
  );
  const findings = findHistoryFixtureReads(preFixSnippet);
  assert.ok(findings.length >= 1, "detector must RED against the known pre-fix git-show-ffa4082 line");
  assert.ok(
    findings.some((f) => f.reason.includes("git show") && f.snippet.includes("ffa4082")),
    "the finding must specifically identify the git-show-history call, not an unrelated one",
  );

  // Negative control in the same test: a legitimate working-tree git call
  // (verify-release.test.mjs's own `rev-parse HEAD` via its `git(...)`
  // wrapper) and a SOP-prose string assertion (release-staging.test.mjs's
  // `.includes("git describe --tags ...")` style check) must NOT be flagged
  // -- guards against solving the false-negative at the cost of a new
  // false-positive on the very shapes T-E77-02's scope trap calls out.
  const legitimateSnippet = `
    function git(args, cwd) { return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim(); }
    const headSha = git(["rev-parse", "HEAD"], root);
    assert.ok(sop.includes("git describe --tags --abbrev=0"), "SOP must define PREV_TAG");
  `;
  assert.deepEqual(findHistoryFixtureReads(legitimateSnippet), [], "must not false-positive on working-tree git calls or SOP-prose string assertions");
});
