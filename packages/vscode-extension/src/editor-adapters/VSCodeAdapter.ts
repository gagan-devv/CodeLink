import * as vscode from 'vscode';
import { EditorAdapter } from './EditorAdapter';

export class VSCodeAdapter implements EditorAdapter {
    readonly id = 'vscode';
    readonly displayName = 'VS Code';

    async isAvailable(): Promise<boolean> {
        return true; // Always available
    }

    async injectPrompt(prompt: string): Promise<boolean> {
        // Basic fallback: copy to clipboard and show notification
        await vscode.env.clipboard.writeText(prompt);

        const selection = await vscode.window.showInformationMessage(
            `Received prompt from mobile: "${prompt.substring(0, 50)}..."`,
            'Paste in Editor',
            'Dismiss'
        );

        if (selection === 'Paste in Editor') {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, prompt);
                });
            }
        }

        return true;
    }
}
