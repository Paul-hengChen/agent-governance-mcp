// Coded by @sr-engineer
// MCP Prompt: doc-writer role (side-channel; not in ALLOWED_TRANSITIONS).
import { buildPromptForRole } from "./build.js";
export function buildDocWriterPrompt(workspacePath) {
    return buildPromptForRole("skill-doc-writer.md", "Documentation maintainer — keeps README / CHANGELOG / docs in sync after PASS.", workspacePath);
}
//# sourceMappingURL=doc-writer.js.map