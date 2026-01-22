import * as vscode from 'vscode';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { SyncFullContextMessage, FileContextPayload } from '@codelink/protocol';
import { FileWatcher } from './watcher/FileWatcher';
import { GitIntegrationModuleImpl } from './git/GitIntegrationModule';
import { DiffGeneratorImpl } from './diff/DiffGenerator';
import { WebSocketClient } from './websocket/WebSocketClient';

// Promisify zlib functions
const gzip = promisify(zlib.gzip);

// Compression threshold: 50KB
const COMPRESSION_THRESHOLD = 50 * 1024;

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
  const pipelineStartTime = Date.now();
  
  try {
    outputChannel.appendLine(`[INFO] File changed: ${filePath}`);

    // Step 1: Fetch HEAD version from Git
    const gitStartTime = Date.now();
    let headContent = '';
    try {
      headContent = await gitModule.getHeadVersion(filePath);
      const gitElapsed = Date.now() - gitStartTime;
      outputChannel.appendLine(`[PERF] Git operation: ${gitElapsed}ms (HEAD content: ${headContent.length} bytes)`);
    } catch (error) {
      const gitElapsed = Date.now() - gitStartTime;
      outputChannel.appendLine(`[ERROR] Failed to fetch HEAD version (${gitElapsed}ms): ${error}`);
      // Continue with empty HEAD content (treat as untracked file)
    }

    // Step 2: Generate diff
    const diffStartTime = Date.now();
    const payload = await diffGenerator.generateDiff(filePath, headContent);
    const diffElapsed = Date.now() - diffStartTime;
    
    if (!payload) {
      outputChannel.appendLine(`[WARN] Failed to generate diff (${diffElapsed}ms), skipping`);
      return;
    }

    outputChannel.appendLine(
      `[PERF] Diff generation: ${diffElapsed}ms (${payload.fileName}, isDirty: ${payload.isDirty})`
    );

    // Step 3: Apply compression if payload is large
    const compressionStartTime = Date.now();
    const compressedPayload = await compressPayloadIfNeeded(payload);
    const compressionElapsed = Date.now() - compressionStartTime;
    
    if (compressedPayload.compressed) {
      outputChannel.appendLine(
        `[PERF] Compression: ${compressionElapsed}ms (${compressedPayload.originalSize} → ${compressedPayload.compressedSize} bytes, ${compressedPayload.compressionRatio}% reduction)`
      );
    }

    // Step 4: Create SYNC_FULL_CONTEXT message
    const message: SyncFullContextMessage = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`,
      timestamp: Date.now(),
      type: 'SYNC_FULL_CONTEXT',
      payload: compressedPayload.payload,
    };

    // Step 5: Send message via WebSocket
    const wsStartTime = Date.now();
    try {
      wsClient.send(message);
      const wsElapsed = Date.now() - wsStartTime;
      outputChannel.appendLine(`[PERF] WebSocket send: ${wsElapsed}ms (message id: ${message.id})`);
    } catch (error) {
      const wsElapsed = Date.now() - wsStartTime;
      outputChannel.appendLine(`[ERROR] Failed to send message (${wsElapsed}ms): ${error}`);
      throw error;
    }

    // Log total pipeline time
    const totalElapsed = Date.now() - pipelineStartTime;
    outputChannel.appendLine(`[PERF] Total pipeline: ${totalElapsed}ms`);
    
    // Performance warning if total time exceeds 2000ms
    if (totalElapsed > 2000) {
      outputChannel.appendLine(
        `[WARN] Pipeline exceeded 2000ms threshold: ${totalElapsed}ms for ${payload.fileName}`
      );
    }

  } catch (error) {
    const totalElapsed = Date.now() - pipelineStartTime;
    outputChannel.appendLine(`[ERROR] Pipeline error (${totalElapsed}ms): ${error}`);
    console.error('Error handling file change:', error);
    // Don't throw - continue monitoring other files
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

/**
 * Compress payload if it exceeds the threshold
 * @param payload - The FileContextPayload to potentially compress
 * @returns Compressed payload info with metadata
 */
async function compressPayloadIfNeeded(payload: FileContextPayload): Promise<{
  payload: FileContextPayload;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}> {
  // Calculate payload size
  const payloadString = JSON.stringify(payload);
  const originalSize = Buffer.byteLength(payloadString, 'utf-8');

  // Only compress if payload exceeds threshold
  if (originalSize < COMPRESSION_THRESHOLD) {
    return {
      payload,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    };
  }

  try {
    // Compress originalFile and modifiedFile separately
    const originalFileBuffer = Buffer.from(payload.originalFile, 'utf-8');
    const modifiedFileBuffer = Buffer.from(payload.modifiedFile, 'utf-8');

    const [compressedOriginal, compressedModified] = await Promise.all([
      gzip(originalFileBuffer),
      gzip(modifiedFileBuffer),
    ]);

    // Create compressed payload with base64-encoded compressed data
    const compressedPayload: FileContextPayload = {
      ...payload,
      originalFile: compressedOriginal.toString('base64'),
      modifiedFile: compressedModified.toString('base64'),
      // Add metadata to indicate compression (extend interface if needed)
    };

    const compressedString = JSON.stringify(compressedPayload);
    const compressedSize = Buffer.byteLength(compressedString, 'utf-8');
    const compressionRatio = Math.round(((originalSize - compressedSize) / originalSize) * 100);

    return {
      payload: compressedPayload,
      compressed: true,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    outputChannel.appendLine(`[WARN] Compression failed, sending uncompressed: ${error}`);
    return {
      payload,
      compressed: false,
      originalSize,
      compressedSize: originalSize,
      compressionRatio: 0,
    };
  }
}
