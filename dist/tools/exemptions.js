// Coded by @sr-engineer
// Loads .current/exemptions.json, the only sanctioned exemption channel for
// the constitution's §2 build gate: { "schema_version": 1 (optional),
// "exemptions": [{ "path", "reason", "expires_when" }] }. Absent file → null;
// structural malformation → zero exemptions plus loud `errors`; a bad entry is
// dropped with an error. Never throws: it runs on every tw_get_state read.
// Why: specs/e260a-tools-a-h-rationale.md, "tools/exemptions.ts — loadExemptions".
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