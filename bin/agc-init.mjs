#!/usr/bin/env node
// `agc` — agent-governance-mcp workspace CLI.
//
//   agc init [--artifacts=local|repo]
//              Scaffold .current/.config.json, tasks.md, and per-agent entry
//              adapters (CLAUDE.md, AGENTS.md, .antigravityrules). Idempotent:
//              most existing files are skipped as-is; the CLAUDE.md adapter
//              block and .current/.config.json's "host" key (E100) are each
//              upserted in place. Deliberately does NOT write
//              .current/<lane>/handoff.md (E34): any seeded prev tuple dead-ends the
//              ALLOWED_TRANSITIONS lookup — the sanctioned fresh-workspace
//              tuple is null:null, i.e. the file being absent, so the first
//              pm:In_Progress write creates it via the normal edge.
//              --artifacts records whether governance runtime artifacts stay
//              out of git ("local": rules added to the shared
//              .git/info/exclude, never .gitignore) or are tracked ("repo":
//              config key only). Omitted, it defaults to "local" — unless an
//              artifact path is already tracked, in which case nothing is
//              declared and the user is asked to choose explicitly. Tracked
//              paths are reported with the untrack command, never untracked.
//   agc check  Warn if any deployed adapter is stamped with an older agc
//              version than the one installed; exit 1 if any are stale.
//              Also warns (advisory, never exit 1) if any tracked file
//              under research/ looks like a binary asset (E104 prevention),
//              and — inside a linked git worktree only — if qa_reports/,
//              review_reports/, or specs/ is a real untracked directory
//              instead of a symlink back to primary (E111 prevention), and
//              if the declared "artifacts" choice is missing or disagrees
//              with the repo's actual exclude / tracked state.
//   agc feature start <ticket-slug> [--base <branch>] [--path <dir>]
//   agc feature finish <ticket-id> (--shipped|--abandoned) [--base <branch>]
//              Lane lifecycle (E73): cut a feat/<ticket-slug> branch + linked
//              git worktree from the primary checkout (node_modules symlinked,
//              .env byte-copied), and tear it down again with a merge guard
//              (--shipped) or an evidence-to-abandoned/ disposition
//              (--abandoned). See the "subcommand: feature" section below.
//   agc eject [--yes] [--purge-knowledge]
//              Print (default) or apply the removal plan for agc's runtime
//              artifacts, process evidence and host traces; tracked paths are
//              only named in a printed `git rm -r` line. See the
//              "subcommand: eject" section below.

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

// --- version-stamp parsing -------------------------------------------------
// Matches "<!-- agc-version: 3.28.0 -->" and "# agc-version: 3.28.0".
const STAMP_RE = /agc-version:\s*([0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?)/;

// CLAUDE.md marker block (exact; used by both write and check).
const CLAUDE_BEGIN = "<!-- BEGIN agc-adapter -->";
const CLAUDE_END = "<!-- END agc-adapter -->";

// Adapter registry — drives init write + check scan.
//   rel  = path in the target workspace
//   tpl  = template filename under templates/agent-adapters/
//   mode = "skip" (skip-if-exists, whole-file) | "upsert" (marker-block)
const ADAPTERS = [
  { rel: "CLAUDE.md", tpl: "claude.md", mode: "upsert" },
  { rel: "AGENTS.md", tpl: "codex.md", mode: "skip" },
  { rel: ".antigravityrules", tpl: "antigravity.md", mode: "skip" },
];

const STR_USAGE =
  "Usage: agc <command>\n" +
  "  init [--artifacts=local|repo]\n" +
  "          Scaffold .current/.config.json, tasks.md, and per-agent entry\n" +
  "          adapters (CLAUDE.md, AGENTS.md, .antigravityrules) in the current\n" +
  "          directory. Existing files are left as-is, except CLAUDE.md's agc\n" +
  "          block and .config.json's \"host\" / \"artifacts\" keys, which are\n" +
  "          upserted. --artifacts=local (the default) keeps .current/,\n" +
  "          tasks.md, qa_reports/ and review_reports/ out of git via\n" +
  "          .git/info/exclude; --artifacts=repo tracks them. If any of them is\n" +
  "          already tracked, omitting the flag declares nothing — choose one.\n" +
  "  check   Warn if any generated adapter files are stale vs the installed\n" +
  "          agent-governance-mcp version.\n";

// --- version / template helpers --------------------------------------------

// Resolve the agc package root from this script's own location (mirror
// scripts/check-version.mjs:13-16). NOT process.cwd(): `agc` runs inside a
// target workspace whose package.json is unrelated. import.meta.url reflects
// the real module path in both local-dev and `npx github:` modes.
function pkgRoot() {
  const here = path.dirname(fileURLToPath(import.meta.url)); // <pkg>/bin
  return path.resolve(here, ".."); // <pkg>
}

// Read installed agc version from <pkgRoot>/package.json. Throws if unreadable
// — a broken install should fail loudly, not compare against undefined.
function installedVersion() {
  return JSON.parse(
    fs.readFileSync(path.join(pkgRoot(), "package.json"), "utf-8")
  ).version;
}

// The placeholder every adapter template carries where the version goes.
const AGC_VERSION_TOKEN = "{{AGC_VERSION}}";

// Read an adapter template as shipped, placeholder intact.
function readAdapterTemplate(tplName) {
  return fs.readFileSync(path.join(pkgRoot(), "templates/agent-adapters", tplName), "utf-8");
}

// Read a template, replace every {{AGC_VERSION}} with `version`, return text.
function stampTemplate(tplName, version) {
  return readAdapterTemplate(tplName).split(AGC_VERSION_TOKEN).join(version);
}

// Upsert the marker-delimited block into CLAUDE.md.
//   file absent           -> create CLAUDE.md containing just the block.
//   file present, no block-> append a blank line + block.
//   file present, block   -> replace text between markers (inclusive); prose untouched.
// Returns "created" | "appended" | "updated".
function writeClaudeBlock(cwd, stampedBlock) {
  const target = path.join(cwd, "CLAUDE.md");
  const block = stampedBlock.replace(/\n+$/, ""); // normalize trailing newlines

  if (!fs.existsSync(target)) {
    fs.writeFileSync(target, block + "\n");
    return "created";
  }

  const existing = fs.readFileSync(target, "utf-8");
  const beginIdx = existing.indexOf(CLAUDE_BEGIN);
  const endIdx = existing.indexOf(CLAUDE_END);

  if (beginIdx !== -1 && endIdx !== -1 && endIdx > beginIdx) {
    // Replace the existing block in place (markers inclusive). Atomic:
    // this mutates an EXISTING file that may carry the adopter's own prose
    // outside the markers — same class of exposure as the atomic-write fix
    // used for .config.json below, higher stakes here because that prose
    // is unrecoverable, not regenerable like .config.json.
    const before = existing.slice(0, beginIdx);
    const after = existing.slice(endIdx + CLAUDE_END.length);
    atomicWriteFile(target, before + block + after);
    return "updated";
  }

  // No block present — append after the user's prose. Also an in-place
  // mutation of an EXISTING file (unlike the brand-new-file "created"
  // branch above, which has no prior content to lose) — same exposure and
  // fix as the "updated" branch just above.
  const sep = existing.endsWith("\n") ? "\n" : "\n\n";
  atomicWriteFile(target, existing + sep + block + "\n");
  return "appended";
}

// Atomic write for a file this script mutates IN PLACE (not create-if-
// absent) — tmp file + fs.renameSync, mirroring the existing precedent in
// the module this file writes for (tools/config.ts:326-333
// atomicWriteConfig()), per CLAUDE.md's requirement for any write to a
// governed artifact. Without this, an interruption mid-write (^C, ENOSPC,
// crash) leaves the target truncated or empty — on a real .config.json that
// can mean hundreds of driftBaselineIds silently stop applying.
//
// E102 (decided by the human 2026-09-16: symlinks ARE a supported layout,
// hardlinks are NOT): `target` is resolved through any
// symlink BEFORE `tmpPath` is derived from it. Without this, a symlinked
// `CLAUDE.md` (dotfiles-managed, monorepo-shared) gets DESTROYED rather than
// written through — `renameSync` replaces whatever sits at its destination
// path, and for a symlink destination that means the link itself is
// unlinked and replaced by a detached regular file (POSIX rename(2)
// semantics: a symlink destination is swapped, never followed). The
// canonical file the link points at silently keeps its old content forever,
// and `agc check` then reports OK against the detached copy — the failure
// has no error and looks like success. The precedent for resolving +
// guarding a symlink already exists a few hundred lines below in
// checkWorktreeEvidence's isSafelyLinkedOutside.
//
// fs.realpathSync THROWS (ENOENT) on a DANGLING symlink (one whose target
// does not exist) — the catch below is DEFENSIVE ONLY. Every current call
// site (writeClaudeBlock's two branches, upsertHostKey's existsSync guard
// plus its own readFileSync) pre-guards with fs.existsSync, which returns
// false for a dangling symlink exactly as it does for a plain missing
// path — so realpathSync here never actually observes a dangling symlink
// today. The dangling case is handled earlier and better, at
// writeClaudeBlock's `!existsSync` branch: fs.writeFileSync there follows
// the dangling link and creates the canonical file, leaving the link
// intact — write-through, not fail-closed. This catch exists only so a
// future caller that skips the existsSync guard fails loudly instead of
// silently mis-writing; because a plain missing file produces the exact
// same ENOENT, it is distinguished from an actual dangling symlink via
// lstatSync before the message is chosen, so it never blames a symlink
// that isn't there.
//
// Hardlinks are UNSUPPORTED by decision, not oversight. A hardlink has no
// separate "target" to resolve — it is a second directory entry for the
// very same inode as every other name pointing at that file — so
// fs.realpathSync(target) just returns `target` itself and this fix does
// nothing for it: `renameSync` still breaks a hardlink's second name just
// as silently as it broke a symlink. The only change that would also cover
// hardlinks is reverting this function to a truncating in-place write (no
// tmp file, no rename) — which is exactly the ^C/ENOSPC truncation risk
// this tmp-file-plus-rename design exists to remove on the far more common
// non-linked case. That risk is likelier and worse, so hardlinked adapter
// files are declared out of scope rather than traded against it.
function atomicWriteFile(target, content) {
  let resolvedTarget;
  try {
    resolvedTarget = fs.realpathSync(target);
  } catch (err) {
    if (err && err.code === "ENOENT") {
      // Distinguish the two ENOENT causes instead of assuming a dangling
      // symlink: lstatSync (does not follow the link) tells us whether
      // `target` itself is a symlink at all.
      let isSymlink = false;
      try {
        isSymlink = fs.lstatSync(target).isSymbolicLink();
      } catch {
        // target vanished between the failed realpathSync and this
        // lstatSync (or was never there) — fall through as plain-missing.
      }
      throw new Error(
        isSymlink
          ? `agc: cannot write ${target} — it is a symlink that does not ` +
              `resolve to anything (dangling)`
          : `agc: cannot write ${target} — no such file or directory`
      );
    }
    throw err;
  }

  // E102 / R3-C: preserve the existing file's mode instead of letting a
  // freshly-created tmp file take the process default (0666 & ~umask,
  // typically 0644) — without this, a deliberately-restricted 0600
  // CLAUDE.md silently widens to 0644 on every write through this
  // function. chmodSync (rather than passing `mode` to writeFileSync) is
  // used deliberately: it copies the exact mode regardless of umask, which
  // an open()-time mode does not.
  let mode;
  try {
    mode = fs.statSync(resolvedTarget).mode;
  } catch {
    mode = undefined; // shouldn't happen — resolvedTarget just resolved above
  }

  const tmpPath = `${resolvedTarget}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.writeFileSync(tmpPath, content, "utf-8");
    if (mode !== undefined) fs.chmodSync(tmpPath, mode);
    fs.renameSync(tmpPath, resolvedTarget);
  } finally {
    // E102 / R3-C: a failure between opening tmpPath and the rename above
    // (ENOSPC mid-write is the realistic case) must not strand a partial
    // `.tmp` file beside the target file (the resolved target's directory —
    // e.g. the dotfiles dir a symlinked CLAUDE.md points into, not
    // necessarily the repo). A successful renameSync already
    // consumed tmpPath, so this unlink is a normal no-op on the success
    // path (ENOENT, swallowed) and only does real cleanup on failure.
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // already consumed by a successful rename, or never created
    }
  }
}

// Upsert a top-level "host": "claude-code" key into an EXISTING
// .current/.config.json (E100). Deliberately does NOT parse-and-restringify
// the whole file: a real config.json can carry a large array
// (`driftBaselineIds` — 558 entries in this repo's own workspace at the time
// of writing) that a JSON.stringify round-trip would silently reformat just
// to add one key. Instead this splices the key in next to the opening brace
// (new key) or in place over an existing key's value (repair), reusing the
// file's own indentation, so every other byte in the file — including array
// formatting, key order, and unrelated whitespace — is left untouched.
//   returns "updated"   — key added or repaired, file rewritten
//   returns "has-host"  — a `host` key already holds a non-empty string;
//                         NEVER overwritten (a Cursor / Continue /
//                         Anti-Gravity workspace may legitimately hold a
//                         different declared value)
//   returns "malformed" — not parseable as a JSON object, OR the `host`
//                         key could not be rewritten unambiguously: either
//                         a structurally odd value (array/object) with no
//                         other host-key-shaped text anywhere in the file,
//                         OR — the larger class — a `host`-shaped match
//                         exists but the reparse guard below rejects the
//                         result (e.g. a nested `host` key sorts earlier in
//                         the text than the real top-level one); left
//                         untouched either way
function upsertHostKey(abs) {
  const raw = fs.readFileSync(abs, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "malformed";
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "malformed";
  }

  // Value test, not presence test — MUST mirror the consumer:
  // tools/config.ts:255-258 surfaces `host` only when it is a non-empty
  // string. A `host` key that exists but holds "", null, or false reads as
  // ABSENT to that consumer, so treating hasOwnProperty alone as "declared"
  // silently reinstates the exact E100 defect this function exists to close
  // — permanently, since a plain presence check never becomes false again.
  const hasHostKey = Object.prototype.hasOwnProperty.call(parsed, "host");
  const hostIsDeclared =
    hasHostKey && typeof parsed.host === "string" && parsed.host.length > 0;
  if (hostIsDeclared) {
    return "has-host";
  }

  const updated = spliceTopLevelKey(raw, "host", '"claude-code"', hasHostKey);
  if (updated === null) return "malformed";

  // Load-bearing, not belt-and-braces: this is what makes a wrong-occurrence
  // splice safe. spliceTopLevelKey's key regex is unanchored and matches the FIRST
  // `"host": <scalar>` in the file, which need not be the top-level key
  // (e.g. a nested `host` can sort earlier in the text). `reparsed.host` is
  // the value of the LAST top-level `host` after the splice; since that
  // value was confirmed to NOT already be a non-empty string before the
  // splice ran (`hostIsDeclared` above is false here — the value can be
  // absent, "", null, false, or a truthy non-string like `42` / `{}` /
  // `["x"]`; it is emphatically not always "falsy"), it can only become a
  // non-empty string here if the splice actually hit the top-level
  // occurrence. Any wrong-occurrence splice is caught below and rejected.
  let reparsed;
  try {
    reparsed = JSON.parse(updated);
  } catch {
    return "malformed";
  }
  if (typeof reparsed.host !== "string" || reparsed.host.length === 0) {
    return "malformed";
  }

  atomicWriteFile(abs, updated);
  return "updated";
}

// Byte-preserving splice of one top-level `"<key>": <literal>` pair into the
// raw text of a JSON object — shared by upsertHostKey and upsertArtifactsKey
// so both keep every other byte of the file (array formatting, key order,
// unrelated whitespace) untouched. `key` is always an internal literal (no
// regex metacharacters), never user input. Returns the new text, or null
// when there is nothing safe to splice. Callers MUST reparse the result and
// confirm the top-level value actually changed: the key regex below is
// unanchored, so it can hit a nested occurrence first.
//   hasKey = true  -> repair the EXISTING key's value in place. Inserting a
//                     second copy next to the opening brace would leave two
//                     same-named keys in the text; JSON.parse silently keeps
//                     whichever one is textually last, which is exactly the
//                     ambiguity this splice exists to avoid.
//   hasKey = false -> insert the pair right after the opening brace, reusing
//                     the file's own indentation.
const JSON_SCALAR_SRC = /("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/.source;

function spliceTopLevelKey(raw, key, literal, hasKey) {
  if (hasKey) {
    const m = new RegExp(`("${key}"\\s*:\\s*)` + JSON_SCALAR_SRC).exec(raw);
    if (!m) {
      // No `"<key>": <scalar>` shaped text exists ANYWHERE in the file —
      // only reachable when the top-level value is itself non-scalar
      // (array/object) AND no other key in the file happens to share the
      // name with a scalar value either. Nothing safe to splice.
      //
      // This is NOT the guard against "found a match, but it's the wrong
      // occurrence" — that case (a nested key shadows a top-level one that
      // isn't a usable declared value, e.g. `{"host": [], "nested":
      // {"host": "x"}}`) DOES match here and is spliced; the caller's
      // REPARSE GUARD is what rejects a wrong-occurrence splice.
      return null;
    }
    return raw.slice(0, m.index) + m[1] + literal + raw.slice(m.index + m[0].length);
  }
  const openBrace = raw.indexOf("{");
  if (openBrace === -1) return null;
  const afterBrace = raw.slice(openBrace + 1);
  const leadingWs = /^\s*/.exec(afterBrace)[0];
  const isEmptyObject = afterBrace.slice(leadingWs.length).startsWith("}");
  return isEmptyObject
    ? raw.slice(0, openBrace + 1) + `\n  "${key}": ${literal}\n` + afterBrace
    : raw.slice(0, openBrace + 1) +
        leadingWs +
        `"${key}": ${literal},` +
        leadingWs +
        afterBrace.slice(leadingWs.length);
}

// The two values the "artifacts" config key may hold. Mirrors the server's
// narrow filter in tools/config.ts: any other value reads as undeclared.
function isArtifactsMode(v) {
  return v === "local" || v === "repo";
}

// Upsert a top-level "artifacts": "<value>" key into an EXISTING
// .current/.config.json — the same byte-preserving splice and reparse guard
// as upsertHostKey above, for the same reason (a large driftBaselineIds
// array must not be reformatted just to add one key). One deliberate
// difference: a key already declared with the OTHER valid value IS
// overwritten, because this is only ever called with a value the user asked
// for explicitly (or the fresh-workspace default when nothing is declared)
// — switching local <-> repo is a legitimate request, whereas `host` has no
// such explicit-intent signal.
//   returns "updated"       — key added, repaired, or switched; file rewritten
//   returns "has-artifacts" — already declared with exactly this value;
//                             file left byte-identical
//   returns "malformed"     — not parseable as a JSON object, or the key
//                             could not be rewritten unambiguously; left
//                             untouched
function upsertArtifactsKey(abs, value) {
  const raw = fs.readFileSync(abs, "utf-8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return "malformed";
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "malformed";
  }
  if (parsed.artifacts === value) return "has-artifacts";

  const hasKey = Object.prototype.hasOwnProperty.call(parsed, "artifacts");
  const updated = spliceTopLevelKey(raw, "artifacts", JSON.stringify(value), hasKey);
  if (updated === null) return "malformed";

  // Load-bearing for the same reason as upsertHostKey's guard: the
  // top-level value was confirmed NOT to equal `value` above, so it can
  // only equal it now if the splice hit the top-level occurrence.
  let reparsed;
  try {
    reparsed = JSON.parse(updated);
  } catch {
    return "malformed";
  }
  if (reparsed === null || typeof reparsed !== "object" || reparsed.artifacts !== value) {
    return "malformed";
  }

  atomicWriteFile(abs, updated);
  return "updated";
}

