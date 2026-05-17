import * as zlib from 'zlib'

const COMPRESSION_THRESHOLD_BYTES = 64 * 1024;

export interface SnapshotPayload {
    fileName: string;
    content: string;
    encoding: 'utf8' | 'gzip+base64';
    seq: number;
    isDirty: boolean;
    gitHead: boolean;
    timestamp: number;
}

export class SnapshotEngine {
    private seqCounter = new Map<string, number>();

    build(
        fileName: string,
        content: string,
        isDirty: boolean,
        gitHead: boolean,
    ): SnapshotPayload {
        const seq = (this.seqCounter.get(fileName) ?? 0) + 1;
        this.seqCounter.set(fileName, seq);

        const rawBytes = Buffer.byteLength(content, 'utf8')
        const shouldCompress = rawBytes > COMPRESSION_THRESHOLD_BYTES;

        return {
            fileName,
            content: shouldCompress ? zlib.gzipSync(content).toString('base64') : content,
            encoding: shouldCompress ? 'gzip+base64' : 'utf8',
            seq,
            isDirty,
            gitHead,
            timestamp: Date.now(),
        };
    }

    currentSeq(fileName: string): number {
        return this.seqCounter.get(fileName) ?? 0;
    }

    reset(fileName: string): void {
        this.seqCounter.delete(fileName);
    }

    resetAll(): void {
        this.seqCounter.clear();
    }
}