export interface PatchPayload {
    fileName: string;
    patches: string;
    fromSeq: string;
    toSeq: string;
    isDirty: boolean;
    timestamp: number;
}
export declare class PatchEncoder {
    private readonly engine;
    private readonly lastSent;
    encode(fileName: string, newContent: string, isDirty: boolean): PatchPayload | null;
    recordSnapshot(fileName: string, content: string, seq: number): void;
    reset(fileName: string): void;
    resetAll(): void;
}
//# sourceMappingURL=PatchEncoder.d.ts.map