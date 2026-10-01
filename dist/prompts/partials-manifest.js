// Coded by @sr-engineer
// Partials registry: maps each {{PARTIAL:<token>}} to its content file, plus a
// pure expander. One non-recursive pass (a token inside a partial body stays
// verbatim); exactly one trailing newline is stripped from each partial so a
// token alone on its line expands to the identical line; an unknown token
// renders a visible error marker. `load` is injected so this module stays fs-free.
// Rationale: specs/a12-partials-limits-registry-architecture.md.
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