export interface PartialSegment {
    readonly token: string;
    readonly file: string;
}
export declare const PARTIALS: readonly PartialSegment[];
export declare function expandPartials(text: string, load: (partialFile: string) => string): string;
//# sourceMappingURL=partials-manifest.d.ts.map