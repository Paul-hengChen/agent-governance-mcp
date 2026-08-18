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
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const { switchRole } = await import(path.join(ROOT, "dist", "tools", "role.js"));
const { buildPromptForRole, composeConstitution } = await import(path.join(ROOT, "dist", "prompts", "build.js"));
const { applyTextTransforms, stripOriginTags, stripRationale } = await import(path.join(ROOT, "dist", "prompts", "text-transforms.js"));
const { parseSkillFile } = await import(path.join(ROOT, "dist", "tools", "skill-frontmatter.js"));

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
// ---------------------------------------------------------------------------

test("detector soundness: both detectors reproduce exactly the 2 known ffa4082 glue sites, byte-identical", () => {
  const baselineRaw = execFileSync(
    "git",
    ["show", "ffa4082:content/skill-release-engineer.md"],
    { cwd: ROOT, encoding: "utf-8" },
  );
  const { body } = parseSkillFile(baselineRaw);

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
