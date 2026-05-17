import * as dmp from 'diff-match-patch';
import { timeStamp } from 'node:console';

export interface PatchPayload {
    fileName: string;
    patches: string;
    fromSeq: string;
    toSeq: string;
    isDirty: boolean;
    timestamp: number;
}

export class PatchEncoder {
    private readonly engine = new dmp.diff_match_patch();
    private readonly lastSent = new Map<string, { content: string; seq: number }>();

    encode(fileName: string, newContent: string, isDirty: boolean): PatchPayload | null {
        const last = this.lastSent.get(fileName);

        if (!last) {
            return null;
        }

        if (last.content === newContent) {
            return null;
        }

        const patches = this.engine.patch_make(last.content, newContent);
        const patchText = this.engine.patch_toText(patches);
        const toSeq = last.seq + 1;

        this.lastSent.set(fileName, { content: newContent, seq: toSeq });
    
        return { fileName, patches: patchText, fromSeq: last.seq.toString(), toSeq: toSeq.toString(), isDirty, timestamp: Date.now() };
    }

    recordSnapshot(fileName: string, content: string, seq: number): void {
        this.lastSent.set(fileName, { content, seq });
    }

    reset(fileName: string): void {
        this.lastSent.delete(fileName);
    }

    resetAll(): void {
        this.lastSent.clear();
    }
}