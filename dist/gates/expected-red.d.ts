export declare function expectedRedManifestPath(workspacePath: string, activeFeature: string): string;
export declare function noNewTestRecordPath(workspacePath: string, activeFeature: string): string;
export declare function hasExpectedRedManifest(workspacePath: string, activeFeature: string): {
    present: boolean;
    manifestPath: string;
};
export declare function hasNoNewTestRecord(workspacePath: string, activeFeature: string): {
    present: boolean;
    recordPath: string;
};
export declare function hasExpectedRedDisposition(workspacePath: string, taskIds: string[], evidenceSchema?: number): {
    present: boolean;
};
//# sourceMappingURL=expected-red.d.ts.map