// The already-declared value in an existing config, or undefined when the
// file is absent, unparseable, or holds no valid "artifacts" value. Read-only;
// a malformed file is reported later by the upserts themselves.
function readDeclaredArtifacts(abs) {
  try {
    const parsed = JSON.parse(fs.readFileSync(abs, "utf-8"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && isArtifactsMode(parsed.artifacts)) {
      return parsed.artifacts;
    }
  } catch {
    // absent / unreadable / unparseable — undeclared
  }
  return undefined;
}

// --- subcommand: init ------------------------------------------------------
// Parse `agc init`'s arguments. Only --artifacts is recognised; any other
// argument is ignored, as before the flag existed. An invalid value throws a
// usage error BEFORE anything is written, so a typo never leaves a partial
// scaffold behind. Returns { artifacts } — undefined when the flag is omitted.
function parseInitArgs(argv) {
  let artifacts;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--artifacts") {
      artifacts = i + 1 < argv.length ? argv[++i] : "";
    } else if (a.startsWith("--artifacts=")) {
      artifacts = a.slice("--artifacts=".length);
    }
  }
  if (artifacts !== undefined && !isArtifactsMode(artifacts)) {
    throw usageError(
      `agc init: --artifacts must be "local" or "repo" (got ${JSON.stringify(artifacts)})`
    );
  }
  return { artifacts };
}

function runInit(cwd, argv = []) {
  // NOTE (E34): no .current/<lane>/handoff.md is scaffolded here. The transition
  // matrix's only fresh-workspace key is null:null — "handoff.md absent" —
  // so ANY seeded (last_agent, status) tuple (the old pm:Not_Started
  // template, or even an empty-status pm:null) has no ALLOWED_TRANSITIONS
  // entry and rejects every subsequent tw_update_state. The first
  // pm:In_Progress write creates the file through the normal null:null edge.

  // Everything that can fail on bad input or an unusable git setup runs
  // before the first write, so a failure leaves the directory untouched.
  const { artifacts: requested } = parseInitArgs(argv);
  const repoRoot = resolveRepoRootOrNull(cwd); // null = not inside a git repo
  // Rules and pathspecs are anchored at the workspace, not at the repo root:
  // run from a subdirectory, the scaffold lands there and so must the rules.
  const workspace = repoRoot === null ? null : repoRelativeWorkspacePrefix(repoRoot, cwd);
  const tracked = repoRoot === null ? [] : trackedArtifactPaths(repoRoot, artifactPathsForPrefix(workspace.prefix));

  const configRel = ".current/.config.json";
  const configAbs = path.join(cwd, configRel);
  const declared = readDeclaredArtifacts(configAbs);

  // Effective mode: an explicit flag wins; otherwise keep what is already
  // declared; otherwise default to "local" — but only on a tree where no
  // artifact path is tracked yet. On a tree that already tracks one, a
  // silent "local" would add exclude rules that do nothing for those files
  // and record a choice the user never made, so nothing is declared and the
  // user is asked to pick (mode = null).
  let mode;
  if (requested !== undefined) mode = requested;
  else if (declared !== undefined) mode = declared;
  else mode = tracked.length > 0 ? null : "local";
  // Only write the key when the user asked for a value, or when the default
  // applies to an undeclared workspace. An already-declared value re-read
  // without a flag is left byte-identical.
  const keyValue = requested !== undefined ? requested : declared === undefined ? mode : null;

  // A workspace path segment with a character unsafe for a gitignore exclude
  // rule (see GITIGNORE_UNSAFE_SEGMENT_RE) cannot be turned into an exclude
  // rule that matches exactly the scaffold, so local mode refuses here —
  // before any write. "repo" never writes the exclude file, and outside git
  // there is no exclude file, so neither is affected.
  if (mode === "local" && workspace !== null && workspace.unsafeSegment !== null) {
    throw usageError(
      `agc init: refusing --artifacts=local — workspace path segment "${escapeSegmentForDisplay(workspace.unsafeSegment)}" ` +
        `contains a character unsafe for a gitignore exclude rule (a wildcard, a backslash, or a control character), ` +
        `so the exclude rule agc would write could match unintended files or be split across lines. ` +
        `Rename the directory, or re-run with --artifacts=repo.`
    );
  }

  const configTemplate =
    `{
  "schema_version": 2,
  "host": "claude-code"` +
    (keyValue ? `,\n  "artifacts": ${JSON.stringify(keyValue)}` : "") +
    `
}
`;

  const tasksTemplate = `# Tasks

<!-- Append via tw_add_task. -->

## Completed

<!-- tw_complete_task will move items here -->
`;

  const created = [];
  const skipped = [];
  const updated = [];
  const notUpdated = [];
  const warnings = [];
  const notices = []; // extra stdout lines
  const errBlocks = []; // multi-line stderr messages, printed verbatim
  let artifactsRecorded = false;

  // .current/.config.json — special-cased (E100): a brand-new workspace
  // gets the full template (already carries "host", and "artifacts" when a
  // value is being recorded); an EXISTING file gets in-place key upserts
  // rather than a blanket skip, so re-running `agc init` in a workspace that
  // predates either key still gains it. .current/ itself is created by the
  // mkdirSync in this block — the loop below (remaining scaffolding) never
  // creates .current/.
  {
    if (!fs.existsSync(configAbs)) {
      fs.mkdirSync(path.dirname(configAbs), { recursive: true });
      fs.writeFileSync(configAbs, configTemplate);
      created.push(configRel);
      artifactsRecorded = Boolean(keyValue);
    } else {
      const hostResult = upsertHostKey(configAbs);
      const artifactsResult = keyValue ? upsertArtifactsKey(configAbs, keyValue) : "has-artifacts";
      artifactsRecorded = artifactsResult !== "malformed" && (keyValue !== null || declared !== undefined);
      const results = [hostResult, artifactsResult];
      if (hostResult === "malformed") {
        warnings.push(
          `${configRel}: could not add "host" — left untouched (not valid JSON, ` +
            `or the "host" key could not be rewritten unambiguously)`
        );
      }
      if (artifactsResult === "malformed") {
        warnings.push(
          `${configRel}: could not add "artifacts" — left untouched (not valid JSON, ` +
            `or the "artifacts" key could not be rewritten unambiguously)`
        );
      }
      if (results.includes("updated")) {
        updated.push(configRel);
      } else if (results.includes("malformed")) {
        // Left byte-identical. Reported in its own bucket, NOT "skipped":
        // this file was rejected, not left alone because it was already
        // correct, and a caller scripting against the structured stdout
        // bucket lists (created/updated/skipped/not updated) needs to be
        // able to tell the two apart without having to parse the free-text
        // stderr warning below for the distinction.
        notUpdated.push(configRel);
      } else {
        skipped.push(configRel);
      }
    }
  }

  // Git-side half of the artifacts choice. "repo" writes nothing here: a
  // stale exclude line left by an earlier "local" run has no effect once the
  // path is tracked, so there is nothing to clean up.
  if (mode === "local") {
    if (repoRoot === null) {
      if (artifactsRecorded) {
        errBlocks.push(
          `agc init — note: not inside a git repository — skipped .git/info/exclude; ` +
            `recorded "artifacts": "local" in .current/.config.json`
        );
      }
    } else {
      const added = upsertSharedExclude(repoRoot, artifactExcludeRulesForPrefix(workspace.prefix));
      if (added.length > 0) {
        notices.push(`agc init — added ${added.join(", ")} to the shared info/exclude`);
      }
      if (tracked.length > 0) {
        // Report only. Untracking is left to the user: `git rm --cached`
        // stages deletions for every teammate and cannot remove the files
        // from history, so it must be a deliberate human act.
        errBlocks.push(
          `agc init — warning: the following artifact path(s) are already tracked in this repo — ` +
            `the exclude rule just added has no effect on tracked files:\n` +
            tracked.map((t) => `  ${t.display}`).join("\n") +
            // The targets are repo-relative; from a subdirectory workspace
            // they only resolve when pasted at the repo root, so say so.
            `\nUntrack them with${workspace.prefix === "" ? "" : " (run from the repository root)"}:\n` +
            `  git rm -r --cached ${tracked.map((t) => t.target).join(" ")}\n` +
            `Note: history still contains these files after that command.`
        );
      }
    }
  } else if (mode === null) {
    errBlocks.push(
      `agc init — the following artifact path(s) are already tracked in this repo:\n` +
        tracked.map((t) => `  ${t.display}`).join("\n") +
        `\nNot defaulting to "local" automatically — re-run with --artifacts=local ` +
        `or --artifacts=repo to choose explicitly.`
    );
  }

  // Remaining scaffolding (preserved verbatim; skip-if-exists).
  const files = [{ rel: "tasks.md", content: tasksTemplate }];
  for (const { rel, content } of files) {
    const abs = path.join(cwd, rel);
    if (fs.existsSync(abs)) {
      skipped.push(rel);
      continue;
    }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
    created.push(rel);
  }

  // Per-agent entry adapters.
  const ver = installedVersion();
  for (const { rel, tpl, mode } of ADAPTERS) {
    if (mode === "upsert") {
      const result = writeClaudeBlock(cwd, stampTemplate(tpl, ver));
      if (result === "updated" || result === "appended") {
        updated.push(rel); // both mean the file pre-existed
      } else {
        created.push(rel); // "created" — brand-new file
      }
      continue;
    }
    // mode === "skip" — checked for the same non-atomic-write exposure as
    // writeClaudeBlock: NOT exposed. This branch only ever
    // writes when `abs` does not already exist (the guard immediately
    // below); an existing file — adopter prose included — is always left
    // in the `skipped` bucket, untouched. There is no in-place mutation
    // here to make atomic; the write below creates a file that had no
    // prior content to lose, matching the "created" branch of
    // writeClaudeBlock and the brand-new-.config.json path above.
    const abs = path.join(cwd, rel);
    if (fs.existsSync(abs)) {
      skipped.push(rel);
      continue;
    }
    fs.writeFileSync(abs, stampTemplate(tpl, ver));
    created.push(rel);
  }

  if (created.length > 0) {
    process.stdout.write(`Created: ${created.join(", ")}\n`);
  }
  if (updated.length > 0) {
    process.stdout.write(`Updated: ${updated.join(", ")}\n`);
  }
  if (skipped.length > 0) {
    process.stdout.write(`Skipped (already exists): ${skipped.join(", ")}\n`);
  }
  if (notUpdated.length > 0) {
    process.stdout.write(
      `Not updated (rejected, see warnings): ${notUpdated.join(", ")}\n`
    );
  }
  for (const n of notices) {
    process.stdout.write(`${n}\n`);
  }
  for (const w of warnings) {
    process.stderr.write(`agc init — warning: ${w}\n`);
  }
  for (const b of errBlocks) {
    process.stderr.write(`${b}\n`);
  }
  if (
    created.length === 0 &&
    updated.length === 0 &&
    notUpdated.length === 0 &&
    notices.length === 0 &&
    skipped.length > 0
  ) {
    process.stdout.write("All files already exist — nothing to do.\n");
  }
}

// --- research/ binary-residue advisory (E104 prevention (c)) ---------------
// E104: 33 third-party confidential screenshots sat under research/assets/ in
// a public repo for ~3 months. .gitignore now excludes research/assets/ and
// CONTRIBUTING.md documents the convention (both shipped separately); this is
// the mechanical check that a tracked binary hasn't slipped past that
// convention regardless.
//
// Classification: an extension allowlist against `git ls-files` output (the
// same allowlist used to measure this repo's zero-tracked-binary baseline),
// not a content-sniff. Trade-off: an extensionless or exotic-format binary
// can slip through undetected (false negative), but a text file is never
// misclassified as binary (no false positive from content heuristics on
// e.g. large fixture text/JSON). For an advisory check the missed catch is
// the acceptable side of that trade.
const RESEARCH_BINARY_RE = /\.(png|jpe?g|gif|pdf|fig|sketch|xd|webp|mp4|zip)$/i;

