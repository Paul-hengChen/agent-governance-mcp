// Coded by @qa-engineer
// Render-structure check for backlog row E69: after the strip pass (applyTextTransforms with
// fullDetail:false) every numbered step header and top-level bullet must still begin its own line.
// An asymmetric rationale fence (start inline after prose, end followed by a newline) makes the
// strip fuse two lines; two detectors, one source-level and one render-level, catch it.
// Rationale: specs/e260i-comment-rationale.md (test/render-structure.test.mjs).

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
const { composeSkill, hostCapabilitiesFor } = await import(path.join(ROOT, "dist", "prompts", "skill-manifest.js"));

// Composed skill body (frontmatter stripped), before the render pass: the shape build.ts hands to
// applyTextTransforms. Not buildPromptForRole output, which appends the live handoff state; that
// prose can mention the rationale and origin markers and defeat a raw marker count.
function composedSkillBody(f) {
  const composed = composeSkill(f, hostCapabilitiesFor("claude-code"), (g) => fs.readFileSync(path.join(ROOT, "content", g), "utf-8"));
  return composed.startsWith("---") ? composed.slice(composed.indexOf("---", 3) + 3).trimStart() : composed;
}

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
        // Skip an inline code-span example of bullet syntax (a backtick right before the marker):
        // it is a quoted illustration and legitimately mid-line, not a rendered list item.
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
// Soundness: both detectors must reproduce exactly the two known historical glue sites.
// HERMETIC FIXTURE: the baseline is embedded as two literals, not read from git history, so the
// test does not depend on clone depth. The excerpts are frozen renderer input and still say
// "step 8" from before the SOP split it; do not edit them to match the live SOP.
// Rationale: specs/e260i-comment-rationale.md (test/render-structure.test.mjs).
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
// Release-engineer render check (T-E69-02): content/skill-release-engineer.md — the file this ticket fixed
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
// Behavioural pin for the Evidence-Citation Convention and the CHANGELOG citation check (E87, E95).
// A golden refresh plus a cap bump would not catch a silently dropped convention: the golden just
// recaptures whatever the composer emits. This block asserts the text renders in both bundles at
// both fullDetail settings, rationale is stripped and no raw rationale or origin marker survives
// at fullDetail=false, and no fence glues a heading or bullet onto its neighbour.
// ---------------------------------------------------------------------------

test("T-E8795-02 AC: coord-03 Evidence-Citation Convention (E87) renders at fullDetail=false, rationale stripped, zero raw markers", () => {
  const text = applyTextTransforms(composedSkillBody("skill-coordinator.md"), { fullDetail: false });
  assert.ok(text.includes("## Evidence-Citation Convention"), "coordinator bundle must carry the E87 heading");
  assert.ok(text.includes("<tree>/archive/<feature>/<file>"), "coordinator bundle must carry the E87 archive-path template");
  assert.ok(
    !text.includes("no role is authorized to repair a stale citation afterward"),
    "fullDetail=false must strip the E87 rationale prose",
  );
  assert.equal((text.match(/rationale:start|rationale:end/g) || []).length, 0, "zero raw rationale markers may survive fullDetail=false");
  assert.equal((text.match(/origin:start|origin:end/g) || []).length, 0, "zero raw origin markers may survive fullDetail=false");
});

test("T-E8795-02 AC: coord-03 Evidence-Citation Convention (E87) renders at fullDetail=true, with rationale retained", () => {
  const text = applyTextTransforms(composedSkillBody("skill-coordinator.md"), { fullDetail: true });
  assert.ok(text.includes("## Evidence-Citation Convention"), "coordinator bundle must carry the E87 heading");
  assert.ok(text.includes("<tree>/archive/<feature>/<file>"), "coordinator bundle must carry the E87 archive-path template");
  assert.ok(
    text.includes("no role is authorized to repair a stale citation afterward"),
    "fullDetail=true must RETAIN the E87 rationale prose (rationale fence is opt-out, not deletion)",
  );
  // stripOriginTags runs unconditionally regardless of fullDetail (text-transforms.ts
  // applyTextTransforms) — origin markers are gone on EITHER setting, unlike rationale.
  assert.equal((text.match(/origin:start|origin:end/g) || []).length, 0, "origin markers strip unconditionally, even at fullDetail=true");
});

test("T-E8795-02 AC: skill-release-engineer.md CHANGELOG citation check (E95) renders at fullDetail=false, rationale stripped, zero raw markers", () => {
  // Bullet re-baselined after the release-range check change (T-E142-05, E142(a)): label gained a
  // "range-corrected — E142(a)" suffix when the check moved from `--cached`
  // alone to the union of the release range and staged changes.
  const text = applyTextTransforms(composedSkillBody("skill-release-engineer.md"), { fullDetail: false });
  assert.ok(text.includes("CHANGELOG citation check (E95"), "release-engineer bundle must carry the E95 bullet");
  assert.ok(
    !text.includes("didn't ship until the v3.104.3 corrective patch"),
    "fullDetail=false must strip the E95 rationale prose (the v3.104.2 worked example)",
  );
  assert.equal((text.match(/rationale:start|rationale:end/g) || []).length, 0, "zero raw rationale markers may survive fullDetail=false");
  assert.equal((text.match(/origin:start|origin:end/g) || []).length, 0, "zero raw origin markers may survive fullDetail=false");
});

