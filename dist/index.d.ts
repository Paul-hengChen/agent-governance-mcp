#!/usr/bin/env node
import { normalizeWorkspacePath, type WorkspaceSource } from "./prompts/build.js";
export { normalizeWorkspacePath };
export interface WorkspaceResolution {
    path: string;
    source: WorkspaceSource;
    managed: boolean;
}
export declare function looksLikePath(s: string): boolean;
export declare function resolveWorkspacePath(args: Record<string, unknown> | undefined): WorkspaceResolution;
//# sourceMappingURL=index.d.ts.map