// Advisory only — WARN, never a hard exit, unlike the stale-adapter check
// below. `research/` is this repo's OWN naming convention, not a contract
// every agc adopter shares: an adopter may have an unrelated research/
// directory that legitimately holds versioned binaries (datasets, sample
// PDFs, model checkpoints). `agc check` is a public CLI run in arbitrary
// adopter workspaces, so a false positive there — failing an unrelated
// release over a path-name collision we don't control — is worse than this
// repo missing a regression we would also catch via review/dogfooding of
// our own tree. Scoped to the `research` pathspec so it is a silent no-op
// for the overwhelming majority of adopters who have no such directory.
function checkResearchBinaries(cwd) {
  let out;
  try {
    // `-z` (NUL-terminated, unquoted paths) is load-bearing, not cosmetic:
    // git's default core.quotePath=true C-quotes any path with non-ASCII
    // bytes (e.g. a CJK filename), which both breaks a plain "\n" split on
    // an embedded-newline name AND, worse, wraps quoted lines in a trailing
    // `"` that the $-anchored regex below would never match — silently
    // missing exactly the tracked-binary case (localized-name client
    // assets) this check exists to catch. `execFileSync` with an argv array
    // (not `execSync` with a shell string) means there is no shell to
    // inject through even though every argument here is a fixed literal.
    // Fails (ENOENT / exit 128) when git is missing, this isn't a git repo,
    // or the repo has zero commits — all handled uniformly by the catch
    // below; no separate "is this a repo" probe is needed since ls-files
    // itself already fails closed in every one of those cases.
    out = execFileSync("git", ["ls-files", "-z", "--", "research"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return;
  }

  const hits = out
    .split("\0")
    .filter((line) => line.length > 0 && RESEARCH_BINARY_RE.test(line));

  for (const hit of hits) {
    process.stderr.write(
      `agc check — warning: tracked binary under research/: ${hit} — keep binary design/research sources workspace-local, don't commit them\n`
    );
  }
}

// --- linked-worktree evidence advisory (E111 prevention) --------------------
// E111: a lane git worktree bootstrapped without the symlink-back-to-primary
// discipline (content/coord-03-core-fallback.md's Feature-Scope Gate
// bootstrap obligation) ends up with REAL, gitignored copies of qa_reports/,
// review_reports/, and specs/ instead of links — and `git worktree remove`
// deletes a lane's entire code-review + QA evidence trail along with it.
// Measured 2026-09-08 (docs/agc-feedback-2026-09-08.md H2 (a) + H2-b B1):
// 4 of 7 tickets had zero evidence copy left in primary, all four PASS and
// therefore teardown-eligible. The mechanism this check backs up is the
// bootstrap symlink itself; this is the belt-and-suspenders detector for
// when that step was skipped.
//
// Worktree detection: a LINKED worktree has a `.git` FILE (git's "gitdir:
// <path>" gitfile) rather than a `.git` directory — that is git's own
// on-disk signal, not a path-name heuristic, so a primary checkout can never
// false-positive on its name and a linked worktree can never false-negative
// on its own. Silent no-op in a primary checkout (no `.git` file to trip
// it).
//
// Per-directory trigger: warn when EITHER —
//   (a) the directory is a REAL directory (not a symlink) that is either —
//         - completely EMPTY: the one moment remediation is free (`rmdir &&
//           ln -s` loses nothing before there's any content to move). A
//           correct bootstrap always yields a symlink and git can never
//           track an empty directory, so "tracked and empty" can't reach
//           this branch — zero false-positive cost. OR
//         - holding at least one file git's index doesn't know about (see
//           hasUntrackedContent below) THAT IS ALSO either itself ignored
//           (see hasIgnoredUntrackedContent below) or backed by zero
//           tracked files at all (see hasTrackedContent below). That second
//           clause exists so a directory this repo already tracks
//           (qa_reports/, review_reports/, specs/ here) stays SILENT even
//           when one file in it is a plain untracked straggler (e.g. an
//           uncommitted report) — the remedy there is "commit it", not
//           "symlink the whole tracked directory away", which would stage
//           a mass deletion. A gitignored evidence dir (the E111 defect
//           shape) or a plain untracked dir with zero tracked files still
//           warns, OR
//   (b) the entry IS a symlink, but does not resolve OUTSIDE this worktree
//       (see isSafelyLinkedOutside below) — a link into the lane itself, or
//       a dangling link, protects nothing.
// This repo tracks all three (qa_reports/, review_reports/, specs/) with
// tracked content, so an incidental untracked straggler (an uncommitted
// report mid-review, say) stays silent here too; the check exists for
// adopter workspaces where those directories are gitignored, or are real
// but hold no tracked files at all.
//
// Advisory only — WARN to stderr, never affects the exit code, same as
// checkResearchBinaries above. It also has no enforcement teeth by design:
// a qa-owned fixture test under test/ proves this detection logic against a
// synthetic linked worktree; this is a human-facing nudge, not a gate — do
// not compensate here by trying to make it fail closed harder than that.
//
// Known, accepted false positives (re-derive from first principles before
// assuming either still holds): a git submodule working tree with
// untracked evidence dirs still warns — advisory/exit-0, and disambiguating
// a submodule gitfile from a worktree one isn't worth the complexity for a
// warning that's harmless when wrong; a directory tracked under a different
// case on a case-insensitive filesystem is currently silent as a side
// effect of the tracked-dir-straggler exemption above, not by original
// design.
const WORKTREE_EVIDENCE_DIRS = ["qa_reports", "review_reports", "specs"];

function isLinkedWorktree(cwd) {
  try {
    return fs.statSync(path.join(cwd, ".git")).isFile();
  } catch {
    return false;
  }
}

// A real directory with zero entries at all — no
// tracked files (git can't track an empty directory) and no untracked ones
// either — is the state a lane ends up in right after `mkdir -p
// qa_reports review_reports specs` and before anything is written into
// them. `git ls-files --others` reports nothing for an empty directory (an
// empty dir isn't a "file" to walk), so hasUntrackedContent below is
// necessarily silent here; this is a plain fs-level check that doesn't
// depend on git at all. Fails closed to "not empty" on any read error (e.g.
// permission denied) so it falls through to the untracked-content check
// instead of risking a false positive somewhere this can't be evaluated.
function isEmptyDir(target) {
  try {
    return fs.readdirSync(target).length === 0;
  } catch {
    return false;
  }
}

// Deliberately NOT `git ls-files -- rel` (index-membership under rel): a
// single force-added placeholder (the near-universal `git add -f
// qa_reports/.gitkeep` pattern for a gitignored dir) makes that predicate
// return true for the WHOLE directory even though real, untracked evidence
// sits right next to the placeholder — the exact state a lane worktree
// ends up in. The property
// that actually matters is "does this directory hold any file the index
// does NOT have", so this asks `--others` instead, deliberately WITHOUT
// `--exclude-standard`: with it, an ignored-and-untracked file (the
// gitignored-evidence-dir case this check exists for) is filtered back out
// and the hole reopens; without it, `--others` reports every untracked
// file regardless of ignore status, which is the one property a symlink
// vs. a real directory actually differs on. Verified against both shapes
// directly: a gitignored dir holding a tracked `.gitkeep` + untracked real
// file, and a tracked-and-clean dir with one new not-yet-added file — only
// the first two must warn, `--others` alone (no `--exclude-standard`)
// reports non-empty for both and empty for a fully-tracked, fully-clean
// directory.
function hasUntrackedContent(cwd, rel) {
  try {
    // Same `-z` / NUL-split / execFileSync-argv discipline as
    // checkResearchBinaries above, and the same fail-closed-and-silent
    // catch (git absent, not a repo, zero commits): on error we report "no
    // untracked content" so the caller skips the warning rather than
    // risking a false positive in an environment this check cannot
    // actually evaluate.
    const out = execFileSync("git", ["ls-files", "-z", "--others", "--", rel], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\0").some((line) => line.length > 0);
  } catch {
    return false;
  }
}

// The distinguisher this check exists for: a directory holding untracked
// content should still warn when that content is the ONLY thing in it
// (gitignored evidence dirs, or a plain untracked dir with nothing tracked
// yet — the defect's central shapes), but must stay silent when the
// directory is one this repo already tracks and the untracked file is
// merely a straggler (e.g. an uncommitted report mid-review) — the remedy
// there is "commit it", not "symlink the whole directory away".
//
// This is deliberately NOT `git check-ignore` on the DIRECTORY path — an
// earlier candidate that does not survive measurement against a
// force-added tracked `.gitkeep` inside a gitignored dir: once a directory
// holds even one tracked file, git must walk into it to reach that file, so
// `check-ignore`
// on the directory itself reports "not ignored" even though the gitignore
// rule still applies to every untracked file inside it. Measured directly
// on that exact shape: `git check-ignore -q -- review_reports` exits 1
// (not ignored) while `git check-ignore -q -- review_reports/report.md`
// (the untracked file itself) exits 0 (ignored). Checking file-by-file
// instead of directory-by-directory survives that quirk, so this asks
// whether any UNTRACKED file under the directory is itself ignored —
// `--others --ignored --exclude-standard` is the ls-files incantation for
// exactly that set. Same fail-closed-and-silent catch as the others above.
function hasIgnoredUntrackedContent(cwd, rel) {
  try {
    const out = execFileSync(
      "git",
      ["ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--", rel],
      { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }
    );
    return out.split("\0").some((line) => line.length > 0);
  } catch {
    return false;
  }
}

// The other half of the distinguisher above: a directory with zero tracked files
// is indistinguishable from a fresh gitignored evidence dir even when it
// isn't itself gitignored (e.g. an adopter who .gitignore'd nothing but
// also never committed anything under qa_reports/), so it must still warn.
// Same `-z` / NUL-split / execFileSync-argv / fail-closed-and-silent
// discipline as hasUntrackedContent above — on error this reports "zero
// tracked files", which only matters when hasUntrackedContent also
// evaluated true in the same environment, and that call fails closed the
// same way, so the two never disagree in a way that manufactures a warning.
function hasTrackedContent(cwd, rel) {
  try {
    const out = execFileSync("git", ["ls-files", "-z", "--", rel], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split("\0").some((line) => line.length > 0);
  } catch {
    return false;
  }
}

// The only shape that survives `git worktree remove` is a symlink
// whose target resolves to a real path OUTSIDE this worktree (i.e. back to
// primary, or anywhere else that isn't torn down with the lane). A symlink
// resolving INSIDE the lane (e.g. `qa_reports -> ./local-eviddir`) is
// deleted along with its target by the same `worktree remove`, and a
// dangling symlink protects nothing by construction — both must still
// warn, not be treated as "already linked".
function isSafelyLinkedOutside(cwd, target) {
  let real;
  try {
    real = fs.realpathSync(target);
  } catch {
    return false; // dangling symlink — cannot resolve, so cannot be "outside"
  }
  let realCwd;
  try {
    realCwd = fs.realpathSync(cwd);
  } catch {
    return false;
  }
  return real !== realCwd && !real.startsWith(realCwd + path.sep);
}

function checkWorktreeEvidence(cwd) {
  if (!isLinkedWorktree(cwd)) return;

  for (const rel of WORKTREE_EVIDENCE_DIRS) {
    const target = path.join(cwd, rel);
    let st;
    try {
      st = fs.lstatSync(target);
    } catch {
      continue; // absent entirely — nothing to warn about
    }

    if (st.isSymbolicLink()) {
      if (isSafelyLinkedOutside(cwd, target)) continue; // resolves outside this worktree — protected
      // falls through to warn: dangling, or resolves inside the lane itself.
      // These are two different diagnoses for a reader, so say which one
      // fired instead of a disjunction that's half-false either way.
      let dangling;
      try {
        fs.realpathSync(target);
        dangling = false;
      } catch {
        dangling = true; // cannot resolve at all
      }
      process.stderr.write(
        dangling
          ? `agc check — warning: ${rel}/ is a symlink that does not resolve to anything (dangling) in a linked git worktree — point it at a location outside this worktree (e.g. the primary checkout) before build, so its code-review/QA evidence survives \`git worktree remove\`\n`
          : `agc check — warning: ${rel}/ is a symlink that resolves INSIDE this worktree instead of outside it, in a linked git worktree — point it at a location outside this worktree (e.g. the primary checkout) before build, so its code-review/QA evidence survives \`git worktree remove\`\n`
      );
      continue;
    }

    if (!st.isDirectory()) continue; // neither a symlink nor a directory — n/a

    if (!isEmptyDir(target)) {
      // Non-empty real directory: warn only when it holds untracked content
      // (the empty-dir case above skips straight through to the warn below)
      // AND that content isn't just a straggler in a directory this repo
      // already tracks — i.e. it's gitignored, or has zero tracked files at
      // all, so a symlink is the only fix available.
      if (!hasUntrackedContent(cwd, rel)) continue; // no untracked content at risk here
      if (!hasIgnoredUntrackedContent(cwd, rel) && hasTrackedContent(cwd, rel)) continue; // tracked dir + an untracked, non-ignored straggler — diagnosis is "commit it", not "symlink the dir away"
    }
    // else: real directory, completely empty — falls through to warn
    // unconditionally; see isEmptyDir above for why this has no
    // false-positive cost.

    process.stderr.write(
      `agc check — warning: ${rel}/ is a real, untracked directory in a linked git worktree — symlink it back to a location outside this worktree (e.g. the primary checkout) before build, so its code-review/QA evidence survives \`git worktree remove\`\n`
    );
  }
}

// E179 AC5 — orphan-lane advisory. A local branch whose committed
// `.current/<lane>/pending-tickets.md` still holds an unapplied entry but has
// no live worktree is a lane whose findings may be stranded. Every git read
// here is repo-global (branch refs, their trees, the worktree list), so the
// output is byte-identical from the primary checkout and from any lane —
// unlike checkWorktreeEvidence, this is deliberately NOT gated on
// isLinkedWorktree. Candidates are ALL local branches (DR-6: an orphan by
// definition has no worktree entry); `git worktree list` supplies only the
// live set, and an entry whose directory is gone (removed without finish,
// not yet pruned) is not live (DR-9). Own-lane only (spec AC5, E179-NEW-2
// option (a), human ruling 2026-09-25): a branch is judged ONLY by
// `.current/<its own lane>/pending-tickets.md`, where its lane is what
// resolveCurrentLane would name it (`feat/<id>-*` -> `<id>`); a branch that
// resolves to no lane is skipped, and another lane's file the branch happens
// to carry (forked from base between that lane's merge and its finish) is
// never read. Never `.current/history/` — S1 DECIDED by E125b (spec AC4):
// the scan does not need to read history/, because `agc feature finish
// --shipped` (the only writer into `.current/history/`) also deletes the
// lane's branch, so a closed lane is never a candidate here in the first
// place (candidates come from refs/heads/ only). That is a structural
// non-applicability, not a relaxation of what "orphan" means. Advisory:
// never throws, never exits, never affects the exit code.
async function checkOrphanLanes(cwd) {
  let probe;
  try {
    probe = gitTry(cwd, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return; // git not installed — nothing to scan
  }
  if (probe.status !== 0 || probe.stdout.trim() !== "true") return;
  try {
    const [lp, ta] = await Promise.all([loadLanePaths(), loadTicketAllocation()]);
    const filename = lp.laneFile("pendingTickets").filename;
    const live = listWorktrees(cwd)
      .filter((w) => w.branch && w.branch.startsWith("refs/heads/") && fs.existsSync(w.path))
      .map((w) => w.branch.slice("refs/heads/".length));
    const refs = git(cwd, ["for-each-ref", "--format=%(refname)", "refs/heads/"])
      .split("\n")
      .filter((r) => r.length > 0);
    const candidates = [];
    const laneOf = new Map(); // branch -> its own lane
    for (const ref of refs) {
      const branch = ref.slice("refs/heads/".length);
      // The branch -> lane mapping resolveCurrentLane applies to a checked-out
      // HEAD: `feat/<rest>` with a leading ticket id, via the same
      // TICKET_ID_RE owner (resolveLaneName). Anything else has no lane.
      if (!branch.startsWith("feat/")) continue;
      const lane = lp.resolveLaneName(branch.slice("feat/".length));
      if (lane === lp.LEGACY_LANE || !lp.isSafeLaneName(lane) || lp.NON_LANE_DIRS.has(lane)) continue;
      const text = readBlob(cwd, ref, path.posix.join(".current", lane, filename));
      // Two-argument parse (E124 AC7's contract): no backlog cross-check.
      const has = text !== null && ta.parsePendingTickets(text, lane).entries.length > 0;
      laneOf.set(branch, lane);
      candidates.push({ branch, hasUnappliedPendingTickets: has });
    }
    for (const branch of ta.detectOrphanLanes(candidates, live).orphans) {
      process.stderr.write(
        `agc check — warning: branch ${branch} carries an unapplied pending-tickets file ` +
          `with no live worktree — findings may be stranded; re-attach it ` +
          `(\`git worktree add <dir> ${branch}\`) and run \`agc feature finish --abandoned ` +
          `${laneOf.get(branch)}\` to apply and retire it, or investigate why the worktree is gone\n`
      );
    }
  } catch (err) {
    process.stderr.write(
      `agc check — warning: orphan-lane scan skipped (${err && err.message ? err.message : String(err)})\n`
    );
  }
}

// --- artifacts declared-vs-actual advisory ---------------------------------
// Compares the "artifacts" choice recorded by `agc init` against the repo's
// real state, so a mismatch is caught before it reaches a shared branch.
// Advisory only — WARN to stderr, never affects the exit code, like the
// other advisories above (a workspace-local drift signal, not a stale
// install). Read straight from the file rather than via the server's
// loadConfig, which heal-writes on read; `agc check` must not write.
//   undeclared -> one line, unconditionally (no git state is consulted)
//   "local"    -> a line if any of the workspace's artifact exclude rules is
//                 missing from the shared exclude, plus one per tracked
//                 artifact path
//   "repo"     -> a line if any of the workspace's artifact exclude rules is
//                 present; the test is on those exact strings, so
//                 LANE_EXCLUDE_RULES entries written by `agc feature start`
//                 never trip it
// "The workspace's rules" are artifactExcludeRulesForPrefix() for `cwd`'s
// repo-relative prefix — the same set `agc init` would write from `cwd` — so
// a root workspace and a subdirectory workspace in one repo never count each
// other's rules. A "local" workspace whose path has a gitignore-wildcard
// segment gets one "cannot verify" line instead: `agc init` refuses to write
// rules there, and testing a pattern that may not mean what it spells would
// give a wrong answer either way.
// Silent when there is no parseable .current/.config.json at all (not an agc
// workspace, or a broken config the server already reports), and silent on
// the git-dependent branches outside a git repo or on any git failure.
function checkArtifactsDrift(cwd) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(path.join(cwd, ".current", ".config.json"), "utf-8"));
  } catch {
    return;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return;
  const declared = isArtifactsMode(parsed.artifacts) ? parsed.artifacts : undefined;
  if (declared === undefined) {
    process.stderr.write("agc check — artifacts undeclared — run agc init --artifacts=local|repo\n");
    return;
  }

  let repoRoot;
  let workspace;
  let excludeLines;
  try {
    repoRoot = resolveRepoRootOrNull(cwd);
    if (repoRoot === null) return;
    workspace = repoRelativeWorkspacePrefix(repoRoot, cwd);
    excludeLines = readSharedExclude(repoRoot).lines;
  } catch {
    return;
  }
  const drift = (fact) =>
    process.stderr.write(`agc check — artifacts drift: config declares "${declared}" but ${fact}\n`);
  const rules = artifactExcludeRulesForPrefix(workspace.prefix);

  if (declared === "local") {
    if (workspace.unsafeSegment !== null) {
      process.stderr.write(
        `agc check — cannot verify artifacts drift: workspace path segment "${escapeSegmentForDisplay(workspace.unsafeSegment)}" ` +
          `contains a character unsafe for a gitignore exclude rule (a wildcard, a backslash, or a control character) ` +
          `— rename the directory, or declare artifacts explicitly via agc init --artifacts=repo\n`
      );
      return;
    }
    if (rules.some((rule) => !excludeLines.has(rule))) {
      drift("exclude rules are missing from .git/info/exclude");
    }
    let tracked = [];
    try {
      tracked = trackedArtifactPaths(repoRoot, artifactPathsForPrefix(workspace.prefix));
    } catch {
      tracked = [];
    }
    for (const { display } of tracked) {
      drift(`${display} is tracked despite local mode`);
    }
  } else if (rules.some((rule) => excludeLines.has(rule))) {
    drift("an artifact exclude rule is present in .git/info/exclude despite repo mode");
  }
}

// Information-hygiene scan (e234-hygiene-scan). The scan logic lives in the
// compiled dist/tools/hygiene-scan.js, loaded like loadLanePaths. Returns null
// instead of throwing: agc check must never fail over an advisory.
async function loadHygieneScan() {
  try {
    return await import(new URL("../dist/tools/hygiene-scan.js", import.meta.url).href);
  } catch {
    return null;
  }
}

// Advisory only: every branch returns normally and nothing here touches the
// exit code. A load failure prints fixed text, never the raw import error,
// because that message carries the install's absolute file URL.
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

// --- subcommand: check -----------------------------------------------------
async function runCheck(cwd) {
  checkResearchBinaries(cwd); // advisory; never affects exit code
  checkWorktreeEvidence(cwd); // advisory; never affects exit code
  await checkOrphanLanes(cwd); // advisory; never affects exit code
  checkArtifactsDrift(cwd); // advisory; never affects exit code
  await checkHygiene(cwd); // advisory; never affects exit code

  const ver = installedVersion();
  const stale = [];
  let present = 0;

  for (const { rel } of ADAPTERS) {
    const target = path.join(cwd, rel);
    if (!fs.existsSync(target)) continue; // absent is not a stale condition
    present++;
    const m = STAMP_RE.exec(fs.readFileSync(target, "utf-8"));
    const stamped = m ? m[1] : "(none)";
    if (stamped !== ver) {
      stale.push({ file: rel, stamped, installed: ver });
    }
  }

  if (stale.length > 0) {
    for (const s of stale) {
      process.stderr.write(
        `agc check — stale adapter: ${s.file} (stamped ${s.stamped}, installed ${s.installed})\n`
      );
    }
    process.exit(1);
  }

  if (present > 0) {
    process.stdout.write(`agc check — OK (${ver}) — all adapters current\n`);
    process.exit(0);
  }

  // No adapters present — silent, exit 0.
  process.exit(0);
}

// --- subcommand: feature (E73) ---------------------------------------------
// `agc feature start` / `agc feature finish` — lane lifecycle plumbing on top
// of `git worktree`. Mechanism only (specs/e73-agc-feature-lifecycle.md):
// whether lanes are the default workflow is E130. Applying/numbering pending-
// ticket files at finish time and `agc check`'s orphan-lane advisory are
// E179 (E124b) — see "finish-time pending-ticket apply" below.
//
// Lane naming has exactly ONE source of truth: tools/lane-paths.ts's
// TICKET_ID_RE, reached only through its exported functions (resolveLaneName
// to validate a slug before any git mutation, resolveCurrentLane to name the
// lane a checked-out branch belongs to). No second copy of the pattern lives
// here, and no lane name is ever persisted to a tracked file (E123 F1-S0).
//
// Every git call is execFileSync with an argv array (no shell), matching the
// house pattern above. `.env` is only ever byte-copied with fs.copyFileSync —
// its contents are never read into a JS string, logged, or returned (§6).

const STR_USAGE_FEATURE =
  "  feature start <ticket-slug> [--base <branch>] [--path <dir>]\n" +
  "          Cut a lane from the primary checkout: branch feat/<ticket-slug>\n" +
  "          (from --base, default main) + a linked git worktree at --path\n" +
  "          (default <parent>/<repo>-lanes/<ticket-id>), node_modules\n" +
  "          symlinked to primary's, .env byte-copied.\n" +
  "  feature finish <ticket-id> (--shipped|--abandoned) [--base <branch>] [--pr <n>]\n" +
  "          Tear a lane down from the primary checkout. --shipped requires\n" +
  "          the branch merged into --base (default main), moves the lane's\n" +
  "          .current/<lane>/ into .current/history/<YYYY-MM>/<lane>/, records a\n" +
  "          lane_closed pointer (pr=<n> from --pr, else none) under\n" +
  "          tasks.md's ## Closed Lanes, commits both on --base, then removes the\n" +
  "          worktree and deletes the branch; --abandoned moves the lane's\n" +
  "          qa_reports/ + review_reports/ evidence into abandoned/<ticket-id>/,\n" +
  "          commits it, removes the worktree, and keeps the branch. Either\n" +
  "          way, the lane's .current/<lane>/pending-tickets.md findings (if\n" +
  "          any) first get real ids, appended to docs/backlog.md and\n" +
  "          committed on --base in the primary checkout.\n";

// Exclude rules upserted into the SHARED info/exclude (git-common-dir), never
// the tracked .gitignore. `/node_modules` has no trailing slash on purpose:
// the lane's node_modules is a SYMLINK, which a directory-only `node_modules/`
// pattern (the common adopter form) does not match — AC12.
// `/.current/**/base-sha` (e125b AC11): the fork-point file `start` writes
// into the new lane is worktree-local — `finish --shipped` reads it from the
// lane worktree before removing it and records it in the tasks.md pointer
// line. Ignoring it keeps a fresh lane's `git status` clean (AC8), lets
// `git worktree remove` (never --force) succeed on a lane that never
// committed its `.current/<lane>/` (AC13), and keeps a harvested history copy
// of it from dirtying the primary checkout. `**` also covers the
// `.current/history/<bucket>/<lane>/` copy and a reverse-migrated flat copy.
const LANE_EXCLUDE_RULES = [".env", "/node_modules", "/.current/**/base-sha"];

// Exclude rules `agc init --artifacts=local` upserts into the same shared
// info/exclude — a second, independent set from LANE_EXCLUDE_RULES above.
// Root-anchored like `/node_modules`. Only governance RUNTIME artifacts are
// listed: specs/, design/ and research/ are prose meant to stay tracked.
// `agc check` keys its artifacts-drift test on these exact strings, so a
// lane-bootstrap entry can never be mistaken for an artifacts choice.
// These are the rules for a workspace AT the repo root; a workspace in a
// subdirectory gets them prefixed with its repo-relative path — always go
// through artifactExcludeRulesForPrefix() / artifactPathsForPrefix() below.
const ARTIFACT_EXCLUDE_RULES = ["/.current/", "/tasks.md", "/qa_reports/", "/review_reports/"];

// Characters unsafe inside a workspace path segment that agc writes verbatim
// into a gitignore exclude rule: the wildcard metacharacters `* ? [ ]` (the
// rule would match more than the literal directory), a backslash (git reads it
// as an escape, so `/a\b/` means `/ab/`), and the C0 control range plus DEL
// (a CR or LF would split one rule across lines of the shared exclude file;
// no control byte has a legitimate use in a directory name). Escaping is not
// attempted — callers refuse or skip instead. This is the ONE place the class
// is defined; every caller reads repoRelativeWorkspacePrefix().unsafeSegment.
const GITIGNORE_UNSAFE_SEGMENT_RE = /[*?[\]\\\x00-\x1f\x7f]/;

// A copy of an unsafe `segment` fit to print inside a one-line message: LF,
// CR and TAB become `\n` `\r` `\t`, every other C0 control byte and DEL
// becomes `\xHH` (lowercase hex), and everything else — backslash and the
// wildcard characters included — is left as-is. Display only: the raw
// `unsafeSegment` value stays unescaped for every logic use. The transform
// assumes nothing about segment boundaries, so it is also applied to whole
// display paths (eject's plan and stderr lines); a string with no control
// byte comes back unchanged.
function escapeSegmentForDisplay(segment) {
  return segment.replace(/[\x00-\x1f\x7f]/g, (ch) => {
    if (ch === "\n") return "\\n";
    if (ch === "\r") return "\\r";
    if (ch === "\t") return "\\t";
    return `\\x${ch.charCodeAt(0).toString(16).padStart(2, "0")}`;
  });
}

// Where workspace `cwd` sits inside the work tree at `repoRoot`, as the
// `/`-separated repo-relative path agc anchors its artifact rules and
// pathspecs at: "" when `cwd` IS the repo root, "sub" or "pkgs/app" for a
// subdirectory. Both sides are canonicalised first, because git reports the
// toplevel with symlinks resolved while `cwd` may still contain them.
// `unsafeSegment` names the first path segment carrying a character that is
// unsafe for a gitignore exclude rule (null when there is none); callers must
// not write or test an exclude rule built from such a prefix. Pure apart from the realpath calls,
// so re-deriving it for the same workspace always yields the same prefix.
function repoRelativeWorkspacePrefix(repoRoot, cwd) {
  const rel = path.relative(canonicalPath(repoRoot), canonicalPath(cwd));
  if (rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) {
    throw new Error(`workspace ${cwd} is not inside the git work tree at ${repoRoot}`);
  }
  const prefix = rel === "" ? "" : rel.split(path.sep).join("/");
  const unsafeSegment =
    prefix === "" ? null : (prefix.split("/").find((seg) => GITIGNORE_UNSAFE_SEGMENT_RE.test(seg)) ?? null);
  return { prefix, unsafeSegment };
}

// The exact exclude lines `agc init --artifacts=local` writes for a
// workspace whose repoRelativeWorkspacePrefix() is `prefix`. `prefix === ""`
// returns ARTIFACT_EXCLUDE_RULES unchanged; otherwise each rule is re-anchored
// under the prefix (`/.current/` -> `/sub/.current/`). Anything that needs to
// know which lines a given workspace's init wrote — the drift check below,
// and an uninstall/eject path that has to remove precisely those lines —
// should rebuild them with this function and the same prefix rather than
// assume the root set. `baseRules` defaults to ARTIFACT_EXCLUDE_RULES; any
// other root-anchored rule list (e.g. eject's domain-knowledge paths) is
// re-anchored the same way.
function artifactExcludeRulesForPrefix(prefix, baseRules = ARTIFACT_EXCLUDE_RULES) {
  return prefix === "" ? [...baseRules] : baseRules.map((rule) => `/${prefix}${rule}`);
}

// Per artifact rule for `prefix`: the repo-relative path shown to the user
// (`.current/`, `sub/.current/`) and the pathspec used for `git ls-files` /
// the printed `git rm` (`.current`, `sub/.current`). Same reuse note as
// artifactExcludeRulesForPrefix(), including the optional `baseRules`.
function artifactPathsForPrefix(prefix, baseRules = ARTIFACT_EXCLUDE_RULES) {
  return artifactExcludeRulesForPrefix(prefix, baseRules).map((rule) => {
    const display = rule.replace(/^\//, "");
    return { display, target: display.replace(/\/$/, "") };
  });
}

// Evidence directories whose ticket-named files `finish --abandoned` retires.
// specs/ is deliberately absent (D2: a spec is a design record, kept in place
// so a re-picked-up ticket still finds it).
const ABANDON_EVIDENCE_DIRS = ["qa_reports", "review_reports"];

// Evidence directories `finish --shipped` harvests into primary (E214). A
// separate list on purpose: specs/ belongs here (integrator ruling
// 2026-09-27, Q1) — a shipped lane's worktree is gone for good, so a
// git-ignored, unlinked spec in it would be lost — while --abandoned keeps
// its own two-entry list above.
const SHIPPED_EVIDENCE_DIRS = ["qa_reports", "review_reports", "specs"];

class FeatureError extends Error {
  constructor(message, { exitCode = 1, usage = false } = {}) {
    super(message);
    this.exitCode = exitCode;
    this.usage = usage;
  }
}

function usageError(message) {
  return new FeatureError(message, { exitCode: 2, usage: true });
}

// git with an argv array; returns stdout, throws on non-zero exit.
function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// Like git(), but a non-zero exit is returned rather than thrown so the caller
// can branch on it and surface git's own stderr verbatim. A spawn failure
// (git not installed: no numeric status) still throws.
function gitTry(cwd, args) {
  try {
    return { status: 0, stdout: git(cwd, args), stderr: "" };
  } catch (err) {
    if (err && typeof err.status === "number") {
      return {
        status: err.status,
        stdout: String(err.stdout ?? ""),
        stderr: String(err.stderr ?? ""),
      };
    }
    throw err;
  }
}

// The single lane-naming module, loaded from the compiled dist/ (committed,
// so `npx github:` consumers have it). Dynamic so `agc init` / `agc check`
// never depend on dist/ being present.
async function loadLanePaths() {
  try {
    return await import(new URL("../dist/tools/lane-paths.js", import.meta.url).href);
  } catch (err) {
    throw new FeatureError(
      `agc feature: cannot load dist/tools/lane-paths.js from the agc install ` +
        `(${err && err.message ? err.message : String(err)}) — run \`npm run build\``
    );
  }
}

// Minimal flag parser: `--name value` / `--name=value` for valueFlags,
// `--name` for boolFlags; anything else starting with "-" is rejected.
function parseFeatureArgs(argv, valueFlags, boolFlags) {
  const positionals = [];
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (!a.startsWith("-") || a === "-") {
      positionals.push(a);
      continue;
    }
    if (!a.startsWith("--")) throw usageError(`agc feature: unknown option ${a}`);
    const eq = a.indexOf("=");
    const name = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (Object.prototype.hasOwnProperty.call(opts, name)) {
      throw usageError(`agc feature: --${name} given more than once`);
    }
    if (valueFlags.includes(name)) {
      let value;
      if (eq !== -1) {
        value = a.slice(eq + 1);
      } else {
        if (i + 1 >= argv.length) throw usageError(`agc feature: --${name} requires a value`);
        value = argv[++i];
      }
      if (value === "") throw usageError(`agc feature: --${name} requires a non-empty value`);
      opts[name] = value;
    } else if (boolFlags.includes(name) && eq === -1) {
      opts[name] = true;
    } else {
      throw usageError(`agc feature: unknown option ${a}`);
    }
  }
  return { positionals, opts };
}

// `git worktree list --porcelain` -> [{ path, branch }] (branch is the full
// ref, e.g. "refs/heads/feat/e73-x", or null for a detached/bare entry). The
// FIRST entry is always the main (primary) worktree.
function listWorktrees(repoRoot) {
  const out = git(repoRoot, ["worktree", "list", "--porcelain"]);
  const entries = [];
  let cur = null;
  for (const line of out.split("\n")) {
    if (line.startsWith("worktree ")) {
      cur = { path: line.slice("worktree ".length), branch: null };
      entries.push(cur);
    } else if (cur && line.startsWith("branch ")) {
      cur.branch = line.slice("branch ".length);
    } else if (line === "") {
      cur = null;
    }
  }
  return entries;
}

// Canonical form of a path that may not exist yet: realpath of the nearest
// existing ancestor + the remaining segments. Needed to compare against
// `git worktree list` output, which git prints realpath'd (e.g. macOS's
// /var -> /private/var).
function canonicalPath(p) {
  const rest = [];
  let cur = path.resolve(p);
  for (;;) {
    try {
      return path.join(fs.realpathSync(cur), ...rest);
    } catch {
      const parent = path.dirname(cur);
      if (parent === cur) return path.resolve(p);
      rest.unshift(path.basename(cur));
      cur = parent;
    }
  }
}

function lstatOrNull(p) {
  try {
    return fs.lstatSync(p);
  } catch {
    return null;
  }
}

// Resolve the repo toplevel for `cwd` and refuse a linked worktree: a lane is
// always cut from — and torn down from — the primary checkout (you cannot
// `git worktree remove` the directory you are standing in). Reuses
// isLinkedWorktree (the `.git`-is-a-FILE signal), applied to the toplevel so
// a subdirectory of a lane is refused too. `command` is the label every
// message starts with; it defaults to `agc feature <verb>`, and a command
// outside the feature family passes its own (`agc eject`).
function resolvePrimaryRepoRoot(cwd, verb, command = `agc feature ${verb}`) {
  const r = gitTry(cwd, ["rev-parse", "--show-toplevel"]);
  if (r.status !== 0) {
    throw new FeatureError(`${command}: not inside a git repository (${cwd})`);
  }
  const top = r.stdout.trim();
  if (isLinkedWorktree(top)) {
    let primary = null;
    try {
      primary = listWorktrees(top)[0]?.path ?? null;
    } catch {
      // best effort — the refusal below stands either way
    }
    throw new FeatureError(
      `${command}: refusing to run from inside a linked git worktree ` +
        `(${top}) — run it from the primary checkout` +
        (primary ? ` (${primary})` : "")
    );
  }
  return top;
}

// Resolve `base` to a commit, refusing option-shaped values so a user-supplied
// ref can never be parsed by git as a flag.
function resolveBaseCommit(repoRoot, base, verb) {
  if (base.startsWith("-")) {
    throw usageError(`agc feature ${verb}: invalid --base ${JSON.stringify(base)}`);
  }
  const r = gitTry(repoRoot, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  if (r.status !== 0) {
    throw new FeatureError(`agc feature ${verb}: --base ${base} does not resolve to a commit`);
  }
  return r.stdout.trim();
}

// Read <git-common-dir>/info/exclude — shared by every worktree of the repo
// and untracked. `lines` holds each line trimmed, for exact-rule membership
// tests; absence of the file reads as empty.
function readSharedExclude(repoRoot) {
  const common = git(repoRoot, ["rev-parse", "--git-common-dir"]).trim();
  const excludePath = path.join(path.resolve(repoRoot, common), "info", "exclude");
  let existing = "";
  let exists = false;
  try {
    existing = fs.readFileSync(excludePath, "utf-8");
    exists = true;
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }
  const lines = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  return { excludePath, existing, exists, lines };
}

// Idempotent upsert of `rules` into the shared info/exclude, checked by line
// content (never blindly appended). Used by `agc feature start`
// (LANE_EXCLUDE_RULES) and `agc init` (artifactExcludeRulesForPrefix). Returns the
// rules actually added.
function upsertSharedExclude(repoRoot, rules) {
  const { excludePath, existing, exists, lines } = readSharedExclude(repoRoot);
  const missing = rules.filter((rule) => !lines.has(rule));
  if (missing.length === 0) return [];
  const sep = existing === "" || existing.endsWith("\n") ? "" : "\n";
  const content = existing + sep + missing.join("\n") + "\n";
  if (exists) {
    atomicWriteFile(excludePath, content);
  } else {
    fs.mkdirSync(path.dirname(excludePath), { recursive: true });
    fs.writeFileSync(excludePath, content);
  }
  return missing;
}

// Toplevel of the git work tree containing `cwd`, or null when `cwd` is not
// inside one (or git is not installed — there is then no repo this CLI could
// act on either). The "not a git repository" case is recognised from git's
// own message, so the locale is pinned to C: a translated message would
// otherwise turn a plain non-repo directory into a hard failure. Any other
// git failure (e.g. a repo git refuses to operate on) is thrown, not
// silently treated as "outside git".
function resolveRepoRootOrNull(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, LC_ALL: "C", LANGUAGE: "C" },
    }).trim();
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    const stderr = String(err?.stderr ?? "");
    if (err && typeof err.status === "number" && /not a git repository/i.test(stderr)) {
      return null;
    }
    throw new Error(
      `cannot determine the git repository for ${cwd}: ${stderr.trim() || (err && err.message) || String(err)}`
    );
  }
}