test("T-E8795-02 AC: skill-release-engineer.md CHANGELOG citation check (E95) renders at fullDetail=true, with rationale retained", () => {
  const text = applyTextTransforms(composedSkillBody("skill-release-engineer.md"), { fullDetail: true });
  assert.ok(text.includes("CHANGELOG citation check (E95"), "release-engineer bundle must carry the E95 bullet");
  assert.ok(
    text.includes("didn't ship until the v3.104.3 corrective patch"),
    "fullDetail=true must RETAIN the E95 rationale prose (rationale fence is opt-out, not deletion)",
  );
  assert.equal((text.match(/origin:start|origin:end/g) || []).length, 0, "origin markers strip unconditionally, even at fullDetail=true");
});

test("T-E8795-02 AC: the E87 fence is block-style, not asymmetric — no glue findings in either dispatch path (regression guard)", () => {
  // switchRole is the actual tw_switch_role dispatch path for release-engineer;
  // the coordinator has no switchRole entry (teamwork is a buildPromptForRole-only
  // prompt id — ALL_SWITCHROLE_ROLES above deliberately excludes it), so the
  // coordinator side is exercised via composedSkillBody + applyTextTransforms,
  // exactly mirroring what buildPromptForRole does internally, minus the live
  // state-block concatenation this file's other tests already avoid depending on.
  const coordText = applyTextTransforms(composedSkillBody("skill-coordinator.md"), { fullDetail: false });
  assert.deepEqual(findLineGlueFindings(coordText), [], "coord-03's E87 fence must not glue any line in the coordinator bundle");

  const releaseResp = JSON.parse(switchRole("release-engineer", ROOT));
  assert.deepEqual(findLineGlueFindings(releaseResp.sop), [], "skill-release-engineer.md's E95 fence must not glue any line via tw_switch_role");
});

// ---------------------------------------------------------------------------
// Class-wide structural sweep over every skill, const and coord fragment in content/, at source
// level and independent of render-path wiring. The allowlist below is empty on purpose: the
// earlier debt (four asymmetric spans in the PM, QA and architect SOPs) was paid by relocating
// the fences, and the empty map stays as a zero-tolerance guard for any asymmetric span.
// ---------------------------------------------------------------------------

const KNOWN_ASYMMETRIC_SPAN_COUNTS = {};

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
// produce a symptom in the real dispatch text, through both paths the shared-render-path work (E51) unified.
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
  "pm": 0,
  "researcher": 0,
  "design-auditor": 0,
  "sr-engineer": 0,
  "code-reviewer": 0,
  "qa-engineer": 0,
  "architect": 0,
  "doc-writer": 0,
  "release-engineer": 0,
};

test("cross-SOP render sweep (tw_switch_role): glue-finding counts match the tracked debt list exactly, for every role", () => {
  // Collect-then-assert: iterate every role before any assertion and compare the whole map once.
  // A per-iteration assert would fail fast on the first mismatching role and never run the rest,
  // so a single run reports every role's actual count.
  const actual = {};
  for (const role of Object.keys(ROLE_TO_SKILLFILE)) {
    const resp = JSON.parse(switchRole(role, ROOT));
    actual[role] = findLineGlueFindings(resp.sop).length;
  }
  assert.deepEqual(
    actual,
    EXPECTED_RENDER_GLUE_COUNTS,
    "glue-finding counts (per role, tw_switch_role) must match the tracked expectation for EVERY role, not just the first mismatch",
  );
});

test("cross-SOP render sweep (buildPromptForRole): glue-finding counts match the tracked debt list exactly, for every role", () => {
  // Collect-then-assert — see the tw_switch_role sweep above for why.
  const actual = {};
  for (const [role, skillFile] of Object.entries(ROLE_TO_SKILLFILE)) {
    const text = buildPromptForRole(skillFile, "probe", ROOT, false).messages[0].content.text;
    actual[role] = findLineGlueFindings(text).length;
  }
  assert.deepEqual(
    actual,
    EXPECTED_RENDER_GLUE_COUNTS,
    "glue-finding counts (per role, buildPromptForRole) must match the tracked expectation for EVERY role, not just the first mismatch",
  );
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
// History-fixture meta-test: no file under test/ may read repository history as a fixture (a
// pinned sha, or a history lookup used to source expected data). The predicate is that, not
// "calls git": other tests use git on working-tree or throwaway-repo state, and a coarser guard
// would false-positive on them. The scan strips comments and treats literal contents as opaque.
// Rationale: specs/e260i-comment-rationale.md (test/render-structure.test.mjs).
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

// The history-fixture predicate (T-E77-02): a git invocation reads HISTORY as a fixture when
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

// Builds the pre-fix invocation text from parts at runtime, never as one contiguous literal in this
// file's source, so the history-fixture sweep above (which scans this file too) does not mistake
// this demo data for a live call site. The assembled string value is byte-identical either way.
function assembleReconstructedCall(execFn, bin, subArgs, opts) {
  return `const baselineRaw = ${execFn}(\n  ${JSON.stringify(bin)},\n  ${JSON.stringify(subArgs)},\n  ${JSON.stringify(opts)},\n);\n`;
}

test("T-E77-02 guard-the-guard: the history-fixture detector reds against the pre-fix `git show ffa4082:...` line", () => {
  // Reconstructed verbatim from the pre-fix (T-E77-01) render-structure.test.mjs
  // (see git blame / the no-history-fixture backlog row (E77) for the original commit) -- NOT
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
  // false-positive on the very shapes the scope trap of the history-fixture test (T-E77-02) calls out.
  const legitimateSnippet = `
    function git(args, cwd) { return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim(); }
    const headSha = git(["rev-parse", "HEAD"], root);
    assert.ok(sop.includes("git describe --tags --abbrev=0"), "SOP must define PREV_TAG");
  `;
  assert.deepEqual(findHistoryFixtureReads(legitimateSnippet), [], "must not false-positive on working-tree git calls or SOP-prose string assertions");
});
