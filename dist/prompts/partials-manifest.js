// Coded by @sr-engineer
// Partials registry (ticket A12): the single source of truth for "which
// {{PARTIAL:<token>}} maps to which content file", mirroring
// constitution-manifest.ts's data-module style (A9 pattern: ordered data
// registry + pure function, no fs access in the module itself).
//
// Substitution contract (specs/a12-partials-limits-registry-architecture.md):
// - Single non-recursive pass — substituted text is NOT re-scanned; a
//   {{PARTIAL:…}} inside a partial's own body is left verbatim (partials
//   referencing partials is explicitly unsupported, spec Out of Scope).
// - Byte-identity (AC2/DR-3): exactly one trailing \r?\n is stripped from
//   each loaded partial, so a token sitting alone on its line in a skill
//   expands back to the identical pre-refactor line (the skill's own
//   surrounding newlines are preserved).
// - Unknown token → fail-loud visible marker (DR-6), never silent
//   passthrough — mirrors loadContent's "[ERROR: … not found]" convention.
// - `load` is injected so this module stays fs-free; each render path
//   (prompts/build.ts buildPromptForRole AND tools/role.ts switchRole — the
//   second render path, DR-4) supplies its own .current-override-aware loader.
// Single source of truth for "which token maps to which content file".
// One entry today; adding a partial = one row here + one content/partial-*.md file.
export const PARTIALS = [
    { token: "step1-preflight", file: "partial-step1-preflight.md" },
];
// Pre-derived lookup + matcher (built once at module load).
const BY_TOKEN = new Map(PARTIALS.map((p) => [p.token, p.file]));
const PARTIAL_RE = /\{\{PARTIAL:([a-z0-9-]+)\}\}/g;
// Pure: no hidden state; repeated calls on the same input are identical
// (protects the compose-golden / compose-equivalence loops that call render
// paths many times per process).
export function expandPartials(text, load) {
    return text.replace(PARTIAL_RE, (match, token) => {
        const file = BY_TOKEN.get(token);
        if (!file) {
            return `[ERROR: unknown partial token '${token}']`;
        }
        return load(file).replace(/\r?\n$/, "");
    });
}
//# sourceMappingURL=partials-manifest.js.map