// The `artifactPaths` entries (from artifactPathsForPrefix) that have at
// least one file in the index of the repo at `repoRoot` — one entry per
// artifact path, not per file, so a workspace with thousands of tracked
// `.current/` files still gets a short, actionable list. Serves `agc init`
// (the tracked-tree warning and the omitted-flag refusal to default) and
// `agc check` (local-mode drift) from one definition. Run from the repo root,
// so the targets are repo-relative. `-z` keeps non-ASCII paths unquoted;
// literal pathspecs keep a directory name with a wildcard character from
// being read as a glob. Throws on git failure; callers decide whether that
// is fatal.
function trackedArtifactPaths(repoRoot, artifactPaths) {
  const out = git(repoRoot, [
    "--literal-pathspecs",
    "ls-files",
    "-z",
    "--",
    ...artifactPaths.map((p) => p.target),
  ]);
  const files = out.split("\0").filter((f) => f.length > 0);
  return artifactPaths.filter(({ display, target }) =>
    display.endsWith("/")
      ? files.some((f) => f.startsWith(display))
      : files.some((f) => f === target)
  );
}

// Env bootstrap for a freshly-added lane (AC9–AC14). Returns
// { out: string[], warn: string[] } lines for the caller to print.
function bootstrapLaneEnv(repoRoot, lanePath) {
  const out = [];
  const warn = [];

  // Exclude rules first, so the lane's `git status` is clean the moment the
  // link / copy below exist (AC8, AC13).
  const added = upsertSharedExclude(repoRoot, LANE_EXCLUDE_RULES);
  if (added.length > 0) {
    out.push(`agc feature start — added ${added.join(", ")} to the shared info/exclude`);
  }

  // node_modules: a symlink to primary's install, never a copy (AC9).
  const primaryNm = path.join(repoRoot, "node_modules");
  const laneNm = path.join(lanePath, "node_modules");
  let nmStat = null;
  try {
    nmStat = fs.statSync(primaryNm);
  } catch {
    nmStat = null;
  }
  if (!nmStat || !nmStat.isDirectory()) {
    warn.push(
      `agc feature start — warning: the primary checkout has no node_modules ` +
        `(${primaryNm}) — run \`npm install\` in the primary checkout first; the ` +
        `lane was created without a node_modules link`
    );
  } else if (lstatOrNull(laneNm)) {
    warn.push(
      `agc feature start — warning: ${laneNm} already exists after checkout ` +
        `(tracked in this repo?) — left as checked out, not linked`
    );
  } else {
    fs.symlinkSync(primaryNm, laneNm, process.platform === "win32" ? "junction" : "dir");
    out.push(`agc feature start — linked node_modules -> ${primaryNm}`);
    // AC14 — one line, stdout, right after the link exists.
    out.push(
      "agc feature start — warning: node_modules is shared with the primary " +
        "checkout (symlink) — never run `npm ci` / `npm install` inside the lane " +
        "(`npm ci` deletes the directory first, which would delete primary's real " +
        "node_modules through the link); for an independent install, `rm " +
        "node_modules` (removes only the link) and then run `npm ci` in the lane"
    );
  }

  // .env: byte copy only — fs.copyFileSync never materializes the content as
  // a JS string (§6). COPYFILE_EXCL: never clobber a .env the checkout
  // already produced (a repo that tracks one).
  const primaryEnv = path.join(repoRoot, ".env");
  if (fs.existsSync(primaryEnv)) {
    const laneEnv = path.join(lanePath, ".env");
    try {
      fs.copyFileSync(primaryEnv, laneEnv, fs.constants.COPYFILE_EXCL);
      out.push("agc feature start — copied .env from the primary checkout (bytes only; contents never read)");
    } catch (err) {
      if (err && err.code === "EEXIST") {
        warn.push(
          `agc feature start — warning: ${laneEnv} already exists after checkout ` +
            `(tracked in this repo?) — left as checked out, not overwritten`
        );
      } else {
        throw err;
      }
    }
  }

  return { out, warn };
}

async function runFeatureStart(cwd, argv) {
  const { positionals, opts } = parseFeatureArgs(argv, ["base", "path"], []);
  if (positionals.length !== 1) {
    throw usageError("agc feature start: expected exactly one <ticket-slug>");
  }
  const slug = positionals[0];

  // AC2 — primary-checkout guard before anything else.
  const repoRoot = resolvePrimaryRepoRoot(cwd, "start");

  // AC4 — the slug must lead with a ticket id, judged by the lane module's
  // own pattern (resolveLaneName shares TICKET_ID_RE with resolveCurrentLane)
  // before any git mutation.
  const lanePaths = await loadLanePaths();
  const ticketId = lanePaths.resolveLaneName(slug);
  if (slug !== slug.trim() || ticketId === lanePaths.LEGACY_LANE) {
    throw usageError(
      `agc feature start: ${JSON.stringify(slug)} does not start with a ticket id ` +
        `(expected e.g. e73-agc-feature-lifecycle)`
    );
  }
  const branch = `feat/${slug}`;
  if (gitTry(repoRoot, ["check-ref-format", "--branch", branch]).status !== 0) {
    throw usageError(`agc feature start: ${JSON.stringify(branch)} is not a valid branch name`);
  }

  const base = opts.base ?? "main";
  const baseCommit = resolveBaseCommit(repoRoot, base, "start");

  // AC5 — default --path: <dirname(repoRoot)>/<basename(repoRoot)>-lanes/<ticket-id>.
  const lanePath =
    opts.path !== undefined
      ? path.resolve(cwd, opts.path)
      : path.join(path.dirname(repoRoot), `${path.basename(repoRoot)}-lanes`, ticketId);

  // AC6 — refuse (creating nothing) on an existing branch, an existing path,
  // or a path still registered as a (missing) worktree. The last one matters
  // because git itself creates the -b branch BEFORE discovering that clash,
  // and would leave it behind.
  if (gitTry(repoRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).status === 0) {
    throw new FeatureError(`agc feature start: branch ${branch} already exists — nothing created`);
  }
  if (lstatOrNull(lanePath)) {
    throw new FeatureError(`agc feature start: target path already exists: ${lanePath} — nothing created`);
  }
  const canonicalLane = canonicalPath(lanePath);
  if (listWorktrees(repoRoot).some((w) => canonicalPath(w.path) === canonicalLane)) {
    throw new FeatureError(
      `agc feature start: ${lanePath} is still registered as a git worktree ` +
        `(run \`git worktree prune\`) — nothing created`
    );
  }

  // AC1 — git creates any missing leading directories of lanePath itself.
  // AC7 — deliberately NOT followed by `agc init` / writeClaudeBlock: that
  // would rewrite the lane's tracked CLAUDE.md and leave it dirty.
  const add = gitTry(repoRoot, ["worktree", "add", "-b", branch, lanePath, base]);
  if (add.status !== 0) {
    // Defensive rollback: drop the branch only if git created it and it still
    // points at the base commit (conditional update-ref — never deletes a
    // branch that gained commits).
    gitTry(repoRoot, ["update-ref", "-d", `refs/heads/${branch}`, baseCommit]);
    process.stderr.write(add.stderr);
    throw new FeatureError(`agc feature start: git worktree add failed — no lane created`);
  }
  process.stdout.write(
    `agc feature start — created branch ${branch} (from ${base}) and worktree ${lanePath}\n`
  );

  const { out, warn } = bootstrapLaneEnv(repoRoot, lanePath);
  for (const line of out) process.stdout.write(`${line}\n`);
  for (const line of warn) process.stderr.write(`${line}\n`);

  // e125b AC11 — persist the fork point this command already resolved, so
  // `finish --shipped` can record it even after base advances past it. After
  // bootstrapLaneEnv, so the exclude rule covering it is already in place.
  // Best-effort: a failed write only degrades the pointer to base_sha=unknown.
  try {
    const baseShaPath = lanePaths.resolveLanePaths(lanePath, ticketId).baseShaPath;
    fs.mkdirSync(path.dirname(baseShaPath), { recursive: true });
    fs.writeFileSync(baseShaPath, baseCommit);
  } catch (err) {
    process.stderr.write(
      `agc feature start — warning: could not record the fork point in .current/${ticketId}/base-sha ` +
        `(${err && err.message ? err.message : String(err)}) — finish will record base_sha=unknown\n`
    );
  }

  // AC3 — the printed lane id IS resolveCurrentLane over the new worktree.
  const lane = lanePaths.resolveCurrentLane(lanePath);
  if (lane !== ticketId) {
    process.stderr.write(
      `agc feature start — warning: lane resolved as ${lane}, expected ${ticketId}\n`
    );
  }
  process.stdout.write(`lane: ${lane}\n`);
}

// NUL-separated `git status --porcelain -z` -> every path it names (both
// sides of a rename/copy entry).
function parsePorcelainZ(out) {
  const tokens = out.split("\0");
  const paths = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.length < 4) continue;
    paths.push(t.slice(3));
    if (t[0] === "R" || t[0] === "C") {
      i++;
      if (i < tokens.length && tokens[i].length > 0) paths.push(tokens[i]);
    }
  }
  return paths;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// `finish --abandoned` evidence disposition (AC21–AC25), split in two so the
