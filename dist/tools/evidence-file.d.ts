export declare const COVERS_LINE_RE: RegExp;
export declare function parseCoversIds(content: string): string[];
export declare function buildCoverageIndex(dir: string): Map<string, string>;
export declare function sliceH2Section(content: string, heading: string): string | null;
export declare function normalizeHeadingText(s: string): string;
export declare function sliceH2SectionAt(content: string, heading: string, evidenceSchema?: number): string | null;
export declare function findH2LineAt(content: string, heading: string, evidenceSchema?: number): string | null;
export declare function parseUncheckedLabels(section: string): string[];
export declare function parseAssertionFailures(section: string): string[];
export declare function parseRegionDiffFailures(section: string): string[];
export declare function splitTableCells(line: string): string[];
export declare function normalizeStatus(rawCell: string): string;
//# sourceMappingURL=evidence-file.d.ts.map