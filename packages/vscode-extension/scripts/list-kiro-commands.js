/**
 * Diagnostic script to list all available Kiro commands
 * Run this in the VS Code Extension Development Host console
 */

const vscode = require('vscode');

async function listKiroCommands() {
  try {
    const allCommands = await vscode.commands.getCommands(true);
    const kiroCommands = allCommands.filter(cmd => cmd.startsWith('kiro.'));
    
    console.log('=== KIRO COMMANDS ===');
    console.log(`Total Kiro commands found: ${kiroCommands.length}`);
    console.log('');
    
    kiroCommands.forEach((cmd, index) => {
      console.log(`${index + 1}. ${cmd}`);
    });
    
    console.log('');
    console.log('=== CHAT-RELATED COMMANDS ===');
    const chatCommands = kiroCommands.filter(cmd => 
      cmd.includes('chat') || 
      cmd.includes('send') || 
      cmd.includes('message') ||
      cmd.includes('submit') ||
      cmd.includes('prompt')
    );
    
    chatCommands.forEach(cmd => {
      console.log(`  - ${cmd}`);
    });
    
    return kiroCommands;
  } catch (error) {
    console.error('Error listing commands:', error);
  }
}

// Export for use in extension
module.exports = { listKiroCommands };

// If run directly in console
if (typeof window !== 'undefined') {
  listKiroCommands();
}