// precondition can run before any other mutation (E179 AC3(a), G4):
//   planAbandonEvidence  — the precondition + destination-clash check; reads
//                          only, mutates nothing, throws on refusal. Returns
//                          { moves }.
//   applyAbandonEvidence — git mv (tracked) / fs.renameSync (untracked) into
//                          <dir>/abandoned/<ticket-id>/, and one commit when
//                          anything is staged. Returns { committed,
//                          untrackedMoved } for reporting.
// apply(plan(...).moves) is exactly the pre-E179 single-function behaviour.
function planAbandonEvidence(lanePath, ticketId) {
  // Bounded token: the id delimited by _ - . or a string edge, case-
  // insensitive — `e73` never matches `e730` / `e73b`.
  const tokenRe = new RegExp(`(?:^|[_.-])${escapeRegExp(ticketId)}(?:[_.-]|$)`, "i");
  const tracked = new Set(
    git(lanePath, ["ls-files", "-z", "--", ...ABANDON_EVIDENCE_DIRS])
      .split("\0")
      .filter((p) => p.length > 0)
  );

  const moves = [];
  for (const dir of ABANDON_EVIDENCE_DIRS) {
    let entries;
    try {
      entries = fs.readdirSync(path.join(lanePath, dir), { withFileTypes: true });
    } catch {
      continue; // directory absent in this lane
    }
    for (const d of entries) {
      if (!d.isFile() || !tokenRe.test(d.name)) continue; // files directly under dir only
      const src = `${dir}/${d.name}`;
      moves.push({
        src,
        dst: `${dir}/abandoned/${ticketId}/${d.name}`,
        tracked: tracked.has(src),
      });
    }
  }

  // Precondition (AC21): any dirty entry that is not a to-be-moved evidence
  // file refuses the whole run — never commit unrelated work, never force.
  const evidence = new Set(moves.map((m) => m.src));
  const dirty = parsePorcelainZ(
    git(lanePath, ["status", "--porcelain", "-z", "--untracked-files=all"])
  );
  const unrelated = dirty.filter((p) => !evidence.has(p));
  if (unrelated.length > 0) {
    throw new FeatureError(
      `agc feature finish --abandoned: ${lanePath} has uncommitted changes unrelated ` +
        `to ${ticketId} evidence — commit or discard them first (nothing moved):\n` +
        unrelated.map((p) => `  ${p}`).join("\n")
    );
  }
  const clashes = moves.filter((m) => lstatOrNull(path.join(lanePath, m.dst)));
  if (clashes.length > 0) {
    throw new FeatureError(
      `agc feature finish --abandoned: destination already exists (nothing moved):\n` +
        clashes.map((m) => `  ${m.dst}`).join("\n")
    );
  }
  planAbandonEvidenceHarvest(lanePath, moves);
  return { moves };
}

// E180 (spec AC1–AC6) — mark each move whose file `git worktree remove`
// (never --force) would delete WITHOUT refusing: untracked, git-ignored, and
// its evidence dir not a symlink resolving outside the worktree. Such a move
// gets `harvestAbs` (its primary-checkout copy target, same relative path as
// the local `dst`) when that copy must still be made; an identical primary
// copy already there (a re-run — AC4/AC6) needs none; a differing one refuses
// the whole run here, in the read-only phase (AC3). Mutates only the plan
// objects. Primary = listWorktrees' first entry, so neither caller's
// signature changes.
function planAbandonEvidenceHarvest(lanePath, moves) {
  const atRisk = moves.filter((m) => !m.tracked && evidenceAtRisk(lanePath, m));
  if (atRisk.length === 0) return;
  const repoRoot = listWorktrees(lanePath)[0]?.path;
  if (!repoRoot) {
    throw new FeatureError(
      `agc feature finish --abandoned: could not resolve the primary checkout of ${lanePath} ` +
        `to harvest git-ignored evidence into (nothing moved)`
    );
  }
  const conflicts = [];
  for (const m of atRisk) {
    // E216 AC14 — the primary copy (made this run, or already there
    // byte-identical) is this file's durable one; the in-lane move is not.
    m.harvested = true;
    const harvestAbs = path.join(repoRoot, m.dst);
    if (lstatOrNull(harvestAbs) === null) {
      m.harvestAbs = harvestAbs;
    } else if (!sameFileBytes(path.join(lanePath, m.src), harvestAbs)) {
      conflicts.push(harvestAbs);
    }
  }
  if (conflicts.length > 0) {
    // Copy / Strings e180.evidence-harvest-refuse-line.
    throw new FeatureError(
      `agc feature finish --abandoned: harvest destination already exists in the primary checkout and differs (nothing moved):\n` +
        conflicts.map((p) => `  ${p}`).join("\n")
    );
  }
}

// Per FILE, never per directory (a directory holding one tracked file reports
// "not ignored" — see hasIgnoredUntrackedContent). Both the current path and
// the post-move path are asked, since the file sits at `dst` when the worktree
// goes. Exit 1 is git's "not ignored"; any other non-zero (e.g. 128, a path
// beyond an in-worktree symlink) cannot prove the file survives, so it fails
// toward harvesting — a spare primary copy is harmless, a lost file is not.
function evidenceAtRisk(lanePath, m) {
  const dir = m.src.split("/")[0];
  if (isSafelyLinkedOutside(lanePath, path.join(lanePath, dir))) return false; // AC2
  return [m.src, m.dst].some(
    (rel) => gitTry(lanePath, ["check-ignore", "-q", "--", rel]).status !== 1
  );
}

// E180 — the fs copies planAbandonEvidenceHarvest asked for, ALL before the
// first move, so a copy that throws leaves every evidence file where it was
// (re-running finds the copies already made identical — AC4).
function applyAbandonEvidenceHarvest(lanePath, moves) {
  for (const m of moves) {
    if (!m.harvestAbs) continue;
    try {
      fs.mkdirSync(path.dirname(m.harvestAbs), { recursive: true });
      fs.copyFileSync(path.join(lanePath, m.src), m.harvestAbs, fs.constants.COPYFILE_EXCL);
    } catch (err) {
      // The plan saw harvestAbs absent and COPYFILE_EXCL only ever creates it,
      // so anything there now (bar a concurrent EEXIST) is this copy's partial
      // output — drop it, or the re-run would refuse on it as "differs".
      if (!err || err.code !== "EEXIST") fs.rmSync(m.harvestAbs, { force: true });
      throw new FeatureError(
        `agc feature finish --abandoned: harvest of ${m.src} into the primary checkout failed ` +
          `(${err && err.message ? err.message : String(err)}) — nothing moved, worktree left in place ` +
          `(re-running finish is safe)`
      );
    }
    // Copy / Strings e180.evidence-harvest-line.
    const dir = m.src.split("/")[0];
    process.stdout.write(
      `agc feature finish — harvested git-ignored evidence ${m.src} -> primary ${m.dst} ` +
        `(fs copy, not committed — ${dir}/ is git-ignored here and not linked outside the worktree, ` +
        `so \`git worktree remove\` would otherwise delete it silently)\n`
    );
  }
}

function applyAbandonEvidence(lanePath, ticketId, moves) {
  applyAbandonEvidenceHarvest(lanePath, moves);
  const untrackedMoved = [];
  for (const m of moves) {
    fs.mkdirSync(path.dirname(path.join(lanePath, m.dst)), { recursive: true });
    if (m.tracked) {
      git(lanePath, ["mv", "--", m.src, m.dst]);
    } else {
      fs.renameSync(path.join(lanePath, m.src), path.join(lanePath, m.dst));
      untrackedMoved.push(m.dst);
    }
    process.stdout.write(
      m.harvested
        ? // Copy / Strings e216.moved-qualified-line (AC14); plain line otherwise (AC15).
          `agc feature finish — moved ${m.src} -> ${m.dst} (inside the lane worktree only — removed with it; ` +
            `the primary copy harvested above is the durable one)\n`
        : `agc feature finish — moved ${m.src} -> ${m.dst}\n`
    );
  }

  // AC23 — commit only when something is staged; zero tracked matches means
  // no commit at all (never an empty one).
  const staged = git(lanePath, ["diff", "--cached", "--name-only", "-z"]);
  let committed = false;
  if (staged.split("\0").some((p) => p.length > 0)) {
    const c = gitTry(lanePath, [
      "commit",
      "-m",
      `chore(lane): abandon ${ticketId} — evidence to abandoned/`,
    ]);
    if (c.status !== 0) {
      process.stderr.write(c.stderr);
      throw new FeatureError(
        `agc feature finish --abandoned: git commit failed in ${lanePath} — the ` +
          `moves above are staged but uncommitted; worktree left in place`
      );
    }
    committed = true;
  }
  return { committed, untrackedMoved };
}

// E194 (spec AC7–AC12) — `.current/<ticket>/` that the lane never tracked on
// its own branch (the git-ignored-`.current/` adopter shape, or a lane that
// simply never committed it) is its only governance record, and
// `git worktree remove` deletes the ignored part silently. Read-only plan,
// run before any --abandoned mutation: null when there is nothing to harvest
// (absent — AC11; linked outside the worktree; any tracked content — AC8),
// a refusal when the primary history path is taken by a non-directory (AC9),
// else the copy to make.
function planAbandonCurrentHarvest({ lanePaths, lanePath, ticketId, branch, now }) {
  const laneRel = path.posix.join(".current", ticketId);
  const laneAbs = path.join(lanePath, ".current", ticketId);
  let st;
  try {
    st = fs.statSync(laneAbs);
  } catch {
    return null; // AC11 — absent (or a dangling link: nothing to copy)
  }
  if (!st.isDirectory()) return null;
  if (isSafelyLinkedOutside(lanePath, laneAbs)) return null; // survives the removal on its own
  if (hasTrackedContent(lanePath, laneRel)) return null; // AC8 — durable via the kept branch
  const repoRoot = listWorktrees(lanePath)[0]?.path;
  if (!repoRoot) {
    throw new FeatureError(
      `agc feature finish --abandoned: could not resolve the primary checkout of ${lanePath} ` +
        `to harvest ${laneRel}/ into (nothing moved)`
    );
  }
  const bucket = lanePaths.resolveHistoryBucket(now);
  const histAbs = lanePaths.resolveHistoryLaneDir(repoRoot, bucket, ticketId);
  if (lstatOrNull(histAbs) !== null && !isDirectoryPath(histAbs)) {
    // Copy / Strings e194.current-harvest-refuse-line.
    throw new FeatureError(
      `agc feature finish --abandoned: .current/history/${bucket}/${ticketId}/ already exists in the ` +
        `primary checkout and is not a directory — move it aside first (nothing moved, worktree left in place)`
    );
  }
  return {
    ticketId,
    branch,
    bucket,
    histAbs,
    // Real path, so an in-worktree symlink is copied as its content, not as
    // a link into the directory about to be removed.
    srcAbs: fs.realpathSync(laneAbs),
    // Picks the advisory's reason clause. A directory-level ask is exact
    // here: the directory holds no tracked file (checked above), which is the
    // only thing that makes git report an ignored directory as not ignored.
    sourceIgnored: gitTry(lanePath, ["check-ignore", "-q", "--", laneRel]).status === 0,
  };
}

// The copy planAbandonCurrentHarvest asked for, just before the worktree is
// removed (so it captures the lane's final state). Every file, no exclusions
// (--abandoned writes no pointer line that base-sha would duplicate). A
// copy-over, NEVER rm-then-copy (AC10): lane files overwrite same-named
// history files, history-only files (an earlier harvest under the same id)
// are kept — lossless, since agc's only writer of this dir is this harvest.
// A failed copy leaves the worktree in place; re-running redoes it.
function executeAbandonCurrentHarvest(harvest) {
  const { ticketId, branch, bucket, histAbs, srcAbs, sourceIgnored } = harvest;
  try {
    fs.mkdirSync(histAbs, { recursive: true });
    fs.cpSync(srcAbs, histAbs, { recursive: true, force: true, errorOnExist: false });
  } catch (err) {
    throw new FeatureError(
      `agc feature finish --abandoned: harvest of .current/${ticketId}/ into .current/history/${bucket}/${ticketId}/ ` +
        `failed (${err && err.message ? err.message : String(err)}) — worktree and branch left in place ` +
        `(re-running finish is safe)`
    );
  }
  // Copy / Strings e194.current-harvest-line (reason clause per sourceIgnored).
  const reason = sourceIgnored
    ? `the source path is git-ignored in this workspace`
    : `this lane never committed .current/${ticketId}/ on ${branch}, so there was nothing durable to keep`;
  process.stdout.write(
    `agc feature finish — harvested untracked .current/${ticketId}/ into .current/history/${bucket}/${ticketId}/ ` +
      `(fs copy, not committed — ${reason}; if your .gitignore ` +
      `does not also cover .current/history/, this copy will show up as untracked in \`git status\` here)\n`
  );
}

// `git worktree remove` WITHOUT --force; a refusal is surfaced verbatim
// (git's own message) and never retried with --force (AC19, AC24).
function removeWorktreeNoForce(repoRoot, lanePath, hint) {
  const r = gitTry(repoRoot, ["worktree", "remove", lanePath]);
  if (r.status !== 0) {
    process.stderr.write(r.stderr);
    throw new FeatureError(
      `agc feature finish: git worktree remove refused (not retried with --force) — ` +
        `${lanePath} left in place` + (hint ? `\n${hint}` : "")
    );
  }
}

// --- finish-time pending-ticket apply (E179, specs/e179-*.md) ---------------
// A lane files new findings in `.current/<lane>/pending-tickets.md` (E124's
// format) and never picks a real backlog id. `agc feature finish` is the ONE
// sanctioned numbering step: it reads the pending file and docs/backlog.md
// fresh from git's object db (never a long-lived in-memory copy — AC4),
// allocates ids above the backlog's current max, appends the rows, archives
// the entries with markApplied, and commits — all BEFORE the worktree is
// removed, so any refusal leaves the lane exactly as today's other
// precondition failures do. Every check runs before the first mutation.

const BACKLOG_REL = "docs/backlog.md";
// docs/backlog.md is already ~0.7 MB; execFileSync's 1 MiB default maxBuffer
// would start failing the blob read as it grows.
const BLOB_MAX_BUFFER = 256 * 1024 * 1024;

// Pure module, loaded from dist/ like loadLanePaths. Loaded lazily (only once
// a pending file is found), so a lane with no findings finishes exactly as
// before even without it.
async function loadTicketAllocation() {
  try {
    return await import(new URL("../dist/tools/lane-ticket-allocation.js", import.meta.url).href);
  } catch (err) {
    throw new FeatureError(
      `agc: cannot load dist/tools/lane-ticket-allocation.js from the agc install ` +
        `(${err && err.message ? err.message : String(err)}) — run \`npm run build\``
    );
  }
}

// `<rev>:<rel>` from the object db through `cwd`'s repo — never the working
// tree. null when the path is absent at that revision. `rev` is a resolved
// --base or a `refs/heads/...` ref (never option-shaped: resolveBaseCommit
// refuses a leading "-", and the argument starts with the rev either way).
function readBlob(cwd, rev, rel) {
  if (gitTry(cwd, ["cat-file", "-e", `${rev}:${rel}`]).status !== 0) return null;
  return execFileSync("git", ["show", `${rev}:${rel}`], {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: BLOB_MAX_BUFFER,
  });
}

// C1 content refusals + allocation (no mutation). `pendingText` is the
// pending file's blob; `revLabel` names where it was read from. Returns null
// for a silent no-op (zero unapplied entries), else
// { backlogText, pendingText, skipped: Map<laneLocalId,rowId>, toAllocate,
//   allocated, newBacklogText }. Throws FeatureError, listing every error
// verbatim.
function planPendingApply({ alloc, repoRoot, pendingText, revLabel, base, lane, pendingRel, verb }) {
  const backlogBlob = readBlob(repoRoot, base, BACKLOG_REL);
  const backlogText = backlogBlob ?? "";
  const prov = alloc.findAppliedProvenance(backlogText, lane);
  const parsed = alloc.parsePendingTickets(pendingText, lane, {
    appliedLaneLocalIds: new Set(prov.keys()),
  });
  if (parsed.errors.length > 0) {
    throw new FeatureError(
      `agc feature finish ${verb}: ${pendingRel} on ${revLabel} has ${parsed.errors.length} ` +
        `problem(s) — fix them on the lane branch and re-run (nothing applied, nothing removed):\n` +
        parsed.errors.map((e) => `  ${e}`).join("\n")
    );
  }
  if (parsed.entries.length === 0) return null;

  const skipped = new Map();
  const toAllocate = [];
  for (const entry of parsed.entries) {
    const row = prov.get(entry.laneLocalId);
    if (row !== undefined) skipped.set(entry.laneLocalId, row);
    else toAllocate.push(entry);
  }
  let allocated = [];
  if (toAllocate.length > 0) {
    const res = alloc.allocateTicketIds({
      currentMaxId: alloc.extractMaxBacklogId(backlogText),
      batches: [{ lane, entries: toAllocate }],
    });
    if (res.unresolvedDependencies.length > 0) {
      throw new FeatureError(
        `agc feature finish ${verb}: ${pendingRel} has ${res.unresolvedDependencies.length} ` +
          `unresolvable depends_on reference(s) — fix them on the lane branch and re-run ` +
          `(nothing applied, nothing removed):\n` +
          res.unresolvedDependencies
            .map(
              (u) =>
                `  ${u.lane}/${u.laneLocalId} (provisional ${u.id}): depends_on ` +
                `${JSON.stringify(u.reference)} — ${u.reason}`
            )
            .join("\n")
      );
    }
    if (backlogBlob === null) {
      throw new FeatureError(
        `agc feature finish ${verb}: ${BACKLOG_REL} not found on ${base} — cannot allocate ` +
          `ids for ${pendingRel} (nothing applied, nothing removed)`
      );
    }
    allocated = res.allocated;
  }
  // Composed here, before any primary-state check (review R1): a backlog
  // with no ticket-table header is a content refusal like the ones above.
  let newBacklogText = backlogText;
  if (allocated.length > 0) {
    try {
      newBacklogText = alloc.appendBacklogRows(backlogText, allocated.map((t) => t.backlogRow));
    } catch (err) {
      throw new FeatureError(
        `agc feature finish ${verb}: ${err && err.message ? err.message : String(err)} on ` +
          `${base} — cannot append rows for ${pendingRel} (nothing applied, nothing removed)`
      );
    }
  }
  return { backlogText, newBacklogText, pendingText, skipped, toAllocate, allocated };
}

