/**
 * Capability model describing what an editor adapter can do.
 */
export interface EditorCapabilities {
  /** Can inject prompts into the editor's chat panel via public commands */
  canInjectPrompt: boolean;

  /** Can read chat history (only true for open-source editors like Continue) */
  canReadChatHistory: boolean;

  /** Can stream assistant response tokens in real-time */
  canStreamAssistantTokens: boolean;

  /** Can read diff artifacts from the editor */
  canReadDiffArtifacts: boolean;

  /** Can prevent automatic application of edits */
  canPreventAutoApply: boolean;

  /** Overall synchronization level: "full" | "partial" | "control-only" */
  syncLevel: 'full' | 'partial' | 'control-only';
}

/**
 * Result of a prompt injection operation.
 */
export interface PromptInjectionResult {
  /** Whether the prompt injection succeeded */
  success: boolean;

  /** Error message if injection failed */
  error?: string;

  /** The VS Code command that was executed */
  commandUsed?: string;
}

/**
 * Result of editor detection.
 */
export interface DetectionResult {
  /** Whether the editor is installed and available */
  isInstalled: boolean;

  /** Available commands discovered for this editor */
  availableCommands?: string[];

  /** Version information if available */
  version?: string;
}

/**
 * Chat message structure for history reading.
 */
export interface ChatMessage {
  /** Message role: user or assistant */
  role: 'user' | 'assistant';

  /** Message content text */
  content: string;

  /** Unix timestamp when message was created */
  timestamp: number;
}

/**
 * Diff artifact structure.
 */
export interface DiffArtifact {
  /** Path to the file being modified */
  filePath: string;

  /** Original file content before changes */
  originalContent: string;

  /** Modified file content after changes */
  modifiedContent: string;

  /** Whether the diff has been applied to the file */
  applied: boolean;
}

/**
 * Common interface that all editor adapters must implement.
 * 
 * Safety: All methods use only public VS Code APIs and return result objects (never throw).
 */
export interface IEditorAdapter {
  /** Unique identifier for this editor (e.g., "continue", "kiro") */
  readonly editorId: string;

  /** Human-readable name for this editor (e.g., "Continue", "Kiro") */
  readonly editorName: string;

  /** Declared capabilities for this editor */
  readonly capabilities: EditorCapabilities;

  /**
   * Detect if this editor is installed and available.
   * Uses vscode.commands.getCommands(true) to discover editor-specific commands.
   */
  detect(): Promise<DetectionResult>;

  /**
   * Inject a prompt into the editor's chat panel.
   * Uses vscode.commands.executeCommand with editor-specific commands.
   */
  injectPrompt(prompt: string): Promise<PromptInjectionResult>;

  /**
   * Read chat history if supported (optional).
   * Only implemented by adapters with canReadChatHistory capability.
   */
  readChatHistory?(): Promise<ChatMessage[]>;

  /**
   * Read diff artifacts if supported (optional).
   * Only implemented by adapters with canReadDiffArtifacts capability.
   */
  readDiffArtifacts?(): Promise<DiffArtifact[]>;
}
