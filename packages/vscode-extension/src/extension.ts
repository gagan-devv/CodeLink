import * as vscode from 'vscode';
import { SyncFullContextMessage, FileContextPayload } from '@codelink/protocol';
import { FileWatcher } from './watcher/FileWatcher';
import { GitIntegrationModuleImpl } from './git/GitIntegrationModule';
import { DiffGeneratorImpl } from './diff/DiffGenerator';
import { WebSocketClient } from './websocket/WebSocketClient';

// Global instances
let fileWatcher: FileWatcher;
let gitModule: GitIntegrationModuleImpl;
let diffGenerator: DiffGeneratorImpl;
let wsClient: WebSocketClient;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext) {
  // Create output channel for logging
  outputChannel = vscode.window.createOutputChannel('CodeLink');
  outputChannel.appendLine('CodeLink extension activating...');

  // Initialize all modules
  try {
    await initializeModules(context);
    outputChannel.appendLine('CodeLink extension activated successfully');
  } catch (error) {
    outputChannel.appendLine(`Error activating CodeLink: ${error}`);
    vscode.window.showErrorMessage('Failed to activate CodeLink extension');
  }

  // Register hello command for testing
  const disposable = vscode.commands.registerCommand('codelink.hello', () => {
    vscode.window.showInformationMessage('CodeLink Extension Active!');
  });

  context.subscriptions.push(disposable);
  context.subscriptions.push(outputChannel);
}

async function initializeModules(context: vscode.ExtensionContext): Promise<void> {
  // Get workspace root
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    outputChannel.appendLine('No workspace folder found, skipping initialization');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  outputChannel.appendLine(`Workspace root: ${workspaceRoot}`);

  // Initialize Git Integration Module
  gitModule = new GitIntegrationModuleImpl();
  const gitInitialized = await gitModule.initialize(workspaceRoot);
  
  if (gitInitialized) {
    outputChannel.appendLine('Git integration initialized successfully');
  } else {
    outputChannel.appendLine('Git repository not found, diffs will show full file as additions');
  }

  // Initialize Diff Generator
  diffGenerator = new DiffGeneratorImpl();
  outputChannel.appendLine('Diff generator initialized');

  // Initialize WebSocket Client
  // TODO: Make relay server URL configurable via settings
  const relayServerUrl = 'http://localhost:3000';
  wsClient = new WebSocketClient();
  wsClient.connect(relayServerUrl);
  outputChannel.appendLine(`WebSocket client connecting to ${relayServerUrl}`);

  // Initialize File Watcher
  fileWatcher = new FileWatcher();
  fileWatcher.onFileChanged = handleFileChanged;
  fileWatcher.initialize();
  outputChannel.appendLine('File watcher initialized');

  // Register for cleanup
  context.subscriptions.push({
    dispose: () => {
      fileWatcher.dispose();
      wsClient.disconnect();
    },
  });
}

/**
 * Handle file change events from the File Watcher
 * This is the main pipeline: File Watcher → Git → Diff Generator → WebSocket
 */
async function handleFileChanged(filePath: string): Promise<void> {
  try {
    outputChannel.appendLine(`File changed: ${filePath}`);

    // Step 1: Fetch HEAD version from Git
    const headContent = await gitModule.getHeadVersion(filePath);
    outputChannel.appendLine(`HEAD content fetched (${headContent.length} bytes)`);

    // Step 2: Generate diff
    const payload = await diffGenerator.generateDiff(filePath, headContent);
    
    if (!payload) {
      outputChannel.appendLine('Failed to generate diff, skipping');
      return;
    }

    outputChannel.appendLine(`Diff generated for ${payload.fileName} (isDirty: ${payload.isDirty})`);

    // Step 3: Create SYNC_FULL_CONTEXT message
    const message: SyncFullContextMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'SYNC_FULL_CONTEXT',
      payload,
    };

    // Step 4: Send message via WebSocket
    wsClient.send(message);
    outputChannel.appendLine(`Message sent to relay server (id: ${message.id})`);

  } catch (error) {
    outputChannel.appendLine(`Error in pipeline: ${error}`);
    console.error('Error handling file change:', error);
  }
}

export function deactivate() {
  if (fileWatcher) {
    fileWatcher.dispose();
  }
  if (wsClient) {
    wsClient.disconnect();
  }
  if (outputChannel) {
    outputChannel.appendLine('CodeLink extension deactivated');
  }
}