// C2 + C3 (spec AC2 (a)/(b)): the primary checkout must have --base checked
// out, and the files this command is about to write must be clean there.
// Reads only; throws FeatureError. After both pass, the working-tree copy of
// every existing path in `rels` is byte-identical to its --base blob.
// `what` names what gets committed on --base (the refusal's reason clause).
function assertPrimaryWritable(repoRoot, base, rels, verb, what = "pending tickets are") {
  const head = gitTry(repoRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  const current = head.status === 0 ? head.stdout.trim() : "(unknown)";
  if (current !== base) {
    throw new FeatureError(
      `agc feature finish ${verb}: the primary checkout (${repoRoot}) has ${current} checked ` +
        `out, not --base ${base} — ${what} committed on ${base}; check it out ` +
        `there first (nothing applied, nothing removed)`
    );
  }
  const dirty = parsePorcelainZ(
    git(repoRoot, ["status", "--porcelain", "-z", "--untracked-files=all", "--", ...rels])
  );
  if (dirty.length > 0) {
    throw new FeatureError(
      `agc feature finish ${verb}: the primary checkout has uncommitted changes to files ` +
        `this command writes — commit or discard them first (nothing applied, nothing removed):\n` +
        dirty.map((p) => `  ${p}`).join("\n")
    );
  }
}

function printSkipped(lane, skipped) {
  for (const [id, row] of skipped) {
    process.stdout.write(
      `agc feature finish — ${lane}/${id} already applied, skipping (backlog row ${row})\n`
    );
  }
}

function printAppliedSummary(allocated) {
  if (allocated.length === 0) return;
  process.stdout.write(
    `agc feature finish — applied ${allocated.length} pending ticket(s): ` +
      `${allocated.map((t) => t.id).join(", ")}\n`
  );
}

// Path-limited commit (`git commit -- <rels>`: --only semantics, no `git
// add`), so any other staged or unstaged change in `cwd` is left exactly as
// it was. On failure every file in `restore` is written back to its pre-run
// bytes (DR-3) before the FeatureError is thrown.
function commitPathsOrRestore(cwd, message, rels, restore, failMessage) {
  const c = gitTry(cwd, ["commit", "-m", message, "--", ...rels]);
  if (c.status === 0) return;
  for (const { abs, text } of restore) atomicWriteFile(abs, text);
  process.stderr.write(c.stderr);
  throw new FeatureError(failMessage);
}

function newPendingText(alloc, plan) {
  return alloc.markApplied(plan.pendingText, [
    ...plan.allocated.map((t) => t.laneLocalId),
    ...plan.skipped.keys(),
  ]);
}

// --shipped (spec AC2, AC4; architecture "Step order — --shipped" 3–M3).
// The lane is merged, so both files are read from --base. Split in two
// (e125b) so the lane-close plan's own checks and the combined primary-state
// precondition (assertPrimaryWritable over BOTH commits' paths) run after
// these content refusals but before this commit: planPendingOnShipped only
// reads and refuses; commitPendingOnShipped mutates. null = silent no-op.
async function planPendingOnShipped({ lanePaths, repoRoot, base, lane }) {
  const pendingRel = path.posix.join(".current", lane, lanePaths.laneFile("pendingTickets").filename);
  const pendingText = readBlob(repoRoot, base, pendingRel);
  if (pendingText === null) return null; // silent no-op
  const alloc = await loadTicketAllocation();
  const plan = planPendingApply({
    alloc, repoRoot, pendingText, revLabel: base, base, lane, pendingRel, verb: "--shipped",
  });
  if (plan === null) return null; // zero unapplied entries: silent no-op
  return { alloc, plan, pendingRel, rels: [BACKLOG_REL, pendingRel] };
}

function commitPendingOnShipped({ repoRoot, base, lane, pending }) {
  const { alloc, plan, pendingRel, rels } = pending;
  printSkipped(lane, plan.skipped);
  const backlogAbs = path.join(repoRoot, BACKLOG_REL);
  const pendingAbs = path.join(repoRoot, pendingRel);
  if (plan.allocated.length > 0) atomicWriteFile(backlogAbs, plan.newBacklogText);
  atomicWriteFile(pendingAbs, newPendingText(alloc, plan));
  const ids = plan.allocated.map((t) => t.id);
  commitPathsOrRestore(
    repoRoot,
    ids.length > 0
      ? `chore(backlog): allocate ${ids.join(", ")} from lane ${lane} (shipped)`
      : `chore(backlog): mark lane ${lane} pending tickets applied`,
    rels,
    [
      { abs: backlogAbs, text: plan.backlogText },
      { abs: pendingAbs, text: plan.pendingText },
    ],
    `agc feature finish --shipped: git commit on ${base} failed — ${BACKLOG_REL} and ` +
      `${pendingRel} restored; nothing applied, nothing removed`
  );
  printAppliedSummary(plan.allocated);
}

// --- finish-time lane close writeback (E125b, specs/e125b-*.md) -----------
// `--shipped` moves the lane's `.current/<lane>/` governance history into
// `.current/history/<YYYY-MM>/<lane>/` and leaves ONE durable pointer line
// under root tasks.md's `## Closed Lanes` (never a checkbox row, X3). Two
// shapes, told apart by hasTrackedContent on primary:
//   tracked   — `.current/<lane>/` merged in on --base: `git mv` + the
//               pointer, one path-limited commit on --base (AC1/AC2);
//   untracked — the adopter git-ignores `.current/`: the lane's only copy is
//               in its own worktree, fs-copied (never committed) into the
//               history bucket before the worktree is removed; the pointer
//               is still committed (AC9/AC10).
// E213: when root tasks.md is itself git-ignored (the same adopter shape), the
// pointer is written to it fs-only — never `git add`ed (git refuses an ignored
// path) — and the close commit carries only the `.current/` paths, or is
// skipped outright when nothing else needs one.
// planLaneClose only reads and refuses; executeLaneClose mutates and
// restores every file it touched on a failed commit.

const TASKS_REL = "tasks.md";
const CLOSED_LANES_HEADING = "## Closed Lanes";
const CLOSED_LANES_HEADING_RE = /^##\s+Closed Lanes\s*$/;
const SECTION_OR_TITLE_RE = /^#{1,2}\s/;
// e125a's feat marker (tools/tasks-lane-migrate.ts featMarker /
// MARKER_LANE_RE): `<!-- tasks_moved: lane=<lane> run=... -> ... -->`.
const TASKS_MOVED_LANE_RE = /^<!-- tasks_moved: lane=([A-Za-z0-9_-]+) /;
// A git object id: SHA-1 (40 hex) or SHA-256 (64 hex).
const BASE_SHA_RE = /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/;

// Copy / Strings e125b.closed-lane-pointer-line — the ONE composer.
function closedLanePointerLine({ ticketId, branch, baseSha, pr, historyRel, closedAt }) {
  return (
    `<!-- lane_closed: ticket=${ticketId} branch=${branch} base_sha=${baseSha} pr=${pr} ` +
    `history=${historyRel}/ closed_at=${closedAt} (base_sha invalidated by a history rewrite; ` +
    `git log -i --grep ${ticketId} is the universal fallback) -->`
  );
}

function hasClosedLanePointer(text, ticketId, branch) {
  const prefix = `<!-- lane_closed: ticket=${ticketId} branch=${branch} `;
  return text.split("\n").some((line) => line.startsWith(prefix));
}

// tasks.md text -> the same text with every e125a feat marker for `lane`
// removed (AC3: its target `.current/<lane>/tasks.md` is about to move) and
// `line` appended as the last row of the `## Closed Lanes` section, which is
// created at the end of the file when absent. Pure.
function applyClosedLanePointer(text, lane, line) {
  const trailingNewline = text.endsWith("\n");
  let lines = text === "" ? [] : (trailingNewline ? text.slice(0, -1) : text).split("\n");
  lines = lines.filter((l) => {
    const m = TASKS_MOVED_LANE_RE.exec(l);
    return !(m && m[1] === lane);
  });
  const h = lines.findIndex((l) => CLOSED_LANES_HEADING_RE.test(l));
  if (h === -1) {
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
    if (lines.length > 0) lines.push("");
    lines.push(CLOSED_LANES_HEADING, "", line);
  } else {
    let end = h + 1;
    while (end < lines.length && !SECTION_OR_TITLE_RE.test(lines[end])) end++;
    let last = end - 1;
    while (last > h && lines[last].trim() === "") last--;
    if (last === h) lines.splice(h + 1, 0, "", line);
    else lines.splice(last + 1, 0, line);
  }
  return `${lines.join("\n")}\n`;
}

// The lane's recorded fork point (T-E125B-07), read from the lane WORKTREE
// (the file is worktree-local — see LANE_EXCLUDE_RULES). Anything but a bare
// object id (absent, unreadable, a lane started before E125b) -> "unknown".
function readLaneBaseSha(lanePaths, lanePath, ticketId) {
  try {
    const text = fs.readFileSync(lanePaths.resolveLanePaths(lanePath, ticketId).baseShaPath, "utf-8").trim();
    return BASE_SHA_RE.test(text) ? text : "unknown";
  } catch {
    return "unknown";
  }
}

function readFileOrNull(abs) {
  try {
    return fs.readFileSync(abs, "utf-8");
  } catch (err) {
    if (err && err.code === "ENOENT") return null;
    throw err;
  }
}

function isDirectoryPath(p) {
  const st = lstatOrNull(p);
  return st !== null && st.isDirectory();
}

// The history dir a committed pointer names (`history=.current/history/<bucket>/<lane>/`),
// re-validated through resolveHistoryLaneDir; null when the field is missing,
// names another lane, or carries a bucket outside HISTORY_BUCKET_RE.
function closedLanePointerHistory(lanePaths, repoRoot, text, ticketId, branch) {
  const prefix = `<!-- lane_closed: ticket=${ticketId} branch=${branch} `;
  const line = text.split("\n").find((l) => l.startsWith(prefix));
  const m = line === undefined ? null : / history=\.current\/history\/([^/\s]+)\/([^/\s]+)\/ /.exec(line);
  if (m === null || m[2] !== ticketId) return null;
  try {
    return {
      histAbs: lanePaths.resolveHistoryLaneDir(repoRoot, m[1], ticketId),
      histRel: path.posix.join(".current", "history", m[1], ticketId),
    };
  } catch {
    return null;
  }
}

// Files under the lane worktree's `.current/<lane>/` that `git worktree remove`
// (never --force) deletes WITHOUT refusing: the git-ignored ones. Tracked edits
// and non-ignored untracked files make git refuse, so they are never at risk.
// `base-sha` is left out — its content is durable in the pointer's base_sha=.
function laneIgnoredStateFiles(lanePaths, lanePath, laneRel) {
  const baseShaRel = path.posix.join(laneRel, lanePaths.laneFile("baseSha").filename);
  const r = gitTry(lanePath, ["ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--", laneRel]);
  if (r.status !== 0) {
    process.stderr.write(r.stderr);
    // Fail closed: without the listing nothing proves the removal is lossless.
    throw new FeatureError(
      `agc feature finish --shipped: could not list git-ignored files under ${laneRel}/ in ${lanePath} (nothing removed)`
    );
  }
  return r.stdout
    .split("\0")
    .filter((p) => p.length > 0 && p !== baseShaRel);
}

function sameFileBytes(a, b) {
  try {
    const sa = fs.lstatSync(a);
    const sb = fs.lstatSync(b);
    if (!sa.isFile() || !sb.isFile() || sa.size !== sb.size) return false;
    return fs.readFileSync(a).equals(fs.readFileSync(b));
  } catch {
    return false;
  }
}

// Reads and refuses only. `alreadyClosed` = a pointer for this ticket+branch
// is already in tasks.md (a re-run after a later step — typically a refused
// `git worktree remove` — failed). The close itself is not redone, but the
// lane's git-ignored state may have changed since the first run's harvest
// (e125b R1): every such file whose history copy is missing or differs is
// returned as `refresh` so the re-run re-harvests it before the worktree goes.
function planLaneClose({ lanePaths, repoRoot, lanePath, ticketId, branch, pr, now }) {
  const tasksAbs = path.join(repoRoot, TASKS_REL);
  const tasksText = readFileOrNull(tasksAbs);
  const laneRel = path.posix.join(".current", ticketId);
  if (tasksText !== null && hasClosedLanePointer(tasksText, ticketId, branch)) {
    const atRisk = laneIgnoredStateFiles(lanePaths, lanePath, laneRel);
    if (atRisk.length === 0) return { alreadyClosed: true, refresh: null };
    const hist = closedLanePointerHistory(lanePaths, repoRoot, tasksText, ticketId, branch);
    if (hist === null) {
      throw new FeatureError(
        `agc feature finish --shipped: lane ${ticketId} is already recorded under ${TASKS_REL} ` +
          `${CLOSED_LANES_HEADING}, but its pointer's history= field does not resolve to a ` +
          `.current/history/<YYYY-MM>/${ticketId}/ dir, and ${lanePath} still holds git-ignored ` +
          `lane state that removing the worktree would delete — copy it somewhere safe and ` +
          `remove the worktree by hand (nothing removed):\n` +
          atRisk.map((p) => `  ${p}`).join("\n")
      );
    }
    const files = atRisk
      .map((p) => ({
        src: path.join(lanePath, p),
        dst: path.join(hist.histAbs, path.posix.relative(laneRel, p)),
        rel: p,
      }))
      .filter((f) => !sameFileBytes(f.src, f.dst));
    return { alreadyClosed: true, refresh: files.length > 0 ? { ...hist, files } : null };
  }
  if (branch.includes("-->")) {
    throw new FeatureError(
      `agc feature finish --shipped: branch ${JSON.stringify(branch)} contains "-->", which would ` +
        `break the tasks.md lane_closed comment line — rename the branch first (nothing applied, nothing removed)`
    );
  }
  const bucket = lanePaths.resolveHistoryBucket(now);
  const histAbs = lanePaths.resolveHistoryLaneDir(repoRoot, bucket, ticketId);
  const histRel = path.posix.join(".current", "history", bucket, ticketId);
  if (lstatOrNull(histAbs)) {
    throw new FeatureError(
      `agc feature finish --shipped: ${histRel} already exists in the primary checkout — move it ` +
        `aside first (nothing applied, nothing removed)`
    );
  }
  const tracked = hasTrackedContent(repoRoot, laneRel);
  const harvestSrc = path.join(lanePath, ".current", ticketId);
  const line = closedLanePointerLine({
    ticketId,
    branch,
    baseSha: readLaneBaseSha(lanePaths, lanePath, ticketId),
    pr,
    historyRel: histRel,
    closedAt: now.toISOString(),
  });
  return {
    alreadyClosed: false,
    ticketId,
    tracked,
    harvestSrc: !tracked && isDirectoryPath(harvestSrc) ? harvestSrc : null,
    // Picks the harvest advisory's reason clause: the spec's ignored-`.current/`
    // shape vs a lane that simply never committed `.current/<lane>/`.
    sourceIgnored: gitTry(repoRoot, ["check-ignore", "-q", "--", laneRel]).status === 0,
    // E213 AC1 — exit 0 only: a TRACKED tasks.md is never reported ignored
    // (check-ignore consults the index), so it keeps the committed path (AC4).
    tasksIgnored: gitTry(repoRoot, ["check-ignore", "-q", "--", TASKS_REL]).status === 0,
    laneRel,
    histRel,
    histAbs,
    bucket,
    tasksAbs,
    tasksText,
    newTasksText: applyClosedLanePointer(tasksText ?? "", ticketId, line),
    rels: [TASKS_REL, laneRel, histRel],
  };
}

// The missing ancestors of `dir` up to (not including) `stopAt`, deepest
// first — what a recursive mkdir would create, so a rollback can rmdir them.
function missingDirs(dir, stopAt) {
  const out = [];
  for (let d = dir; d !== stopAt && d.startsWith(stopAt) && !lstatOrNull(d); d = path.dirname(d)) {
    out.push(d);
  }
  return out;
}

// Any pending-ticket commit made just before this step stays (re-running
// skips entries already in the backlog), so the refusal never says "nothing
// applied" here.
const CLOSE_NOT_APPLIED =
  "lane close not applied, worktree and branch left in place (re-running finish is safe)";

// E213 T02 (AC5): every stdout line this step prints is buffered in `out` and
// flushed only once the step's mutations have all durably succeeded — the
// close commit landed, or (no commit needed) the fs-only pointer write did —
// so a failed-and-rolled-back run never claims a harvest that no longer
// exists. Mutation order (and so line order, AC2): the tasks.md pointer
// write first, then the `.current/<lane>/` move or harvest.
function executeLaneClose({ repoRoot, base, close }) {
  const {
    ticketId, tracked, harvestSrc, sourceIgnored, tasksIgnored, laneRel, histRel, histAbs, bucket, tasksAbs, tasksText,
  } = close;
  const createdDirs = missingDirs(path.dirname(histAbs), path.join(repoRoot, ".current"));
  const out = [];
  // Set BEFORE cpSync (e125b R2): a copy that throws part-way has already
  // created histAbs, and planLaneClose asserted histAbs was absent, so
  // everything under it is this run's own output and rollback may remove it.
  let harvestStarted = false;
  let moved = false;
  let tasksAdded = false;
  const rollback = () => {
    if (moved) gitTry(repoRoot, ["mv", "--", histRel, laneRel]);
    if (harvestStarted) fs.rmSync(histAbs, { recursive: true, force: true });
    if (tasksText !== null) {
      atomicWriteFile(tasksAbs, tasksText);
    } else {
      if (tasksAdded) gitTry(repoRoot, ["rm", "--cached", "--quiet", "--", TASKS_REL]);
      fs.rmSync(tasksAbs, { force: true });
    }
    for (const d of createdDirs) {
      try {
        fs.rmdirSync(d);
      } catch {
        /* not empty — leave it */
      }
    }
  };
  const fail = (message, stderr) => {
    rollback();
    if (stderr) process.stderr.write(stderr);
    throw new FeatureError(message);
  };

  try {
    if (tasksText !== null) {
      atomicWriteFile(tasksAbs, close.newTasksText);
    } else {
      fs.writeFileSync(tasksAbs, close.newTasksText);
    }
    if (tasksIgnored) {
      // Copy / Strings e213.tasks-fsonly-line (AC1) — no `git add`: git
      // refuses an ignored path, and the pointer is recorded all the same.
      out.push(
        `agc feature finish — ${TASKS_REL} is git-ignored here: wrote the lane-close pointer to it ` +
          `directly (fs write, not committed)\n`
      );
    } else if (gitTry(repoRoot, ["ls-files", "--error-unmatch", "--", TASKS_REL]).status !== 0) {
      const add = gitTry(repoRoot, ["add", "--", TASKS_REL]);
      if (add.status !== 0) {
        fail(`agc feature finish --shipped: git add ${TASKS_REL} failed — ${CLOSE_NOT_APPLIED}`, add.stderr);
      }
      tasksAdded = true;
    }
    fs.mkdirSync(path.dirname(histAbs), { recursive: true });
    if (tracked) {
      const mv = gitTry(repoRoot, ["mv", "--", laneRel, histRel]);
      if (mv.status !== 0) {
        fail(`agc feature finish --shipped: git mv ${laneRel} ${histRel} failed — ${CLOSE_NOT_APPLIED}`, mv.stderr);
      }
      moved = true;
    } else if (harvestSrc !== null) {
      harvestStarted = true;
      fs.cpSync(harvestSrc, histAbs, { recursive: true, errorOnExist: true, force: false });
      // Copy / Strings e125b.harvest-advisory-line (reason clause per sourceIgnored).
      const reason = sourceIgnored
        ? `the source path is git-ignored in this workspace`
        : `this lane never committed .current/${ticketId}/, so there was nothing on ${base} to git mv`;
      out.push(
        `agc feature finish — harvested untracked .current/${ticketId}/ into .current/history/${bucket}/${ticketId}/ ` +
          `(fs copy, not committed — ${reason}; if your .gitignore ` +
          `does not also cover .current/history/, this copy will show up as untracked in \`git status\` here)\n`
      );
    }
  } catch (err) {
    if (err instanceof FeatureError) throw err;
    fail(
      `agc feature finish --shipped: lane close for ${ticketId} failed ` +
        `(${err && err.message ? err.message : String(err)}) — ${CLOSE_NOT_APPLIED}`
    );
  }

  // E213 AC3 — an ignored tasks.md leaves the commit only the `.current/`
  // paths a tracked lane dir moves; with neither, no commit is attempted at
  // all (never an empty-pathspec one).
  const rels = [...(tasksIgnored ? [] : [TASKS_REL]), ...(tracked ? [laneRel, histRel] : [])];
  if (rels.length === 0) {
    // Copy / Strings e213.tasks-nocommit-line — in place of the "recorded
    // lane" line, which would otherwise describe a commit that never happened.
    out.push(
      `agc feature finish — lane ${ticketId} closed with no primary commit (nothing here is git-tracked: ` +
        `${TASKS_REL} and .current/${ticketId}/ are both git-ignored) — the fs-only writes above are ` +
        `this lane's only durable record\n`
    );
    process.stdout.write(out.join(""));
    return;
  }
  const c = gitTry(repoRoot, [
    "commit",
    "-m",
    tracked
      ? `chore(lanes): close lane ${ticketId} (shipped) — ${laneRel}/ -> ${histRel}/`
      : `chore(lanes): record closed lane ${ticketId} (shipped)`,
    "--",
    ...rels,
  ]);
  if (c.status !== 0) {
    fail(
      `agc feature finish --shipped: git commit on ${base} failed — ${TASKS_REL} and ${laneRel}/ ` +
        `restored; ${CLOSE_NOT_APPLIED}`,
      c.stderr
    );
  }
  out.push(
    tracked
      ? `agc feature finish — moved ${laneRel}/ -> ${histRel}/ and recorded it under ${TASKS_REL} ${CLOSED_LANES_HEADING}\n`
      : `agc feature finish — recorded lane ${ticketId} under ${TASKS_REL} ${CLOSED_LANES_HEADING}\n`
  );
  process.stdout.write(out.join(""));
}

// The alreadyClosed re-run's re-harvest (e125b R1): copy each git-ignored
// lane file whose history copy is missing or differs (planLaneClose's
// `refresh`) over that copy, BEFORE removeWorktreeNoForce. Overwriting is
// lossless by construction: agc's only writer of that history dir is the
// harvest of this same live lane dir, so a differing copy is an older snapshot
// the lane has since superseded — the result equals a first close run now.
// Files present only in the history copy are kept. A failed copy leaves the
// worktree in place; re-running redoes the comparison.
function executeHarvestRefresh({ ticketId, refresh }) {
  try {
    for (const f of refresh.files) {
      fs.mkdirSync(path.dirname(f.dst), { recursive: true });
      fs.cpSync(f.src, f.dst, { force: true });
    }
  } catch (err) {
    throw new FeatureError(
      `agc feature finish --shipped: re-harvest of .current/${ticketId}/ into ${refresh.histRel}/ failed ` +
        `(${err && err.message ? err.message : String(err)}) — worktree and branch left in place (re-running finish is safe)`
    );
  }
  // Copy / Strings e125b.harvest-refresh-line.
  process.stdout.write(
    `agc feature finish — lane ${ticketId} was already closed, but ${refresh.files.length} git-ignored ` +
      `file(s) under .current/${ticketId}/ changed since its history copy; re-harvested into ` +
      `${refresh.histRel}/ before removing the worktree:\n` +
      refresh.files.map((f) => `  ${f.rel}\n`).join("")
  );
}

// --- finish --shipped evidence harvest (E214, specs/e213-shipped-ignored-shape.md) ---
// `git worktree remove` (never --force) deletes untracked, git-ignored files
// WITHOUT refusing, so a lane whose qa_reports/ / review_reports/ / specs/ are
// git-ignored and not linked back to primary would lose its whole review
// trail on --shipped. The same shape E180 closed for --abandoned, with three
// deliberate differences: every file is taken (no ticket-token filter — the
// worktree is a dedicated lane's and goes for good), the walk is recursive
// (each file keeps its path relative to the dir root), and the destination is
// the release-engineer 7a convention `<dir>/archive/<ticket>/<relpath>`.
//   planShippedEvidenceHarvest  — reads and refuses only (AC8, AC17), run
//                                 with planLaneClose before any mutation.
//   applyShippedEvidenceHarvest — the fs copies, just before the worktree is
//                                 removed (never committed).

// Every regular file under `rootAbs` (a real directory, or a symlink to one
// the caller already resolved), as { rel, readAbs } with `rel` posix and
// relative to the evidence dir root. A symlink is DEREFERENCED (AC17, E207):
// `readAbs` is its resolved target, so the harvest copies content, never a
// link back into the worktree about to be removed; a symlink to a directory
// is walked through. A symlink that does not resolve lands in `dangling`
// (with `rel` for the caller to report). `chain` holds the real paths of the
// directories on the current descent, so a link cycle stops instead of
// recursing forever — the content it points at is already walked by the
// ancestor that closed the cycle.
function walkEvidenceTree(dirAbs, relPrefix, chain, files, dangling) {
  let entries;
  try {
    entries = fs.readdirSync(dirAbs, { withFileTypes: true });
  } catch (err) {
    throw new FeatureError(
      `agc feature finish --shipped: could not read ${relPrefix}/ in the lane worktree ` +
        `(${err && err.message ? err.message : String(err)}) — nothing removed`
    );
  }
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  for (const d of entries) {
    const abs = path.join(dirAbs, d.name);
    const rel = `${relPrefix}/${d.name}`;
    if (d.isSymbolicLink()) {
      let real;
      let st;
      try {
        real = fs.realpathSync(abs);
        st = fs.statSync(real);
      } catch {
        dangling.push(rel);
        continue;
      }
      if (st.isDirectory()) {
        if (!chain.has(real)) walkEvidenceTree(real, rel, new Set([...chain, real]), files, dangling);
      } else if (st.isFile()) {
        files.push({ rel, readAbs: real });
      }
    } else if (d.isDirectory()) {
      let real;
      try {
        real = fs.realpathSync(abs);
      } catch {
        real = abs;
      }
      walkEvidenceTree(abs, rel, new Set([...chain, real]), files, dangling);
    } else if (d.isFile()) {
      files.push({ rel, readAbs: abs });
    }
  }
}

// The nearest existing ancestor of `abs` strictly below `stopAt` that is NOT
// a directory (a file where the copy needs a directory) — else null. Lets
// the plan refuse the copy that would otherwise fail mid-apply.
function blockingAncestor(abs, stopAt) {
  for (let d = path.dirname(abs); d !== stopAt && d.startsWith(stopAt + path.sep); d = path.dirname(d)) {
    let st;
    try {
      st = fs.statSync(d);
    } catch {
      continue; // absent — mkdir creates it
    }
    if (!st.isDirectory()) return d;
  }
  return null;
}

// Read-only. Returns { copies: [{ src, dst, dir, readAbs, dstAbs }] } — the
// copies still to make (an identical destination already there, a re-run,
// needs none — AC9) — or throws, before anything is mutated, on an
// unresolvable symlink among the at-risk files (AC17) or a differing
// destination (AC8). "At risk" is per FILE, never per directory
// (hasIgnoredUntrackedContent): untracked, and `git check-ignore` not exit 1
// — any other non-zero (128: a path beyond a symlink) cannot prove the file
// survives, so it fails toward harvesting, as evidenceAtRisk does. A plain
// untracked file (exit 1) is left alone: git's own worktree remove refuses
// over it (AC10).
function planShippedEvidenceHarvest({ repoRoot, lanePath, ticketId }) {
  const tracked = new Set(
    git(lanePath, ["ls-files", "-z", "--", ...SHIPPED_EVIDENCE_DIRS])
      .split("\0")
      .filter((p) => p.length > 0)
  );
  const atRisk = (rel) =>
    !tracked.has(rel) && gitTry(lanePath, ["check-ignore", "-q", "--", rel]).status !== 1;

  const copies = [];
  const conflicts = [];
  const danglingByDir = [];
  for (const dir of SHIPPED_EVIDENCE_DIRS) {
    const rootAbs = path.join(lanePath, dir);
    const st = lstatOrNull(rootAbs);
    if (st === null) continue; // AC11 — absent
    if (isSafelyLinkedOutside(lanePath, rootAbs)) continue; // AC7 — survives the removal on its own
    let rootReal;
    try {
      rootReal = fs.realpathSync(rootAbs);
    } catch {
      // A dangling dir-level link holds no bytes to lose (and a dir symlink
      // is never git-ignored-untracked content in itself worth copying).
      continue;
    }
    if (!isDirectoryPath(rootReal)) continue;
    const files = [];
    const dangling = [];
    walkEvidenceTree(rootReal, dir, new Set([rootReal]), files, dangling);
    const danglingAtRisk = dangling.filter(atRisk);
    if (danglingAtRisk.length > 0) danglingByDir.push({ dir, paths: danglingAtRisk });
    for (const f of files) {
      if (!atRisk(f.rel)) continue;
      const sub = f.rel.slice(dir.length + 1);
      const dst = path.posix.join(dir, "archive", ticketId, sub);
      const dstAbs = path.join(repoRoot, ...dst.split("/"));
      const blocker = blockingAncestor(dstAbs, repoRoot);
      if (blocker !== null) {
        conflicts.push(blocker);
      } else if (lstatOrNull(dstAbs) === null) {
        copies.push({ src: f.rel, dst, dir, readAbs: f.readAbs, dstAbs });
      } else if (!sameFileBytes(f.readAbs, dstAbs)) {
        conflicts.push(dstAbs);
      }
    }
  }
  if (danglingByDir.length > 0) {
    // Copy / Strings e214.evidence-harvest-symlink-refuse-line, one block per dir.
    throw new FeatureError(
      danglingByDir
        .map(
          ({ dir, paths }) =>
            `agc feature finish --shipped: harvest of ${dir}/ found unresolvable symlink(s) — ` +
            `refusing before any mutation (nothing moved):\n` +
            paths.map((p) => `  ${p}`).join("\n")
        )
        .join("\n")
    );
  }
  if (conflicts.length > 0) {
    // Copy / Strings e180.evidence-harvest-refuse-line, --shipped verb token.
    throw new FeatureError(
      `agc feature finish --shipped: harvest destination already exists in the primary checkout and differs (nothing moved):\n` +
        [...new Set(conflicts)].map((p) => `  ${p}`).join("\n")
    );
  }
  return { copies };
}

// The copies planShippedEvidenceHarvest asked for, after the lane close and
// just before removeWorktreeNoForce (so they capture the lane's final state).
// COPYFILE_EXCL, content only (readAbs is already dereferenced). A copy that
// throws drops its own partial output and leaves the worktree and branch in
// place; the copies already made are byte-identical on a re-run, which then
// makes none of them again (AC9).
function applyShippedEvidenceHarvest(harvest) {
  for (const c of harvest.copies) {
    try {
      fs.mkdirSync(path.dirname(c.dstAbs), { recursive: true });
      fs.copyFileSync(c.readAbs, c.dstAbs, fs.constants.COPYFILE_EXCL);
    } catch (err) {
      if (!err || err.code !== "EEXIST") fs.rmSync(c.dstAbs, { force: true });
      throw new FeatureError(
        `agc feature finish --shipped: harvest of ${c.src} into the primary checkout failed ` +
          `(${err && err.message ? err.message : String(err)}) — worktree and branch left in place ` +
          `(re-running finish is safe)`
      );
    }
    // Copy / Strings e180.evidence-harvest-line (reused; dst under archive/<ticket>/).
    process.stdout.write(
      `agc feature finish — harvested git-ignored evidence ${c.src} -> primary ${c.dst} ` +
        `(fs copy, not committed — ${c.dir}/ is git-ignored here and not linked outside the worktree, ` +
        `so \`git worktree remove\` would otherwise delete it silently)\n`
    );
  }
}

// --abandoned (spec AC3; architecture "Step order — --abandoned" 2–M3). The
// branch never merges, so the pending file is read from the branch ref and
// archived by a commit ON the branch, in the lane's own worktree; the
// backlog rows are committed on --base in the primary checkout. Returns the
// evidence plan (C4, hoisted before every mutation — AC3(a)) or null when the
// caller should plan it itself.
async function applyPendingOnAbandoned({ lanePaths, repoRoot, lanePath, branch, base, lane, ticketId }) {
  const pendingRel = path.posix.join(".current", lane, lanePaths.laneFile("pendingTickets").filename);
  const branchRef = `refs/heads/${branch}`;
  const pendingText = readBlob(repoRoot, branchRef, pendingRel);
  if (pendingText === null) return null;
  resolveBaseCommit(repoRoot, base, "finish"); // DR-5: only when it is used
  const alloc = await loadTicketAllocation();
  const plan = planPendingApply({
    alloc, repoRoot, pendingText, revLabel: branch, base, lane, pendingRel, verb: "--abandoned",
  });
  if (plan === null) return null;
  const { moves } = planAbandonEvidence(lanePath, ticketId); // C4 (G4(a))
  const onBase = plan.toAllocate.length > 0;
  if (onBase) assertPrimaryWritable(repoRoot, base, [BACKLOG_REL, pendingRel], "--abandoned");

  printSkipped(lane, plan.skipped);
  const ids = plan.allocated.map((t) => t.id);
  if (onBase) {
    const backlogAbs = path.join(repoRoot, BACKLOG_REL);
    atomicWriteFile(backlogAbs, plan.newBacklogText);
    // Backlog only: the pending file is not on --base (naming it would fail
    // with "pathspec did not match").
    commitPathsOrRestore(
      repoRoot,
      `chore(backlog): allocate ${ids.join(", ")} from lane ${lane} (abandoned)`,
      [BACKLOG_REL],
      [{ abs: backlogAbs, text: plan.backlogText }],
      `agc feature finish --abandoned: git commit on ${base} failed — ${BACKLOG_REL} ` +
        `restored; nothing applied, nothing removed`
    );
  }

  const pendingAbs = path.join(lanePath, pendingRel);
  atomicWriteFile(pendingAbs, newPendingText(alloc, plan));
  const archived = [...ids, ...plan.skipped.values()];
  commitPathsOrRestore(
    lanePath,
    `chore(lane): mark ${lane} pending tickets applied (${archived.join(", ")})`,
    [pendingRel],
    [{ abs: pendingAbs, text: plan.pendingText }],
    `agc feature finish --abandoned: git commit of ${pendingRel} on ${branch} failed — ` +
      (onBase
        ? `the backlog commit on ${base} (${ids.join(", ")}) DID land; `
        : `no backlog commit was needed; `) +
      `re-running \`agc feature finish --abandoned ${ticketId}\` is idempotent (it skips ` +
      `entries already in ${BACKLOG_REL}); worktree left in place`
  );
  process.stdout.write(`agc feature finish — archived pending tickets on ${branch}\n`);
  printAppliedSummary(plan.allocated);
  return moves;
}

async function runFeatureFinish(cwd, argv) {
  const { positionals, opts } = parseFeatureArgs(argv, ["base", "pr"], ["shipped", "abandoned"]);
  if (positionals.length !== 1) {
    throw usageError("agc feature finish: expected exactly one <ticket-id>");
  }
  if (Boolean(opts.shipped) === Boolean(opts.abandoned)) {
    throw usageError("agc feature finish: exactly one of --shipped / --abandoned is required");
  }
  // e125b AC12 — operator-supplied PR number; never queried from a PR host.
  if (opts.pr !== undefined) {
    if (!/^\d+$/.test(opts.pr)) {
      throw usageError(`agc feature finish: invalid --pr ${JSON.stringify(opts.pr)} (expected a number)`);
    }
    if (!opts.shipped) {
      throw usageError("agc feature finish: --pr applies only to --shipped");
    }
  }

  // AC18 — primary-checkout guard.
  const repoRoot = resolvePrimaryRepoRoot(cwd, "finish");

  const lanePaths = await loadLanePaths();
  const raw = positionals[0];
  const ticketId = raw.toLowerCase();
  if (raw !== raw.trim() || lanePaths.resolveLaneName(raw) !== ticketId) {
    throw usageError(
      `agc feature finish: ${JSON.stringify(raw)} is not a bare ticket id (expected e.g. e73)`
    );
  }

  // Target = the linked worktree whose checked-out branch resolveCurrentLane
  // names exactly `ticketId` (no substring match: e73 never hits e730).
  const primaryCanon = canonicalPath(repoRoot);
  const matches = listWorktrees(repoRoot)
    .slice(1)
    .filter(
      (w) =>
        w.branch !== null &&
        w.branch.startsWith("refs/heads/") &&
        canonicalPath(w.path) !== primaryCanon &&
        lanePaths.resolveCurrentLane(w.path) === ticketId
    );
  if (matches.length === 0) {
    throw new FeatureError(`agc feature finish: no linked worktree found for lane ${ticketId}`);
  }
  if (matches.length > 1) {
    throw new FeatureError(
      `agc feature finish: more than one linked worktree resolves to lane ${ticketId} — ` +
        `remove the extra one by hand first:\n` +
        matches.map((w) => `  ${w.path} (${w.branch})`).join("\n")
    );
  }
  const lanePath = matches[0].path;
  const branch = matches[0].branch.slice("refs/heads/".length);

  if (opts.shipped) {
    // AC16 — merge guard, --shipped only.
    const base = opts.base ?? "main";
    resolveBaseCommit(repoRoot, base, "finish");
    const anc = gitTry(repoRoot, ["merge-base", "--is-ancestor", `refs/heads/${branch}`, base]);
    if (anc.status === 1) {
      throw new FeatureError(
        `agc feature finish --shipped: ${branch} is not merged into ${base} — merge it ` +
          `first, or use --abandoned to retire an unmerged lane (a lane started with a ` +
          `non-default --base must pass the same --base here); nothing removed`
      );
    }
    if (anc.status !== 0) {
      process.stderr.write(anc.stderr);
      throw new FeatureError(`agc feature finish --shipped: merge check failed — nothing removed`);
    }
    // E179 AC2 — apply the lane's pending tickets on --base before teardown;
    // then E125b AC1/AC2/AC9 — close the lane's .current/<lane>/ into history
    // and record the pointer, also on --base. Every refusal (pending content,
    // close plan, E214 evidence-harvest plan, then primary state over BOTH
    // commits' paths) runs before the first mutation.
    const pending = await planPendingOnShipped({ lanePaths, repoRoot, base, lane: ticketId });
    const close = planLaneClose({
      lanePaths, repoRoot, lanePath, ticketId, branch, pr: opts.pr ?? "none", now: new Date(),
    });
    // E214 — planned on every run, the alreadyClosed re-run included (a
    // refused worktree remove leaves the evidence at risk until it goes).
    const evidenceHarvest = planShippedEvidenceHarvest({ repoRoot, lanePath, ticketId });
    if (pending !== null || !close.alreadyClosed) {
      assertPrimaryWritable(
        repoRoot,
        base,
        [...(pending !== null ? pending.rels : []), ...(close.alreadyClosed ? [] : close.rels)],
        "--shipped",
        pending !== null ? "pending tickets are" : "the lane-close pointer is"
      );
    }
    if (pending !== null) commitPendingOnShipped({ repoRoot, base, lane: ticketId, pending });
    if (close.alreadyClosed) {
      process.stdout.write(
        `agc feature finish — lane ${ticketId} already recorded under ${TASKS_REL} ${CLOSED_LANES_HEADING}, ` +
          `skipping the close writeback\n`
      );
      if (close.refresh !== null) executeHarvestRefresh({ ticketId, refresh: close.refresh });
    } else {
      executeLaneClose({ repoRoot, base, close });
    }
    applyShippedEvidenceHarvest(evidenceHarvest);
    removeWorktreeNoForce(repoRoot, lanePath); // AC17/AC19
    process.stdout.write(`agc feature finish — removed worktree ${lanePath}\n`);
    const del = gitTry(repoRoot, ["branch", "-d", branch]); // safe delete, never -D
    if (del.status !== 0) {
      process.stderr.write(del.stderr);
      throw new FeatureError(
        `agc feature finish --shipped: worktree removed, but \`git branch -d ${branch}\` ` +
          `refused — delete it by hand once you have checked why`
      );
    }
    process.stdout.write(`agc feature finish — deleted branch ${branch}\n`);
    return;
  }

  // --abandoned: no merge guard (AC20). E179 AC3 — pending tickets first
  // (their checks include the evidence precondition, hoisted), then the
  // evidence move as its own commit (DR-4). E194 — the `.current/<ticket>/`
  // harvest is planned (its refusal included) before any of those mutations
  // and executed last, just before the worktree is removed.
  const currentHarvest = planAbandonCurrentHarvest({
    lanePaths, lanePath, ticketId, branch, now: new Date(),
  });
  const plannedMoves = await applyPendingOnAbandoned({
    lanePaths,
    repoRoot,
    lanePath,
    branch,
    base: opts.base ?? "main",
    lane: ticketId,
    ticketId,
  });
  const moves = plannedMoves ?? planAbandonEvidence(lanePath, ticketId).moves;
  const { committed, untrackedMoved } = applyAbandonEvidence(lanePath, ticketId, moves);
  if (committed) {
    process.stdout.write(`agc feature finish — committed evidence move on ${branch}\n`);
  }
  const hint =
    untrackedMoved.length > 0
      ? `untracked evidence was moved but not committed (nothing to git mv): ` +
        untrackedMoved.join(", ") +
        ` — git add + commit it in the lane and re-run, or remove the worktree by hand`
      : null;
  if (currentHarvest !== null) executeAbandonCurrentHarvest(currentHarvest);
  removeWorktreeNoForce(repoRoot, lanePath, hint);
  process.stdout.write(`agc feature finish — removed worktree ${lanePath}\n`);
  // AC26 — the branch is deliberately kept (E124's orphan detector needs it).
  process.stdout.write(`agc feature finish — kept branch ${branch} (abandoned lanes keep their branch)\n`);
}

async function runFeature(cwd, argv) {
  const verb = argv[0];
  if (verb === "start") return runFeatureStart(cwd, argv.slice(1));
  if (verb === "finish") return runFeatureFinish(cwd, argv.slice(1));
  throw usageError(
    verb === undefined
      ? "agc feature: missing subcommand (start | finish)"
      : `agc feature: unknown subcommand ${JSON.stringify(verb)} (start | finish)`
  );
}

function handleFeatureError(err) {
  if (err instanceof FeatureError) {
    process.stderr.write(`${err.message}\n`);
    if (err.usage) process.stderr.write(`Usage:\n${STR_USAGE_FEATURE}`);
    process.exit(err.exitCode);
  }
  process.stderr.write(`agc feature: ${err && err.message ? err.message : String(err)}\n`);
  process.exit(1);
}

// --- subcommand: eject -----------------------------------------------------
// `agc eject` takes agc back out of a workspace. What it touches, by class:
//   (i)    machine state     .current/
//   (ii-b) process evidence  tasks.md, qa_reports/, review_reports/
//   (ii-a) domain knowledge  design/, specs/, docs/backlog.md — kept unless
//                            --purge-knowledge, since they are the project's
//                            own rationale and plan, not agc bookkeeping
//   (iii)  host traces       CLAUDE.md's adapter block, AGENTS.md and
//                            .antigravityrules, and this workspace's
//                            artifact lines in .git/info/exclude
// Dry-run unless --yes. The disposition of every path is decided from the
// actual index, never from the declared "artifacts" value: an untracked path
// is deleted from disk; a tracked one is only named in one printed
// `git rm -r` line, because removing it changes what every clone sees and
// cannot remove it from history. eject never runs a git command that changes
// the repository, and never reads stdin.

const STR_USAGE_EJECT =
  "  eject [--yes] [--purge-knowledge]\n" +
  "          Print (default) or execute (--yes) the removal plan for agc's own\n" +
  "          runtime artifacts, process evidence, and host traces. --purge-knowledge\n" +
  "          additionally offers to remove design/ and specs/ (never by default).\n" +
  "          Never interactive. See docs/install.md for the full disposition table.\n";

// Domain-knowledge paths, root-anchored like ARTIFACT_EXCLUDE_RULES so the
// same prefix helpers re-anchor them for a subdirectory workspace. These are
// never written to an exclude file; the rule shape is only reused for paths.
const KNOWLEDGE_RULES = ["/design/", "/specs/", `/${BACKLOG_REL}`];

// A path carrying a C0 control byte or DEL — the class escapeSegmentForDisplay()
// rewrites. Such a path is printed escaped, so a paste-me command built from
// it would name a different path than the one on disk, and embedding the raw
// byte instead would carry it into whatever shell runs the command. The
// command line is therefore replaced by this note.
const CONTROL_CHAR_RE = /[\x00-\x1f\x7f]/;
const STR_EJECT_CONTROL_CHAR_NOTE =
  "note: one or more of the path(s) above contain a control character and cannot be pasted into a command safely — remove it by hand.";

// Every flag is boolean; anything else (including a positional) is a usage
// error raised before anything is read or written.
function parseEjectArgs(argv) {
  const opts = { yes: false, purgeKnowledge: false };
  for (const a of argv) {
    if (a === "--yes") opts.yes = true;
    else if (a === "--purge-knowledge") opts.purgeKnowledge = true;
    else throw usageError(`agc eject: unknown option ${a}`);
  }
  return opts;
}

// The agc subagent templates present in ~/.claude/agents/: only files named
// like one shipped under templates/claude-code-agents/, so a user's own
// agents there are never listed (and never end up in the printed rm line).
function installedAgentTemplates() {
  let names;
  try {
    names = fs.readdirSync(path.join(pkgRoot(), "templates", "claude-code-agents"));
  } catch {
    return [];
  }
  const dir = path.join(os.homedir(), ".claude", "agents");
  return names
    .filter((n) => n.endsWith(".md"))
    .sort()
    .map((n) => path.join(dir, n))
    .filter((f) => lstatOrNull(f) !== null);
}

function ejectCannotDoBlock() {
  const present = installedAgentTemplates();
  const tail =
    present.length === 0
      ? "       (none)\n"
      : present.map((f) => `       ${escapeSegmentForDisplay(f)}\n`).join("") +
        "     Remove them yourself with:\n" +
        (present.some((f) => CONTROL_CHAR_RE.test(f))
          ? `       ${STR_EJECT_CONTROL_CHAR_NOTE}\n`
          : `       rm ${present.join(" ")}\n`);
  return (
    "agc eject cannot do the following — review and act on these yourself:\n" +
    "  1. Rewrite git history: any of the above that was ever tracked remains in git history even after this command untracks or deletes it.\n" +
    "  2. Edit code comments: citations to specs/, qa_reports/, review_reports/, or ticket/AC ids inside source comments are not machine-decidable and are left as-is.\n" +
    "  3. Edit your host's MCP/settings registration: this server's entry in .mcp.json, ~/.claude.json, or an equivalent settings file is untouched. Claude Code:\n" +
    "       claude mcp remove -s user agent-governance-mcp\n" +
    "     Other hosts: remove this server's entry from their MCP config file by hand.\n" +
    "  4. Remove the machine-wide subagent templates in ~/.claude/agents/: they may be in use by other projects on this machine, so eject never deletes them. Present:\n" +
    tail
  );
}

// Plan entry shape, shared by every class:
//   line(applied)   the plan line — applied=false for the dry-run wording
//   apply           performs the entry under --yes; null for a line that only
//                   reports (a KEPT path). "Nothing to eject" means no entry
//                   has an apply and nothing is tracked.
//   untrackedDelete true when apply deletes an untracked path from disk
//   trackedChange   host traces only: "edited" or "deleted" when apply
//                   changes a tracked file in the working tree, else absent.
//                   Such a change is uncommitted until the adopter commits
//                   it, so it is listed after the plan lines.
//   display         the path named in that list (set with trackedChange);
//                   raw — escaped only where it is printed
//   advisory        true for a report-only line that still prints when there
//                   is nothing to eject (a file left for the adopter to review)

// Host-trace entries (class iii), in plan order: the CLAUDE.md adapter block,
// AGENTS.md / .antigravityrules, and this workspace's artifact exclude lines.
// ctx = { cwd, repoRoot, workspace } (repoRoot null outside git).
function planHostTraceEntries(ctx) {
  const entries = [];
  const claude = planClaudeBlockEntry(ctx);
  if (claude !== null) entries.push(claude);
  for (const { rel, tpl, mode } of ADAPTERS) {
    if (mode !== "skip") continue;
    const e = planAdapterFileEntry(ctx, rel, tpl);
    if (e !== null) entries.push(e);
  }
  const exclude = planExcludeEntry(ctx);
  if (exclude !== null) entries.push(exclude);
  return entries;
}

// The repo-relative display for a workspace file (`CLAUDE.md`, `sub/CLAUDE.md`).
function workspaceDisplay(workspace, rel) {
  return workspace.prefix === "" ? rel : `${workspace.prefix}/${rel}`;
}

// Whether workspace file `rel` is in the index; false outside git.
function isWorkspaceFileTracked(ctx, rel) {
  if (ctx.repoRoot === null) return false;
  const target = workspaceDisplay(ctx.workspace, rel);
  return trackedArtifactPaths(ctx.repoRoot, [{ display: target, target }]).length > 0;
}

// Reverse of writeClaudeBlock: drop the first BEGIN..END block, markers
// inclusive, keeping every byte outside it. When what remains is only
// whitespace the file held nothing but the block (a fresh `agc init` creates
// exactly that), so the whole file is deleted rather than left empty. An
// absent file is skipped silently; a file without a well-formed marker pair
// is reported and left alone.
function planClaudeBlockEntry(ctx) {
  const abs = path.join(ctx.cwd, "CLAUDE.md");
  if (!fs.existsSync(abs)) return null;
  const display = workspaceDisplay(ctx.workspace, "CLAUDE.md");
  const label = `(iii) host traces — ${escapeSegmentForDisplay(display)}`;
  const existing = fs.readFileSync(abs, "utf-8");
  const beginIdx = existing.indexOf(CLAUDE_BEGIN);
  const endIdx = existing.indexOf(CLAUDE_END);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    const line = `${label}: no adapter block found — nothing to do`;
    return { line: () => line, apply: null, untrackedDelete: false };
  }
  const rest = existing.slice(0, beginIdx) + existing.slice(endIdx + CLAUDE_END.length);
  const tracked = isWorkspaceFileTracked(ctx, "CLAUDE.md");
  if (rest.trim() === "") {
    return {
      line: (applied) =>
        applied
          ? `${label}: adapter block removed (file deleted, held only the block)`
          : `${label}: REMOVE adapter block (file will be deleted, holds only the block)`,
      // rmSync removes a symlink itself, never what it points to.
      apply: () => fs.rmSync(abs, { force: true }),
      untrackedDelete: !tracked,
      ...(tracked ? { trackedChange: "deleted", display } : {}),
    };
  }
  return {
    line: (applied) =>
      applied
        ? `${label}: adapter block removed (file kept, other content preserved)`
        : `${label}: REMOVE adapter block (file kept, other content preserved)`,
    apply: () => atomicWriteFile(abs, rest),
    untrackedDelete: false,
    ...(tracked ? { trackedChange: "edited", display } : {}),
  };
}

