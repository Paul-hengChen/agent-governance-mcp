declare const ROLE_SKILL_MAP: {
    readonly pm: "skill-pm.md";
    readonly researcher: "skill-researcher.md";
    readonly "sr-engineer": "skill-sr-engineer.md";
    readonly "qa-engineer": "skill-qa-engineer.md";
};
export type RoleName = keyof typeof ROLE_SKILL_MAP;
export declare function switchRole(role: RoleName, workspacePath: string): string;
export {};
//# sourceMappingURL=role.d.ts.map