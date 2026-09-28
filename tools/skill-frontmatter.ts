// Coded by @sr-engineer
// Shared parser for the leading YAML frontmatter block in content/skill-*.md.
// Consumed by tools/role.ts, prompts/build.ts, and bin/agent-governance-context.mjs
// so the wire contract lives in exactly one place.

import * as yaml from "js-yaml";

export const MODEL_TIERS = ["opus", "sonnet", "haiku"] as const;
export type ModelTier = (typeof MODEL_TIERS)[number];

export interface SkillFrontmatter {
  recommended_model?: ModelTier;
}

export interface ParsedSkillFile {
  frontmatter: SkillFrontmatter;
  body: string;
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function isModelTier(v: unknown): v is ModelTier {
  return typeof v === "string" && (MODEL_TIERS as readonly string[]).includes(v);
}

export function parseSkillFile(text: string): ParsedSkillFile {
  const match = text.match(FRONTMATTER_RE);
  if (!match) {
    return { frontmatter: {}, body: text };
  }

  const yamlBlock = match[1];
  const body = text.slice(match[0].length);

  let raw: unknown;
  try {
    raw = yaml.load(yamlBlock);
  } catch (err) {
    process.stderr.write(
      `[skill-frontmatter] malformed YAML frontmatter — ignoring: ${(err as Error).message}\n`,
    );
    return { frontmatter: {}, body };
  }

  const frontmatter: SkillFrontmatter = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    if ("recommended_model" in rec) {
      if (isModelTier(rec.recommended_model)) {
        frontmatter.recommended_model = rec.recommended_model;
      } else {
        process.stderr.write(
          `[skill-frontmatter] invalid recommended_model value ${JSON.stringify(
            rec.recommended_model,
          )} — expected one of ${MODEL_TIERS.join("/")}\n`,
        );
      }
    }
  }

  return { frontmatter, body };
}