// AGENTS.md / .antigravityrules: deleted only when the file is exactly what
// some version of `agc init` wrote — its version stamp put back to the
// template placeholder, it must equal the installed template byte for byte.
// Anything else (no stamp, edited body, a template that has since changed,
// an unreadable file or template) is kept with an advisory; nothing is
// guessed. An absent file is skipped silently.
function planAdapterFileEntry(ctx, rel, tpl) {
  const abs = path.join(ctx.cwd, rel);
  if (lstatOrNull(abs) === null) return null;
  const display = workspaceDisplay(ctx.workspace, rel);
  const label = `(iii) host traces — ${escapeSegmentForDisplay(display)}`;
  let matches = false;
  try {
    const text = fs.readFileSync(abs, "utf-8");
    const m = STAMP_RE.exec(text);
    if (m !== null) {
      const verStart = m.index + m[0].length - m[1].length;
      const normalized = text.slice(0, verStart) + AGC_VERSION_TOKEN + text.slice(verStart + m[1].length);
      matches = normalized === readAdapterTemplate(tpl);
    }
  } catch {
    matches = false;
  }
  if (!matches) {
    const line = `${label}: KEPT — may hold content beyond agc's own template; review and remove by hand`;
    return { line: () => line, apply: null, untrackedDelete: false, advisory: true };
  }
  const tracked = isWorkspaceFileTracked(ctx, rel);
  return {
    line: (applied) =>
      applied ? `${label}: deleted (matched the installed template)` : `${label}: DELETE (matches the installed template)`,
    apply: () => fs.rmSync(abs, { force: true }),
    untrackedDelete: !tracked,
    ...(tracked ? { trackedChange: "deleted", display } : {}),
  };
}

