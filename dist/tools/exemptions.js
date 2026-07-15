// Coded by @sr-engineer
// Exemptions-manifest loader (E24, 104447-F0 C2). Reads the workspace's
// declarative build-gate exemption manifest:
//
//   .current/exemptions.json shape:
//   {
//     "schema_version": 1,                       // optional; absent === 1
//     "exemptions": [
//       {
//         "path": "test/legacy-harness.test.ts", // workspace-relative path the exemption covers
//         "reason": "33 known tsc errors pending harness rewrite",
//         "expires_when": "harness migrated to vitest (ticket X)"
//       }
//     ]
//   }
//
// This manifest is the ONLY sanctioned exemption channel for the Constitution
// §2 build gate (ZERO compile/type errors): gate checks (role SOPs — sr build
// step, code-reviewer, qa suite triage) subtract manifest-exempted paths
// automatically, and a prose-only exemption (pending_notes, review prose,
// chat) counts as NOT exempted. Rationale (backlog E24): a rule everyone
// knows is permanently violated teaches agents that rules are negotiable —
// the exemption must be a declared, expiring, countable artifact instead of
// re-litigated prose.
//
// Fail direction — never silently exempt (E24 cut constraint):
//   - absent file            → null (zero exemptions, no signal — the normal case)
//   - structural malformation (unreadable, bad JSON, non-object root,
//     unsupported schema_version, `exemptions` not an array)
//                            → ZERO exemptions + loud `errors` (whole manifest void)
//   - per-entry malformation → that entry is dropped (NOT exempted) + a loud
//     per-entry error; valid siblings survive (the tools/config.ts per-field
//     non-fatal filter pattern — partial validity fails toward enforcement,
//     never toward exemption)
//
// Never throws: loadExemptions sits on the tw_get_state read path — the
// mandatory first action of every role in every session (Constitution §3
// pre-flight). A throw here would block the one call everything else depends
// on, so every failure mode collapses to "no exemptions + errors[]" instead.
// (This is why the config.ts mtime cache is NOT mirrored: no throwing stat
// helper, and the loader runs once per tw_get_state — no hot path to cache.)
//
// Expiry conditions are recorded strings the retro/humans check — the server
// does NOT evaluate them (E24 cut: no speculative expiry-enforcement engine).
// The exemption count is the monitorable only-grows metric: surfaced on every
// tw_get_state, and the manifest is a committed workspace file, so growth is
// auditable via its git history.
import * as fs from "fs";
import * as path from "path";
// Manifest schema version accepted by this loader. Not registered in
// schema/versions.ts: v1 is the birth version with no migrations to run;
// wire the migration registry per docs/schema-versions.md when v2 ships.
export const EXEMPTIONS_SCHEMA_VERSION = 1;
// One non-empty-string field of a candidate entry, or an error string.
function readEntryField(entry, field) {
    const v = entry[field];
    if (typeof v === "string" && v.trim().length > 0)
        return v;
    return null;
}
/**
 * Load and validate .current/exemptions.json for a workspace.
 * Returns null when the manifest does not exist (zero exemptions, no signal).
 * NEVER throws — see module header for the failure-mode table.
 */
export function loadExemptions(workspacePath) {
    const manifestPath = path.join(workspacePath, ".current", "exemptions.json");
    let raw;
    try {
        raw = fs.readFileSync(manifestPath, "utf-8");
    }
    catch (err) {
        if (err.code === "ENOENT")
            return null;
        // Exists but unreadable (permissions, I/O): loud, zero exemptions.
        return {
            count: 0,
            entries: [],
            errors: [`Failed to read ${manifestPath}: ${err.message} — NO exemptions granted.`],
        };
    }
    let decoded;
    try {
        decoded = JSON.parse(raw);
    }
    catch (err) {
        return {
            count: 0,
            entries: [],
            errors: [`Failed to parse ${manifestPath}: ${err.message} — NO exemptions granted.`],
        };
    }
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
        return {
            count: 0,
            entries: [],
            errors: [`${manifestPath}: manifest root must be a JSON object — NO exemptions granted.`],
        };
    }
    const root = decoded;
    // schema_version: absent counts as 1 (birth version). Anything else —
    // including a FUTURE version — voids the whole manifest loudly rather than
    // guessing at a shape this server does not understand (refuse-loud, the
    // schema/versions.ts future-version posture).
    const version = root.schema_version;
    if (version !== undefined && version !== EXEMPTIONS_SCHEMA_VERSION) {
        return {
            count: 0,
            entries: [],
            errors: [
                `${manifestPath}: unsupported schema_version ${JSON.stringify(version)} ` +
                    `(this server supports ${EXEMPTIONS_SCHEMA_VERSION}) — NO exemptions granted.`,
            ],
        };
    }
    const list = root.exemptions;
    if (!Array.isArray(list)) {
        return {
            count: 0,
            entries: [],
            errors: [`${manifestPath}: "exemptions" must be an array — NO exemptions granted.`],
        };
    }
    const entries = [];
    const errors = [];
    list.forEach((candidate, i) => {
        if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
            errors.push(`${manifestPath}: exemptions[${i}] is not an object — entry NOT exempted.`);
            return;
        }
        const entry = candidate;
        const missing = ["path", "reason", "expires_when"].filter((f) => readEntryField(entry, f) === null);
        if (missing.length > 0) {
            errors.push(`${manifestPath}: exemptions[${i}] missing/empty required field(s) ` +
                `${missing.join(", ")} — entry NOT exempted.`);
            return;
        }
        entries.push({
            path: readEntryField(entry, "path"),
            reason: readEntryField(entry, "reason"),
            expires_when: readEntryField(entry, "expires_when"),
        });
    });
    return { count: entries.length, entries, errors };
}
//# sourceMappingURL=exemptions.js.map