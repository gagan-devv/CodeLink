import { GitIntegrationModule } from '../git/GitIntegrationModule';
import { SnapshotEngine } from './SnapshotEngine';
import { PatchEncoder } from './PatchEncoder';
import { WsClient } from '../websocket/WsClient';
export declare class FileWatcher {
    private readonly git;
    private readonly snapshot;
    private readonly patches;
    private readonly ws;
    private disposables;
    private debounceTimers;
    private activeFile;
    constructor(git: GitIntegrationModule, snapshot: SnapshotEngine, patches: PatchEncoder, ws: WsClient);
    start(workspaceRoot: string): void;
    stop(): void;
    private onFileSwitch;
    private scheduleSync;
    private sendPatchOrSnapshot;
    private sendSnapshot;
    handleSnapshotRequest(fileName: string): Promise<void>;
    private getRelativeName;
}
//# sourceMappingURL=FileWatcher.d.ts.map