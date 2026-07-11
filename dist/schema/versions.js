// Coded by @sr-engineer
// Schema-versioning runner. Pure functions; callers own all I/O.
// Per architecture: specs/schema-versioning-architecture.md (Phase 4).
export const CURRENT_VERSIONS = {
    handoff: 10,
    tasks: 1,
    sqlite: 2,
    config: 1,
};
// Workspaces written by an older server that predates schema versioning have
// no version field at all. Treat that absence as version 0 and migrate up.
export const VERSION_WHEN_ABSENT = 0;
// Two-level map: kind → fromVersion → Migration. Migrations are keyed by
// `from` because the runner walks current→target stepwise.
const registry = new Map();
export function registerMigration(m) {
    if (!Number.isInteger(m.from) || !Number.isInteger(m.to)) {
        throw new Error(`schema-versioning: ${m.kind} ${m.from}→${m.to}: from/to must be integers.`);
    }
    if (m.from < 0 || m.to < 0) {
        throw new Error(`schema-versioning: ${m.kind} ${m.from}→${m.to}: from/to must be non-negative.`);
    }
    if (m.to !== m.from + 1) {
        throw new Error(`schema-versioning: ${m.kind} ${m.from}→${m.to}: only adjacent integer steps allowed (to === from + 1).`);
    }
    let kindMap = registry.get(m.kind);
    if (!kindMap) {
        kindMap = new Map();
        registry.set(m.kind, kindMap);
    }
    kindMap.set(m.from, m);
}
// Look up the on-disk version without mutating the payload. A missing or
// malformed `schema_version` field collapses to VERSION_WHEN_ABSENT (0).
export function peekVersion(raw) {
    if (!raw || typeof raw !== "object")
        return VERSION_WHEN_ABSENT;
    const v = raw.schema_version;
    if (typeof v === "number" && Number.isFinite(v) && v >= 0)
        return Math.floor(v);
    return VERSION_WHEN_ABSENT;
}
export function runMigrations(kind, raw) {
    const target = CURRENT_VERSIONS[kind];
    const current = peekVersion(raw);
    if (current > target) {
        throw new Error(`⛔ schema-versioning: ${kind} on-disk version ${current} > server max ${target}. ` +
            `This artifact was written by a newer server. Upgrade the server or migrate manually.`);
    }
    if (current === target) {
        return { payload: raw, fromVersion: current, toVersion: target, applied: [] };
    }
    let payload = raw;
    const applied = [];
    const kindMap = registry.get(kind);
    for (let v = current; v < target; v++) {
        const step = kindMap?.get(v);
        if (!step) {
            throw new Error(`⛔ schema-versioning: missing migration step ${kind} v${v}→v${v + 1}. ` +
                `Register one via registerMigration() before any read of this artifact.`);
        }
        payload = step.up(payload);
        applied.push(v + 1);
    }
    return { payload: payload, fromVersion: current, toVersion: target, applied };
}
// Test-only escape hatch: lets QA reset the registry between fixtures
// without exporting the registry itself. NOT for production use.
export function _clearRegistryForTests() {
    registry.clear();
}
//# sourceMappingURL=versions.js.map