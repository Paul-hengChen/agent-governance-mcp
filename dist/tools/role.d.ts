declare const ROLE_SKILL_MAP: {
    readonly pm: "skill-pm.md";
    readonly researcher: "skill-researcher.md";
    readonly "design-auditor": "skill-design-auditor.md";
    readonly "sr-engineer": "skill-sr-engineer.md";
    readonly "code-reviewer": "skill-code-reviewer.md";
    readonly "qa-engineer": "skill-qa-engineer.md";
    readonly architect: "skill-architect.md";
};
export type RoleName = keyof typeof ROLE_SKILL_MAP;
export declare function switchRole(role: RoleName, workspacePath: string): string;
export {};
//# sourceMappingURL=role.d.ts.map