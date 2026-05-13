declare const ROLE_SKILL_MAP: Record<string, string>;
export type RoleName = keyof typeof ROLE_SKILL_MAP;
export declare function switchRole(role: RoleName, workspacePath: string): string;
export {};
//# sourceMappingURL=role.d.ts.map