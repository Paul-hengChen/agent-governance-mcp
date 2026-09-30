export type LineKind = "blank" | "code" | "comment";
export interface LexedLine {
    kind: LineKind;
    body: string;
    delimiterOnly: boolean;
    docstring?: true;
}
export type TagRule = (line: LexedLine) => boolean | null;
export type LangId = "js" | "c" | "java" | "csharp" | "go" | "kotlin" | "swift" | "rust" | "python" | "shell" | "ruby";
export interface LangSpec {
    readonly id: LangId;
    readonly exts: readonly string[];
    readonly lex: (text: string) => LexedLine[];
    readonly tags: TagRule;
}
//# sourceMappingURL=comment-types.d.ts.map