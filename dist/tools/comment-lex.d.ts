import type { LexedLine } from "./comment-types.js";
export interface Interp {
    open: string;
    openCh: string;
    closeCh: string;
}
export interface Closer {
    end: string;
    escape: "backslash" | "doubled" | "none";
    multiline: boolean;
    interp?: Interp;
    docCandidate?: boolean;
}
export interface StringForm {
    first: string;
    re: RegExp;
    wordStart?: boolean;
    close?: (m: RegExpExecArray) => Closer;
}
export interface DocstringTracker {
    code(s: string, i: number): void;
    string(docCandidate: boolean): boolean;
    lineEnd(continued: boolean): void;
}
export interface LexTable {
    line: "//" | "#";
    block?: {
        nested: boolean;
    };
    hashWordStart?: boolean;
    beginEnd?: boolean;
    shebang?: boolean;
    strings: readonly StringForm[];
    docstrings?: () => DocstringTracker;
}
export declare function dq(multiline: boolean, interp?: Interp): StringForm;
export declare const charLit: StringForm;
export declare function slashBody(raw: string): string;
export declare function hashBody(raw: string): string;
export declare function docBody(raw: string): string;
export declare function lexTable(text: string, t: LexTable): LexedLine[];
//# sourceMappingURL=comment-lex.d.ts.map