export declare function getInflightKey(workspacePath: string, prdPath: string): string;
export declare function getInflight(key: string): Promise<string> | undefined;
export declare function setInflight(key: string, p: Promise<string>): void;
export declare function deleteInflight(key: string): void;
export declare function awaitAllInflightFor(workspacePath: string): Promise<void>;
//# sourceMappingURL=rag-coalesce.d.ts.map