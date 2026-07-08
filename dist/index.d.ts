#!/usr/bin/env node
import { type WorkspaceSource } from "./prompts/build.js";
export interface WorkspaceResolution {
    path: string;
    source: WorkspaceSource;
    managed: boolean;
}
export declare function resolveWorkspacePath(args: Record<string, unknown> | undefined): WorkspaceResolution;
//# sourceMappingURL=index.d.ts.map