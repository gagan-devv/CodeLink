import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

export function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    if (vscode.window && typeof vscode.window.createOutputChannel === 'function') {
      outputChannel = vscode.window.createOutputChannel('CodeLink');
    } else {
      outputChannel = {
        name: 'CodeLink',
        append: () => {},
        appendLine: () => {},
        clear: () => {},
        show: () => {},
        hide: () => {},
        dispose: () => {},
        replace: () => {},
      } as unknown as vscode.OutputChannel;
    }
  }
  return outputChannel;
}

export function logLine(line: string): void {
  getOutputChannel().appendLine(line);
}
