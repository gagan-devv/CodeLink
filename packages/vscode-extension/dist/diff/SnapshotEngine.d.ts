export interface SnapshotPayload {
    fileName: string;
    content: string;
    encoding: 'utf8' | 'gzip+base64';
    seq: number;
    isDirty: boolean;
    gitHead: boolean;
    timestamp: number;
}
export declare class SnapshotEngine {
    private seqCounter;
    build(fileName: string, content: string, isDirty: boolean, gitHead: boolean): SnapshotPayload;
    currentSeq(fileName: string): number;
    reset(fileName: string): void;
    resetAll(): void;
}
//# sourceMappingURL=SnapshotEngine.d.ts.map