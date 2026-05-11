// Coded by @sr-engineer
// MCP Prompt: sr-engineer — auto-injects constitution + skill + project state

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseHandoff } from "../tools/handoff.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve content dir: works from both source (prompts/) and compiled (dist/prompts/)
const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = fs.existsSync(path.join(PROJECT_ROOT, "content"))
  ? path.join(PROJECT_ROOT, "content")
  : path.join(PROJECT_ROOT, "..", "content"); // fallback: dist/prompts/../../content

function loadContent(filename: string): string {
  const filePath = path.join(CONTENT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return `[ERROR: ${filename} not found at ${filePath}]`;
  }
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Build the sr-engineer prompt with dynamic state injection.
 * This is the key mechanism that makes ANY AI agent follow our rules
 * without manual system prompt configuration.
 */
export function buildSrEngineerPrompt(workspacePath: string): {
  description: string;
  messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
} {
  const constitution = loadContent("constitution.md");
  const skill = loadContent("skill-sr-engineer.md");

  // Dynamic state injection
  const state = parseHandoff(workspacePath);
  const stateBlock = state
    ? `## 📍 Current Project State (Auto-injected)\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``
    : `## 📍 Current Project State\nNo handoff state found. Fresh project — call \`sdd_get_state\` to initialize.`;

  const prompt = `${constitution}\n\n---\n\n${skill}\n\n---\n\n${stateBlock}`;

  return {
    description: "Activates sr-engineer mode: auto-loads constitution, skill, and current project state.",
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: prompt,
        },
      },
    ],
  };
}
