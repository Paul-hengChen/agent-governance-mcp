// Coded by @pm
// MCP Prompt: pm — auto-injects constitution + skill + project state

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { parseHandoff } from "../tools/handoff.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CONTENT_DIR = fs.existsSync(path.join(PROJECT_ROOT, "content"))
  ? path.join(PROJECT_ROOT, "content")
  : path.join(PROJECT_ROOT, "..", "content");

function loadContent(filename: string, workspacePath?: string): string {
  if (workspacePath) {
    const override = path.join(workspacePath, ".current", filename);
    if (fs.existsSync(override)) {
      return fs.readFileSync(override, "utf-8");
    }
  }
  const filePath = path.join(CONTENT_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return `[ERROR: ${filename} not found at ${filePath}]`;
  }
  return fs.readFileSync(filePath, "utf-8");
}

export function buildPmPrompt(workspacePath: string): {
  description: string;
  messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
} {
  const constitution = loadContent("constitution.md", workspacePath);
  const skill = loadContent("skill-pm.md", workspacePath);

  let state: ReturnType<typeof parseHandoff> = null;
  try {
    state = parseHandoff(workspacePath);
  } catch {
    // fall through to "no state" block
  }
  const stateBlock = state
    ? `## 📍 Current Project State\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\``
    : `## 📍 Current Project State\nNo state found. Call \`tw_get_state\` to init.`;

  const prompt = `${constitution}\n\n---\n\n${skill}\n\n---\n\n${stateBlock}`;

  return {
    description: "PM role. Write specs, break down tasks, sync state.",
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
