export declare function isLockPayloadStale(lockPath: string): boolean;
export declare function withFileLock<T>(lockPath: string, fn: () => Promise<T> | T): Promise<T>;
//# sourceMappingURL=file-lock.d.ts.map