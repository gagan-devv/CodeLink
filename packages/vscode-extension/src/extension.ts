import * as vscode from 'vscode';
import * as zlib from 'zlib';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { SyncFullContextMessage, FileContextPayload, InjectPromptMessage, InjectPromptResponseMessage, ProtocolMessage } from '@codelink/protocol';
import { FileWatcher } from './watcher/FileWatcher';
import { GitIntegrationModuleImpl } from './git/GitIntegrationModule';
import { DiffGeneratorImpl } from './diff/DiffGenerator';
import { WebSocketClient } from './websocket/WebSocketClient';
import { EditorRegistry } from './editors/adapters/EditorRegistry';
import { ContinueAdapter } from './editors/adapters/ContinueAdapter';
import { KiroAdapter } from './editors/adapters/KiroAdapter';
import { CursorAdapter } from './editors/adapters/CursorAdapter';
import { AntigravityAdapter } from './editors/adapters/AntigravityAdapter';

// Promisify zlib functions
const gzip = promisify(zlib.gzip);

// Compression threshold: 50KB
const COMPRESSION_THRESHOLD = 50 * 1024;

// Global instances
let fileWatcher: FileWatcher;
let gitModule: GitIntegrationModuleImpl;
let diffGenerator: DiffGeneratorImpl;
let wsClient: WebSocketClient;
let editorRegistry: EditorRegistry;
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

  // Initialize Editor Registry
  editorRegistry = new EditorRegistry();
  
  // Register all editor adapters
  editorRegistry.register(new ContinueAdapter());
  editorRegistry.register(new KiroAdapter());
  editorRegistry.register(new CursorAdapter());
  editorRegistry.register(new AntigravityAdapter());
  
  outputChannel.appendLine('Editor registry initialized with 4 adapters');
  
  // Run initial editor detection
  try {
    const detectionResults = await editorRegistry.detectAll();
    outputChannel.appendLine('Editor detection completed:');
    
    for (const [editorId, result] of detectionResults) {
      if (result.isInstalled) {
        outputChannel.appendLine(`  - ${editorId}: installed (${result.availableCommands?.length || 0} commands)`);
      } else {
        outputChannel.appendLine(`  - ${editorId}: not installed`);
      }
    }
    
    // Log the best available adapter
    const bestAdapter = await editorRegistry.getBestAdapter();
    if (bestAdapter) {
      outputChannel.appendLine(`Best available editor: ${bestAdapter.editorName} (${bestAdapter.capabilities.syncLevel} sync)`);
    } else {
      outputChannel.appendLine('No AI editor detected');
    }
  } catch (error) {
    outputChannel.appendLine(`Error during editor detection: ${error}`);
  }
  
  // Store registry in extension context for access by other modules
  context.globalState.update('editorRegistry', editorRegistry);

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
  const relayServerUrl = 'http://localhost:8080';
  wsClient = new WebSocketClient();
  wsClient.connect(relayServerUrl);
  outputChannel.appendLine(`WebSocket client connecting to ${relayServerUrl}`);

  // Register handler for incoming messages (e.g., INJECT_PROMPT from mobile)
  wsClient.onMessage(handleIncomingMessage);

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
      // Clear editor registry cache on disposal
      if (editorRegistry) {
        editorRegistry.clearCache();
      }
    },
  });
}

/**
 * Handle incoming messages from the WebSocket (e.g., from mobile client)
 */
async function handleIncomingMessage(message: ProtocolMessage): Promise<void> {
  try {
    outputChannel.appendLine(`[INFO] Received message type: ${message.type}`);

    if (message.type === 'INJECT_PROMPT') {
      await handlePromptInjection(message as InjectPromptMessage);
    }
    // Add handlers for other message types as needed
  } catch (error) {
    outputChannel.appendLine(`[ERROR] Error handling incoming message: ${error}`);
    console.error('Error handling incoming message:', error);
  }
}

/**
 * Handle prompt injection request from mobile client
 */
async function handlePromptInjection(message: InjectPromptMessage): Promise<void> {
  const startTime = Date.now();
  outputChannel.appendLine(`[INFO] Handling prompt injection: "${message.prompt.substring(0, 50)}..."`);

  try {
    // Get the best available editor adapter
    const adapter = await editorRegistry.getBestAdapter();

    if (!adapter) {
      // No editor available - send error response
      const errorResponse: InjectPromptResponseMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'INJECT_PROMPT_RESPONSE',
        success: false,
        error: 'No AI editor is installed. Please install Continue, Kiro, Cursor, or Antigravity.',
        originalRequestId: message.id,
      };

      wsClient.send(errorResponse);
      outputChannel.appendLine(`[ERROR] No AI editor available for prompt injection`);
      return;
    }

    outputChannel.appendLine(`[INFO] Using editor: ${adapter.editorName} (${adapter.capabilities.syncLevel} sync)`);

    // Check if the adapter supports prompt injection
    if (!adapter.capabilities.canInjectPrompt) {
      const errorResponse: InjectPromptResponseMessage = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        type: 'INJECT_PROMPT_RESPONSE',
        success: false,
        error: `Editor ${adapter.editorName} does not support prompt injection`,
        editorUsed: adapter.editorName,
        originalRequestId: message.id,
      };

      wsClient.send(errorResponse);
      outputChannel.appendLine(`[ERROR] Editor ${adapter.editorName} does not support prompt injection`);
      return;
    }

    // Inject the prompt
    const result = await adapter.injectPrompt(message.prompt);
    const elapsed = Date.now() - startTime;

    // Send response back to mobile client
    const response: InjectPromptResponseMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'INJECT_PROMPT_RESPONSE',
      success: result.success,
      error: result.error,
      editorUsed: adapter.editorName,
      commandUsed: result.commandUsed,
      originalRequestId: message.id,
    };

    wsClient.send(response);

    if (result.success) {
      outputChannel.appendLine(`[INFO] Prompt injection successful (${elapsed}ms) using ${result.commandUsed}`);
    } else {
      outputChannel.appendLine(`[ERROR] Prompt injection failed (${elapsed}ms): ${result.error}`);
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    
    // Send error response
    const errorResponse: InjectPromptResponseMessage = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      type: 'INJECT_PROMPT_RESPONSE',
      success: false,
      error: `Unexpected error during prompt injection: ${error}`,
      originalRequestId: message.id,
    };

    wsClient.send(errorResponse);
    outputChannel.appendLine(`[ERROR] Unexpected error during prompt injection (${elapsed}ms): ${error}`);
  }
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
  if (editorRegistry) {
    editorRegistry.clearCache();
  }
  if (outputChannel) {
    outputChannel.appendLine('CodeLink extension deactivated');
  }
}

/**
 * Get the editor registry instance.
 * 
 * This function provides access to the editor registry for other modules
 * that need to interact with AI editors (e.g., WebSocket handlers for
 * mobile prompt injection).
 * 
 * @returns The editor registry instance, or undefined if not initialized
 */
export function getEditorRegistry(): EditorRegistry | undefined {
  return editorRegistry;
}

/**
 * Reset the editor registry (for testing purposes only).
 * 
 * @internal
 */
export function resetEditorRegistry(): void {
  editorRegistry = undefined as any;
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