// Remove exactly the artifact exclude lines `agc init --artifacts=local`
// wrote for THIS workspace's prefix from the shared info/exclude. A line is
// removed only when it equals one of those rules (a trailing CR aside); every
// other line — lane rules, another workspace's rules, the adopter's own —
// keeps its exact bytes and position. A workspace whose path holds a
// character unsafe for an exclude rule never had rules written (init refuses local mode
// there), so there is nothing to look for.
function planExcludeEntry(ctx) {
  const label = "(iii) host traces — .git/info/exclude";
  if (ctx.repoRoot === null) {
    const line = `${label}: skipped (not inside a git repository)`;
    return { line: () => line, apply: null, untrackedDelete: false };
  }
  if (ctx.workspace.unsafeSegment !== null) return null;
  const rules = new Set(artifactExcludeRulesForPrefix(ctx.workspace.prefix));
  const { excludePath, existing, exists } = readSharedExclude(ctx.repoRoot);
  // Each line with its own terminator, so joining the survivors reproduces
  // their bytes exactly, including a missing final newline.
  const lines = exists ? existing.match(/[^\n]*\n|[^\n]+$/g) ?? [] : [];
  const kept = lines.filter((l) => !rules.has(l.replace(/\r?\n$/, "")));
  const n = lines.length - kept.length;
  if (n === 0) {
    const line = `${label}: nothing to remove`;
    return { line: () => line, apply: null, untrackedDelete: false };
  }
  return {
    line: (applied) =>
      applied
        ? `${label}: removed ${n} artifact exclude line(s)`
        : `${label}: REMOVE ${n} artifact exclude line(s)`,
    apply: () => atomicWriteFile(excludePath, kept.join("")),
    untrackedDelete: false,
  };
}

// The class (i)/(ii-b)/(ii-a) paths for this workspace, prefix-anchored.
function ejectPathClasses(prefix) {
  const runtime = artifactPathsForPrefix(prefix).map((p, i) => ({
    ...p,
    label: ARTIFACT_EXCLUDE_RULES[i] === "/.current/" ? "(i) machine state" : "(ii-b) process evidence",
    knowledge: false,
    backlog: false,
  }));
  const knowledge = artifactPathsForPrefix(prefix, KNOWLEDGE_RULES).map((p, i) => ({
    ...p,
    label: "(ii-a) domain knowledge",
    knowledge: true,
    backlog: KNOWLEDGE_RULES[i] === `/${BACKLOG_REL}`,
  }));
  return [...runtime, ...knowledge];
}

function runEject(cwd, argv) {
  const { yes, purgeKnowledge } = parseEjectArgs(argv);

  // Refusals come first, before any plan is computed or printed.
  const repoRoot = resolveRepoRootOrNull(cwd);
  if (repoRoot !== null) resolvePrimaryRepoRoot(cwd, "eject", "agc eject");
  const linked = repoRoot === null ? [] : listWorktrees(repoRoot).slice(1).map((w) => w.path);
  const linkedList = linked.map((p) => `  ${escapeSegmentForDisplay(p)}`).join("\n");
  if (yes && linked.length > 0) {
    throw new FeatureError(
      `agc eject: refusing --yes — linked worktree(s) still exist and would be stranded:\n` +
        `${linkedList}\nFinish or remove them first (agc feature finish).`
    );
  }
  if (linked.length > 0) {
    process.stderr.write(
      `warning: linked worktree(s) still exist and would be stranded:\n` +
        `${linkedList}\nFinish or remove them first (agc feature finish).\n`
    );
  }

  const workspace = repoRoot === null ? { prefix: "", unsafeSegment: null } : repoRelativeWorkspacePrefix(repoRoot, cwd);
  // Targets are repo-relative inside git and cwd-relative outside it
  // (prefix "" there), so one base resolves both.
  const base = repoRoot ?? cwd;
  const declared = readDeclaredArtifacts(path.join(cwd, ".current", ".config.json")) ?? "undeclared";
  const classes = ejectPathClasses(workspace.prefix);
  const trackedTargets = new Set(
    repoRoot === null ? [] : trackedArtifactPaths(repoRoot, classes).map((p) => p.target)
  );
  const deletedWord = repoRoot === null ? "deleted (no git repo — nothing to check-ignore)" : "deleted";

  const entries = [];
  const tracked = [];
  for (const p of classes) {
    const abs = path.join(base, p.target);
    const onDisk = lstatOrNull(abs) !== null;
    if (p.knowledge && !purgeKnowledge) {
      if (onDisk) {
        const suffix = p.backlog ? " — may be this project's plan" : "";
        const line = `${p.label} — ${escapeSegmentForDisplay(p.display)}: KEPT (pass --purge-knowledge to remove; never the default)${suffix}`;
        entries.push({ line: () => line, apply: null, untrackedDelete: false });
      }
      continue;
    }
    if (trackedTargets.has(p.target)) {
      tracked.push(p);
      continue;
    }
    if (!onDisk) continue;
    entries.push({
      line: (applied) => `${p.label} — ${escapeSegmentForDisplay(p.display)}: ${applied ? deletedWord : "DELETE"}`,
      // rmSync removes a symlink itself, never what it points to.
      apply: () => fs.rmSync(abs, { recursive: true, force: true }),
      untrackedDelete: true,
    });
  }
  entries.push(...planHostTraceEntries({ cwd, repoRoot, workspace }));

  if (tracked.length === 0 && !entries.some((e) => e.apply !== null)) {
    process.stdout.write("agc eject — nothing to eject.\n");
    for (const e of entries) {
      if (e.advisory) process.stdout.write(`${e.line(yes)}\n`);
    }
    process.stdout.write(ejectCannotDoBlock());
    return;
  }

  const cwdDisplay = escapeSegmentForDisplay(cwd);
  const header = [
    yes
      ? `agc eject — applying to ${cwdDisplay}:`
      : `agc eject — plan for ${cwdDisplay} (dry-run; re-run with --yes to apply):`,
  ];
  if (repoRoot !== null) {
    header.push(`  declared artifacts mode: ${declared}`);
    // design/, specs/ and the backlog are tracked by design in local mode,
    // so only a tracked runtime path means local mode was not in effect.
    if (declared === "local" && tracked.some((p) => !p.knowledge)) {
      header.push("  note: local mode was not in effect for the tracked path(s) listed below");
    }
  }
  if (entries.some((e) => e.untrackedDelete)) {
    header.push("  untracked paths marked DELETE have no git recovery — once deleted they are gone");
  }
  process.stdout.write(header.join("\n") + "\n");

  // Written one line at a time so a failure part-way leaves an accurate
  // record of what was already applied.
  for (const e of entries) {
    if (yes && e.apply !== null) e.apply();
    process.stdout.write(`${e.line(yes)}\n`);
  }

  // Reached under --yes only once every apply succeeded, so the list names
  // changes that were actually made.
  const hostChanges = entries.filter((e) => e.trackedChange !== undefined);
  if (hostChanges.length > 0) {
    process.stdout.write(
      (yes
        ? "Tracked host-trace file(s) were changed in the working tree — this is uncommitted; review and commit it yourself:\n"
        : "will change tracked file(s) — uncommitted until you commit:\n") +
        hostChanges.map((e) => `  ${escapeSegmentForDisplay(e.display)} (${e.trackedChange})\n`).join("")
    );
  }

  if (tracked.length > 0) {
    // Targets are repo-relative; from a subdirectory workspace they only
    // resolve when pasted at the repo root, so say so (same as init).
    process.stderr.write(
      `The following are tracked and were left untouched (agc does not run git rm):\n` +
        tracked.map((p) => `  ${escapeSegmentForDisplay(p.display)}\n`).join("") +
        `Remove them (from the index and the working tree) with` +
        `${workspace.prefix === "" ? "" : " (run from the repository root)"}:\n` +
        (tracked.some((p) => CONTROL_CHAR_RE.test(p.target))
          ? `  ${STR_EJECT_CONTROL_CHAR_NOTE}\n`
          : `  git rm -r ${tracked.map((p) => p.target).join(" ")}\n`) +
        `Note: history still contains these files after that command.\n`
    );
  }
  process.stdout.write(ejectCannotDoBlock());
}

// --- dispatch --------------------------------------------------------------
const sub = process.argv[2];
switch (sub) {
  case "init":
    try {
      runInit(process.cwd(), process.argv.slice(3));
    } catch (err) {
      if (err instanceof FeatureError) {
        process.stderr.write(`${err.message}\n`);
        if (err.usage) process.stderr.write(STR_USAGE);
        process.exit(err.exitCode);
      }
      process.stderr.write(`agc init: ${err && err.message ? err.message : String(err)}\n`);
      process.exit(1);
    }
    break;
  case "check":
    // runCheck calls process.exit itself; the catch is unreachable for
    // orphan-scan errors, which checkOrphanLanes swallows.
    runCheck(process.cwd()).catch((err) => {
      process.stderr.write(`agc check: ${err && err.message ? err.message : String(err)}\n`);
      process.exit(1);
    });
    break;
  case "feature":
    runFeature(process.cwd(), process.argv.slice(3)).catch(handleFeatureError);
    break;
  case "eject":
    try {
      runEject(process.cwd(), process.argv.slice(3));
    } catch (err) {
      if (err instanceof FeatureError) {
        process.stderr.write(`${err.message}\n`);
        if (err.usage) process.stderr.write(`Usage:\n${STR_USAGE_EJECT}`);
        process.exit(err.exitCode);
      }
      process.stderr.write(`agc eject: ${err && err.message ? err.message : String(err)}\n`);
      process.exit(1);
    }
    break;
  default:
    process.stderr.write(STR_USAGE + STR_USAGE_FEATURE + STR_USAGE_EJECT);
    process.exit(sub === undefined ? 1 : 2);
}
