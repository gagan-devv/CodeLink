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
exports.EditorAdapterErrorType = void 0;
exports.safeExecuteCommand = safeExecuteCommand;
exports.requireCapability = requireCapability;
exports.requireMethod = requireMethod;
exports.formatAdapterError = formatAdapterError;
exports.createAdapterError = createAdapterError;
exports.executeWithCapabilityCheck = executeWithCapabilityCheck;
const vscode = __importStar(require("vscode"));
/**
 * Error types for editor adapter operations.
 */
var EditorAdapterErrorType;
(function (EditorAdapterErrorType) {
    /** Command execution failed */
    EditorAdapterErrorType["COMMAND_EXECUTION_FAILED"] = "COMMAND_EXECUTION_FAILED";
    /** Editor not installed or not detected */
    EditorAdapterErrorType["EDITOR_NOT_FOUND"] = "EDITOR_NOT_FOUND";
    /** Operation not supported by this editor */
    EditorAdapterErrorType["UNSUPPORTED_OPERATION"] = "UNSUPPORTED_OPERATION";
    /** Capability check failed */
    EditorAdapterErrorType["CAPABILITY_CHECK_FAILED"] = "CAPABILITY_CHECK_FAILED";
    /** Unknown or unexpected error */
    EditorAdapterErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(EditorAdapterErrorType || (exports.EditorAdapterErrorType = EditorAdapterErrorType = {}));
/**
 * Safe command execution wrapper that catches exceptions and returns error results.
 *
 * Safety: Never throws exceptions. Always returns a PromptInjectionResult with
 * clear error messages if the command fails.
 *
 * @param command - VS Code command to execute
 * @param args - Arguments to pass to the command
 * @returns PromptInjectionResult indicating success or failure
 */
async function safeExecuteCommand(command, ...args) {
    try {
        await vscode.commands.executeCommand(command, ...args);
        return {
            success: true,
            commandUsed: command,
        };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
            success: false,
            error: `Command '${command}' failed: ${errorMessage}`,
            commandUsed: command,
        };
    }
}
/**
 * Check if an adapter has a specific capability before attempting an operation.
 *
 * Safety: Prevents invalid operations by checking capabilities first.
 * Throws a clear error if the capability is not supported.
 *
 * @param adapter - The editor adapter to check
 * @param capability - The capability key to check
 * @param operationName - Human-readable name of the operation (for error messages)
 * @throws Error if the capability is not supported
 */
function requireCapability(adapter, capability, operationName) {
    const hasCapability = adapter.capabilities[capability];
    if (!hasCapability) {
        throw new Error(`Editor ${adapter.editorName} does not support ${operationName}. ` +
            `Capability '${capability}' is not available. ` +
            `Sync level: ${adapter.capabilities.syncLevel}`);
    }
}
/**
 * Check if an adapter has implemented an optional method.
 *
 * Safety: Ensures that adapters claiming a capability actually implement
 * the corresponding method.
 *
 * @param adapter - The editor adapter to check
 * @param methodName - The method name to check
 * @param capability - The capability that should enable this method
 * @throws Error if the method is not implemented despite capability being true
 */
function requireMethod(adapter, methodName, capability) {
    const method = adapter[methodName];
    if (!method || typeof method !== 'function') {
        throw new Error(`Editor ${adapter.editorName} claims to support '${String(capability)}' ` +
            `but does not implement ${String(methodName)}() method`);
    }
}
/**
 * Format an error message with context about the adapter and operation.
 *
 * @param adapter - The editor adapter that encountered the error
 * @param operation - The operation that failed
 * @param error - The error that occurred
 * @returns Formatted error message with full context
 */
function formatAdapterError(adapter, operation, error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (`Failed to ${operation} for editor ${adapter.editorName} (${adapter.editorId}): ` +
        `${errorMessage}`);
}
/**
 * Create a structured error result for adapter operations.
 *
 * @param errorType - The type of error that occurred
 * @param message - Human-readable error message
 * @param details - Optional additional context
 * @returns Structured error result
 */
function createAdapterError(errorType, message, details) {
    return {
        success: false,
        error: message,
        errorCode: errorType,
        details,
    };
}
/**
 * Safely execute an operation that requires a specific capability.
 *
 * This combines capability checking with safe execution and error formatting.
 *
 * @param adapter - The editor adapter to use
 * @param capability - The required capability
 * @param operationName - Human-readable operation name
 * @param operation - The async operation to execute
 * @returns Result of the operation or an error
 */
async function executeWithCapabilityCheck(adapter, capability, operationName, operation) {
    try {
        requireCapability(adapter, capability, operationName);
        return await operation();
    }
    catch (error) {
        throw new Error(formatAdapterError(adapter, operationName, error));
    }
}
//# sourceMappingURL=errors.js.map