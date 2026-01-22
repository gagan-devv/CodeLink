import * as vscode from 'vscode';

/**
 * FileWatcher monitors active editor changes and triggers diff generation
 * after a debounce period. It tracks the currently active file and only
 * triggers events for files within the workspace.
 */
export class FileWatcher {
  private debounceTimer: NodeJS.Timeout | null = null;
  private activeFilePath: string | null = null;
  private disposables: vscode.Disposable[] = [];
  private readonly debounceDelay: number = 1000; // 1000ms as per requirements
  private lastChangeTime: number = 0; // Track last change for timing verification

  /**
   * Callback invoked after debounce period expires
   */
  public onFileChanged: (filePath: string) => void = () => {};

  /**
   * Initialize the watcher and register VS Code event listeners
   */
  public initialize(): void {
    // Subscribe to active editor changes
    const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
      this.handleActiveEditorChange.bind(this)
    );
    this.disposables.push(editorChangeDisposable);

    // Subscribe to text document changes
    const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(
      this.handleTextDocumentChange.bind(this)
    );
    this.disposables.push(documentChangeDisposable);

    // Set initial active file if one exists
    if (vscode.window.activeTextEditor) {
      this.activeFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
    }
  }

  /**
   * Handle active text editor changes
   */
  private handleActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (!editor) {
      // No active editor - unregister current file
      this.activeFilePath = null;
      this.clearDebounceTimer();
      return;
    }

    const filePath = editor.document.uri.fsPath;

    // Only track files within workspace
    if (!this.isWithinWorkspace(filePath)) {
      return;
    }

    this.activeFilePath = filePath;
    
    // Trigger diff generation immediately when switching files
    this.triggerFileChanged(filePath);
  }

  /**
   * Handle text document changes
   */
  private handleTextDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    const filePath = event.document.uri.fsPath;

    // Only process changes for the active file
    if (filePath !== this.activeFilePath) {
      return;
    }

    // Only track files within workspace
    if (!this.isWithinWorkspace(filePath)) {
      return;
    }

    // Debounce the change event
    this.debounceFileChange(filePath);
  }

  /**
   * Debounce file change events
   */
  private debounceFileChange(filePath: string): void {
    // Track when the change occurred
    this.lastChangeTime = Date.now();
    
    // Clear existing timer
    this.clearDebounceTimer();

    // Set new timer
    this.debounceTimer = setTimeout(() => {
      // Verify debounce timing (1000ms ± 50ms tolerance)
      const actualDelay = Date.now() - this.lastChangeTime;
      const tolerance = 50;
      
      if (Math.abs(actualDelay - this.debounceDelay) > tolerance) {
        console.warn(
          `[FileWatcher] Debounce timing outside tolerance: ${actualDelay}ms (expected ${this.debounceDelay}ms ± ${tolerance}ms)`
        );
      }
      
      this.triggerFileChanged(filePath);
    }, this.debounceDelay);
  }

  /**
   * Trigger the file changed callback
   */
  private triggerFileChanged(filePath: string): void {
    this.clearDebounceTimer();
    this.onFileChanged(filePath);
  }

  /**
   * Clear the debounce timer
   */
  private clearDebounceTimer(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  /**
   * Check if a file is within the workspace
   */
  private isWithinWorkspace(filePath: string): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return false;
    }

    return workspaceFolders.some(folder => {
      const workspacePath = folder.uri.fsPath;
      return filePath.startsWith(workspacePath);
    });
  }

  /**
   * Clean up resources and unregister listeners
   */
  public dispose(): void {
    this.clearDebounceTimer();
    this.disposables.forEach(disposable => disposable.dispose());
    this.disposables = [];
    this.activeFilePath = null;
  }
}
