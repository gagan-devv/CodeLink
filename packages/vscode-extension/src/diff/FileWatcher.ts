import * as vscode from 'vscode'
import * as path from 'path'
import { GitIntegrationModule } from '../git/GitIntegrationModule';
import { SnapshotEngine } from './SnapshotEngine';
import { PatchEncoder } from './PatchEncoder';
import { WsClient } from '../websocket/WsClient';

const DEBOUNCE_MS = 300;

export class FileWatcher {
    private disposables: vscode.Disposable[] = [];
    private debounceTimers = new Map<string, NodeJS.Timeout>();
    private activeFile: string | null = null;

    constructor(
        private readonly git: GitIntegrationModule,
        private readonly snapshot: SnapshotEngine,
        private readonly patches: PatchEncoder,
        private readonly ws: WsClient,
    ) {}

    start(workspaceRoot: string): void {
        this.git.initialize(workspaceRoot);

        this.disposables.push(
            vscode.window.onDidChangeActiveTextEditor(editor => {
                if (editor?.document) {
                    this.onFileSwitch(editor.document);
                }
            })
        );

        this.disposables.push(
            vscode.workspace.onDidSaveTextDocument(doc => {
                this.scheduleSync(doc, false);
            })
        );

        this.disposables.push(
            vscode.workspace.onDidChangeTextDocument(event => {
                this.scheduleSync(event.document, true);
            })
        );

        if (vscode.window.activeTextEditor?.document) {
            this.onFileSwitch(vscode.window.activeTextEditor.document);
        }
    }

    stop(): void {
        this.debounceTimers.forEach(t => clearTimeout(t));
        this.debounceTimers.clear();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }

    private async onFileSwitch(doc: vscode.TextDocument): Promise<void> {
        const fileName = this.getRelativeName(doc);
        if (!fileName || this.activeFile === fileName) { return; }

        this.activeFile = fileName;
        this.patches.reset(fileName);
        await this.sendSnapshot(doc);
    }

    private scheduleSync(doc: vscode.TextDocument, isDirty: boolean): void {
        if (!this.ws.isConnected()) { return; }

        const fileName = this.getRelativeName(doc);
        if (!fileName) { return; }

        if (!this.debounceTimers.has(fileName)) {
            this.sendPatchOrSnapshot(doc, isDirty);
        }

        const existing = this.debounceTimers.get(fileName);
        if (existing) { clearTimeout(existing); }

        const timer = setTimeout(() => {
            this.debounceTimers.delete(fileName);
        }, DEBOUNCE_MS);

        this.debounceTimers.set(fileName, timer);
    }

    private async sendPatchOrSnapshot(doc: vscode.TextDocument, isDirty: boolean): Promise<void> {
        const fileName = this.getRelativeName(doc);
        if (!fileName) { return; }

        const content = doc.getText();
        const patch = this.patches.encode(fileName, content, isDirty);

        if (patch) {
            this.ws.send('FILE_PATCH', patch);
        } else {
            await this.sendSnapshot(doc);
        }
    }

    private async sendSnapshot(doc: vscode.TextDocument): Promise<void> {
        const fileName = this.getRelativeName(doc);
        if (!fileName) { return; }

        const content = doc.getText();
        const isDirty = doc.isDirty;
        const gitHead = await this.git.isTracked(doc.fileName);

        const payload = this.snapshot.build(fileName, content, isDirty, gitHead);

        this.patches.recordSnapshot(fileName, content, payload.seq);

        this.ws.send('FILE_SNAPSHOT', payload);

        const editor = vscode.window.activeTextEditor;
        if (editor?.document === doc) {
            const pos = editor.selection.active;
            this.ws.send('EDITOR_FOCUS', {
                fileName,
                cursorLine: pos.line,
                cursorCol: pos.character,
            });
        }
    }

    async handleSnapshotRequest(fileName: string): Promise<void> {
        this.patches.reset(fileName);
        this.snapshot.reset(fileName);

        const editor = vscode.window.activeTextEditor;
        if (editor && this.getRelativeName(editor.document) === fileName) {
            await this.sendSnapshot(editor.document);
        }
    }

    private getRelativeName(doc: vscode.TextDocument): string | null {
        if (doc.uri.scheme != 'file') { return null; }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders?.length) { return null; }
        const root = workspaceFolders[0].uri.fsPath;
        return path.relative(root, doc.fileName).replace(/\\/g, '/');
    }
}