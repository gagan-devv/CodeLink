import { diff_match_patch } from 'diff-match-patch';

interface Snapshot {
    content: string;
    seq: number;
}

class PatchEngineClass {
    private readonly dmp = new diff_match_patch();
    private snapshots = new Map<string, Snapshot>();

    applySnapshot(fileName: string, content: string, seq: number): void {
        this.snapshots.set(fileName, { content, seq });
    }

    applyPatch(
        fileName: string,
        patchText: string,
        fromSeq: number,
        toSeq: number
    ): { content: string; success: boolean } | { gap: true } {
        const snap = this.snapshots.get(fileName);
        if (!snap) {
            return { gap: true };
        }
        if (snap.seq !== fromSeq) {
            return { gap: true };
        }

        const patches = this.dmp.patch_fromText(patchText);
        const [newContent, results] = this.dmp.patch_apply(patches, snap.content);

        if (results.some((r) => !r)) {
            return { content: snap.content, success: false };
        }

        this.snapshots.set(fileName, { content: newContent, seq: toSeq });
        return { content: newContent, success: true };
    }

    currentContent(fileName: string): string | null {
        return this.snapshots.get(fileName)?.content ?? null;
    }

    clear(fileName: string): void {
        this.snapshots.delete(fileName);
    }
    clearAll(): void {
        this.snapshots.clear();
    }
}

// Singleton — shared across WsManager and MessageDispatcher.
export const patchEngine = new PatchEngineClass();
