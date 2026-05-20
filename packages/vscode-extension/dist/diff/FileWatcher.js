"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileWatcher = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const DEBOUNCE_MS = 300;
class FileWatcher {
    constructor(git, snapshot, patches, ws) {
        this.git = git;
        this.snapshot = snapshot;
        this.patches = patches;
        this.ws = ws;
        this.disposables = [];
        this.debounceTimers = new Map();
        this.activeFile = null;
    }
    start(workspaceRoot) {
        this.git.initialize(workspaceRoot);
        this.disposables.push(vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor?.document) {
                this.onFileSwitch(editor.document);
            }
        }));
        this.disposables.push(vscode.workspace.onDidSaveTextDocument(doc => {
            this.scheduleSync(doc, false);
        }));
        this.disposables.push(vscode.workspace.onDidChangeTextDocument(event => {
            this.scheduleSync(event.document, true);
        }));
        if (vscode.window.activeTextEditor?.document) {
            this.onFileSwitch(vscode.window.activeTextEditor.document);
        }
    }
    stop() {
        this.debounceTimers.forEach(t => clearTimeout(t));
        this.debounceTimers.clear();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
    async onFileSwitch(doc) {
        const fileName = this.getRelativeName(doc);
        if (!fileName || this.activeFile === fileName) {
            return;
        }
        this.activeFile = fileName;
        this.patches.reset(fileName);
        await this.sendSnapshot(doc);
    }
    scheduleSync(doc, isDirty) {
        if (!this.ws.isConnected()) {
            return;
        }
        const fileName = this.getRelativeName(doc);
        if (!fileName) {
            return;
        }
        if (!this.debounceTimers.has(fileName)) {
            this.sendPatchOrSnapshot(doc, isDirty);
        }
        const existing = this.debounceTimers.get(fileName);
        if (existing) {
            clearTimeout(existing);
        }
        const timer = setTimeout(() => {
            this.debounceTimers.delete(fileName);
        }, DEBOUNCE_MS);
        this.debounceTimers.set(fileName, timer);
    }
    async sendPatchOrSnapshot(doc, isDirty) {
        const fileName = this.getRelativeName(doc);
        if (!fileName) {
            return;
        }
        const content = doc.getText();
        const patch = this.patches.encode(fileName, content, isDirty);
        if (patch) {
            this.ws.send('FILE_PATCH', patch);
        }
        else {
            await this.sendSnapshot(doc);
        }
    }
    async sendSnapshot(doc) {
        const fileName = this.getRelativeName(doc);
        if (!fileName) {
            return;
        }
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
    async handleSnapshotRequest(fileName) {
        this.patches.reset(fileName);
        this.snapshot.reset(fileName);
        const editor = vscode.window.activeTextEditor;
        if (editor && this.getRelativeName(editor.document) === fileName) {
            await this.sendSnapshot(editor.document);
        }
    }
    getRelativeName(doc) {
        if (doc.uri.scheme != 'file') {
            return null;
        }
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders?.length) {
            return null;
        }
        const root = workspaceFolders[0].uri.fsPath;
        return path.relative(root, doc.fileName).replace(/\\/g, '/');
    }
}
exports.FileWatcher = FileWatcher;
//# sourceMappingURL=FileWatcher.js.map