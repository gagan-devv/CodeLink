/**
 * Mock VS Code API for testing
 */

export const workspace = {
  workspaceFolders: [],
  textDocuments: [],
  asRelativePath: (pathOrUri: string | any, includeWorkspaceFolder?: boolean) => {
    if (typeof pathOrUri === 'string') {
      return pathOrUri.split('/').pop() || pathOrUri;
    }
    return pathOrUri.fsPath?.split('/').pop() || '';
  },
  onDidChangeTextDocument: () => ({ dispose: () => {} }),
};

export const window = {
  activeTextEditor: undefined,
  onDidChangeActiveTextEditor: () => ({ dispose: () => {} }),
  showInformationMessage: () => Promise.resolve(),
  showErrorMessage: () => Promise.resolve(),
  createOutputChannel: () => ({
    appendLine: () => {},
    dispose: () => {},
  }),
};

export class Uri {
  static file(path: string) {
    return { fsPath: path };
  }
  
  fsPath: string = '';
}

export interface Disposable {
  dispose(): void;
}

export interface TextDocument {
  uri: Uri;
  isDirty: boolean;
  getText(): string;
}

export interface TextEditor {
  document: TextDocument;
}
