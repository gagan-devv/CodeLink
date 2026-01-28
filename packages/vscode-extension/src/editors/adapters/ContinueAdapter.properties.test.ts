import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ContinueAdapter } from './ContinueAdapter';
import * as vscode from 'vscode';

// Mock vscode module
vi.mock('vscode', () => ({
  commands: {
    getCommands: vi.fn(),
    executeCommand: vi.fn(),
  },
}));

describe('ContinueAdapter - Property-Based Tests', () => {
  let adapter: ContinueAdapter;

  beforeEach(() => {
    adapter = new ContinueAdapter();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Feature: editor-adapter-system, Property 1: Editor Detection via Command Discovery
  // Validates: Requirements 1.1, 2.3
  it('Property 1: Editor Detection via Command Discovery', async () => {
    // Generator for command lists with varying Continue command presence
    const commandListArb = fc
      .tuple(
        // Continue commands (0-10)
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .map((suffix) => `continue.${suffix}`),
          { minLength: 0, maxLength: 10 }
        ),
        // Other commands (0-20)
        fc.array(
          fc
            .tuple(
              fc.constantFrom('vscode', 'workbench', 'editor', 'git', 'debug'),
              fc.string({ minLength: 1, maxLength: 20 })
            )
            .map(([prefix, suffix]) => `${prefix}.${suffix}`),
          { minLength: 0, maxLength: 20 }
        )
      )
      .map(([continueCommands, otherCommands]) => {
        // Combine and shuffle
        const allCommands = [...continueCommands, ...otherCommands];
        return {
          commands: allCommands,
          hasContinueCommands: continueCommands.length > 0,
          continueCommandCount: continueCommands.length,
        };
      });

    await fc.assert(
      fc.asyncProperty(commandListArb, async ({ commands, hasContinueCommands, continueCommandCount }) => {
        // Mock vscode.commands.getCommands to return our generated command list
        vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

        // Call detect
        const result = await adapter.detect();

        // Property: Detection correctly identifies Continue based on command patterns
        expect(result.isInstalled).toBe(hasContinueCommands);

        // Property: Available commands should only include Continue commands
        if (hasContinueCommands) {
          expect(result.availableCommands).toBeDefined();
          expect(result.availableCommands!.length).toBe(continueCommandCount);
          
          // All returned commands should start with "continue."
          result.availableCommands!.forEach((cmd) => {
            expect(cmd.startsWith('continue.')).toBe(true);
          });
        } else {
          // When no Continue commands, should still have availableCommands array
          expect(result.availableCommands).toBeDefined();
          expect(result.availableCommands!.length).toBe(0);
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: editor-adapter-system, Property 1: Detection handles command query failures
  it('Property 1: Detection fails safe when command query throws', async () => {
    // Generator for different error types
    const errorArb = fc.oneof(
      fc.constant(new Error('Command query failed')),
      fc.constant(new Error('VS Code API unavailable')),
      fc.string().map((msg) => new Error(msg)),
      fc.constant('String error'),
      fc.constant(null),
      fc.constant(undefined)
    );

    await fc.assert(
      fc.asyncProperty(errorArb, async (error) => {
        // Mock vscode.commands.getCommands to throw
        vi.mocked(vscode.commands.getCommands).mockRejectedValue(error);

        // Call detect
        const result = await adapter.detect();

        // Property: Detection fails safe by returning not installed
        expect(result.isInstalled).toBe(false);
        expect(result.availableCommands).toEqual([]);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: editor-adapter-system, Property 1: Detection is idempotent
  it('Property 1: Repeated detection returns consistent results', async () => {
    // Generator for command lists
    const commandListArb = fc.array(
      fc
        .string({ minLength: 1, maxLength: 20 })
        .map((suffix) => `continue.${suffix}`),
      { minLength: 0, maxLength: 10 }
    );

    await fc.assert(
      fc.asyncProperty(commandListArb, async (continueCommands) => {
        // Mock vscode.commands.getCommands
        vi.mocked(vscode.commands.getCommands).mockResolvedValue(continueCommands);

        // Call detect multiple times
        const result1 = await adapter.detect();
        const result2 = await adapter.detect();
        const result3 = await adapter.detect();

        // Property: All results should be identical (idempotent)
        expect(result1).toEqual(result2);
        expect(result2).toEqual(result3);
      }),
      { numRuns: 100 }
    );
  });

  // Feature: editor-adapter-system, Property 1: Detection correctly filters command patterns
  it('Property 1: Detection only identifies commands with exact prefix match', async () => {
    // Generator for edge case command patterns
    const edgeCaseCommandsArb = fc.array(
      fc.oneof(
        fc.constant('continue.validCommand'),
        fc.constant('continue'),
        fc.constant('continue'),
        fc.constant('continueX.fakeCommand'),
        fc.constant('xcontinue.fakeCommand'),
        fc.constant('CONTINUE.upperCase'),
        fc.constant('Continue.mixedCase'),
        fc.constant('continue..doubleDoT'),
        fc.constant('continue.'),
      ),
      { minLength: 0, maxLength: 20 }
    );

    await fc.assert(
      fc.asyncProperty(edgeCaseCommandsArb, async (commands) => {
        // Mock vscode.commands.getCommands
        vi.mocked(vscode.commands.getCommands).mockResolvedValue(commands);

        // Call detect
        const result = await adapter.detect();

        // Property: Only commands starting with exactly "continue." should be detected
        const expectedContinueCommands = commands.filter((cmd) =>
          cmd.startsWith('continue.')
        );

        expect(result.isInstalled).toBe(expectedContinueCommands.length > 0);
        
        if (result.availableCommands) {
          expect(result.availableCommands.length).toBe(expectedContinueCommands.length);
          
          // All returned commands must start with "continue."
          result.availableCommands.forEach((cmd) => {
            expect(cmd.startsWith('continue.')).toBe(true);
          });
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: editor-adapter-system, Property 4: Prompt Injection Returns Valid Result
  // Validates: Requirements 2.1, 2.4, 2.5
  it('Property 4: Prompt Injection Returns Valid Result', async () => {
    // Generator for various prompt strings including edge cases
    const promptArb = fc.oneof(
      fc.string({ minLength: 1, maxLength: 1000 }), // Normal strings
      fc.constant(''), // Empty string
      fc.string({ minLength: 5000, maxLength: 10000 }), // Very long strings
      fc.constant('Hello\nWorld'), // Multiline
      fc.constant('Special chars: !@#$%^&*()'), // Special characters
      fc.constant('Unicode: 你好 🚀 émojis'), // Unicode
      fc.constant('   whitespace   '), // Whitespace
      fc.constant('\t\n\r'), // Control characters
    );

    await fc.assert(
      fc.asyncProperty(promptArb, async (prompt) => {
        // Mock successful command execution
        vi.mocked(vscode.commands.executeCommand).mockResolvedValue(undefined);

        // Call injectPrompt
        const result = await adapter.injectPrompt(prompt);

        // Property: Result must have success boolean
        expect(typeof result.success).toBe('boolean');

        // Property: If successful, commandUsed should be present
        if (result.success) {
          expect(result.commandUsed).toBeDefined();
          expect(typeof result.commandUsed).toBe('string');
          expect(result.commandUsed).toBe('continue.continueGUIView.focusContinueInput');
        }

        // Property: If failed, error message should be present and non-empty
        if (!result.success) {
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);
        }

        // Property: Result should not have both success=true and error message
        if (result.success) {
          // Error can be undefined or empty when successful
          expect(result.error).toBeUndefined();
        }
      }),
      { numRuns: 100 }
    );
  });

  // Feature: editor-adapter-system, Property 4: Prompt Injection handles command failures
  it('Property 4: Prompt Injection returns error result on command failure', async () => {
    // Generator for different error types
    const errorArb = fc.oneof(
      fc.constant(new Error('Command not found')),
      fc.constant(new Error('VS Code API unavailable')),
      fc.constant(new Error('Extension not activated')),
      fc.string().map((msg) => new Error(msg)),
      fc.constant('String error'),
      fc.constant(null),
      fc.constant(undefined),
    );

    const promptArb = fc.string({ minLength: 1, maxLength: 100 });

    await fc.assert(
      fc.asyncProperty(
        fc.tuple(promptArb, errorArb),
        async ([prompt, error]) => {
          // Mock command execution to throw
          vi.mocked(vscode.commands.executeCommand).mockRejectedValue(error);

          // Call injectPrompt
          const result = await adapter.injectPrompt(prompt);

          // Property: Must return error result (not throw)
          expect(result.success).toBe(false);

          // Property: Error message must be present and descriptive
          expect(result.error).toBeDefined();
          expect(typeof result.error).toBe('string');
          expect(result.error!.length).toBeGreaterThan(0);

          // Property: Error message should contain context
          expect(result.error).toContain('Failed to inject prompt');

          // Property: commandUsed should still be present for debugging
          expect(result.commandUsed).toBeDefined();
          expect(result.commandUsed).toBe('continue.continueGUIView.focusContinueInput');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: editor-adapter-system, Property 4: Prompt Injection never throws exceptions
  it('Property 4: Prompt Injection never throws, always returns result', async () => {
    const promptArb = fc.string({ minLength: 0, maxLength: 1000 });
    const errorArb = fc.anything();

    await fc.assert(
      fc.asyncProperty(
        fc.tuple(promptArb, errorArb),
        async ([prompt, error]) => {
          // Mock command execution to throw anything
          vi.mocked(vscode.commands.executeCommand).mockRejectedValue(error);

          // Property: injectPrompt should never throw, always return a result
          let threwException = false;
          let result;

          try {
            result = await adapter.injectPrompt(prompt);
          } catch (e) {
            threwException = true;
          }

          // Should not throw
          expect(threwException).toBe(false);

          // Should return a valid result object
          expect(result).toBeDefined();
          expect(typeof result!.success).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: editor-adapter-system, Property 4: Prompt Injection uses correct command
  it('Property 4: Prompt Injection always uses the correct Continue command', async () => {
    const promptArb = fc.string({ minLength: 1, maxLength: 500 });

    await fc.assert(
      fc.asyncProperty(promptArb, async (prompt) => {
        // Clear mocks before each property test run
        vi.clearAllMocks();
        
        // Mock successful command execution
        const executeCommandMock = vi.mocked(vscode.commands.executeCommand);
        executeCommandMock.mockResolvedValue(undefined);

        // Call injectPrompt
        await adapter.injectPrompt(prompt);

        // Property: Should call executeCommand with correct command name
        expect(executeCommandMock).toHaveBeenCalledWith(
          'continue.continueGUIView.focusContinueInput',
          { text: prompt }
        );

        // Property: Should call exactly once
        expect(executeCommandMock).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 }
    );
  });
});
