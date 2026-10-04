import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { TerminalCompanionClient } from './TerminalCompanionClient';

/**
 * Safely format a shell invocation for display/copying without command injection.
 * Single-quotes any parameter containing special shell characters or whitespace,
 * escaping internal single quotes via POSIX-standard `'\''`.
 */
export function formatSafeShellCommand(
  nodeBin: string,
  scriptPath: string,
  subCmd: string
): string {
  function quoteArg(arg: string): string {
    if (/^[a-zA-Z0-9_\-./]+$/.test(arg)) {
      return arg;
    }
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }
  return `${quoteArg(nodeBin)} ${quoteArg(scriptPath)} ${quoteArg(subCmd)}`;
}

export function resolveCompanionPath(
  configuredPath?: string,
  workspaceFolders?: readonly vscode.WorkspaceFolder[],
  isTrusted?: boolean,
  extDirname: string = __dirname
): { path: string | null; error?: string } {
  // 1. Explicitly configured path always takes precedence
  if (configuredPath && configuredPath.trim()) {
    const trimmed = configuredPath.trim();
    if (fs.existsSync(trimmed)) {
      return { path: trimmed };
    }
    return { path: null, error: `Configured companion path does not exist: ${trimmed}` };
  }

  // 2. Reject repo-built path execution in untrusted workspaces
  if (isTrusted === false) {
    return {
      path: null,
      error:
        'Refusing to execute companion from an untrusted workspace. Trust this workspace or configure codelink.terminal.companionPath.',
    };
  }

  // 3. Search in trusted workspace folders
  if (workspaceFolders) {
    for (const wf of workspaceFolders) {
      const candidate = path.join(
        wf.uri.fsPath,
        'packages',
        'companion',
        'dist',
        'bin',
        'codelink-terminal.js'
      );
      if (fs.existsSync(candidate)) {
        return { path: candidate };
      }
    }
  }

  // 4. Resolve relative to extension installation/build directory
  // In dev/dist layout: dist/terminal/TerminalStatusBar.js -> ../../../packages/companion or ../../../companion
  const candidates = [
    path.resolve(extDirname, '../../../companion/dist/bin/codelink-terminal.js'),
    path.resolve(extDirname, '../../../../packages/companion/dist/bin/codelink-terminal.js'),
    path.resolve(extDirname, '../../companion/dist/bin/codelink-terminal.js'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return { path: c };
    }
  }

  return {
    path: null,
    error:
      'Could not locate built companion binary. Run "npm run build" in packages/companion first or set codelink.terminal.companionPath.',
  };
}

export class TerminalStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private client: TerminalCompanionClient;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(client?: TerminalCompanionClient) {
    this.client = client || new TerminalCompanionClient();
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 95);
    this.statusBarItem.command = 'codelink.terminalMenu';
    this.updateStatus();
    this.startPolling();
  }

  public get item(): vscode.StatusBarItem {
    return this.statusBarItem;
  }

  public getCompanionScriptPath(): string | null {
    const config = vscode.workspace.getConfiguration('codelink');
    const configuredPath = config.get<string>('terminal.companionPath');
    const isTrusted = vscode.workspace.isTrusted;
    const res = resolveCompanionPath(
      configuredPath,
      vscode.workspace.workspaceFolders,
      isTrusted,
      __dirname
    );
    return res.path;
  }

  public async startCompanionDaemon(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration('codelink');
    const configuredPath = config.get<string>('terminal.companionPath');
    const nodeBin = config.get<string>('terminal.nodePath', 'node') || 'node';
    const isTrusted = vscode.workspace.isTrusted;

    const resolved = resolveCompanionPath(
      configuredPath,
      vscode.workspace.workspaceFolders,
      isTrusted,
      __dirname
    );

    if (!resolved.path) {
      const msg = resolved.error || 'Could not locate companion binary.';
      if (msg.includes('Run "npm run build"')) {
        const action = await vscode.window.showErrorMessage(msg, 'Build Companion');
        if (action === 'Build Companion') {
          const term = vscode.window.createTerminal('CodeLink Build');
          term.show();
          term.sendText('npm run build --workspace=@codelink/companion');
        }
      } else {
        vscode.window.showErrorMessage(msg);
      }
      return false;
    }

    const scriptPath = resolved.path;

    return new Promise<boolean>((resolve) => {
      let isSettled = false;
      let child: child_process.ChildProcess;

      try {
        child = child_process.spawn(nodeBin, [scriptPath, 'start-daemon'], {
          detached: true,
          stdio: 'ignore',
          env: process.env,
        });
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to spawn companion process (${nodeBin}): ${err}`);
        return resolve(false);
      }

      // Handle async child error (e.g. node binary not found ENOENT)
      child.on('error', (err) => {
        if (!isSettled) {
          isSettled = true;
          vscode.window.showErrorMessage(
            `Failed to start companion daemon (${nodeBin}): ${err.message}`
          );
          resolve(false);
        }
      });

      // Handle premature exit
      child.on('exit', (code) => {
        if (!isSettled && code !== null && code !== 0) {
          isSettled = true;
          vscode.window.showWarningMessage(
            `Companion daemon process exited prematurely with code ${code}.`
          );
          resolve(false);
        }
      });

      child.unref();

      vscode.window.showInformationMessage('Spawning CodeLink Terminal companion daemon...');

      // Poll up to 2 seconds for daemon availability
      let attempts = 0;
      const checkInterval = setInterval(async () => {
        attempts++;
        if (isSettled) {
          clearInterval(checkInterval);
          return;
        }

        const online = await this.client.isDaemonAvailable();
        if (online) {
          clearInterval(checkInterval);
          if (!isSettled) {
            isSettled = true;
            await this.updateStatus();
            vscode.window.showInformationMessage(
              '✓ CodeLink Terminal companion daemon started successfully.'
            );
            resolve(true);
          }
          return;
        }

        if (attempts >= 4) {
          clearInterval(checkInterval);
          if (!isSettled) {
            isSettled = true;
            await this.updateStatus();
            vscode.window.showWarningMessage(
              'Companion daemon was spawned, but socket is not ready yet. Check logs or run "systemctl --user status codelink-terminal".'
            );
            resolve(false);
          }
        }
      }, 500);
    });
  }

  public async showLocalCliCommands(): Promise<void> {
    const config = vscode.workspace.getConfiguration('codelink');
    const nodeBin = config.get<string>('terminal.nodePath', 'node') || 'node';
    const scriptPath =
      this.getCompanionScriptPath() || 'packages/companion/dist/bin/codelink-terminal.js';

    const safeCmd = formatSafeShellCommand(nodeBin, scriptPath, 'status');
    const action = await vscode.window.showInformationMessage(
      `CodeLink Terminal companion local CLI command:\n${safeCmd}\n\nSystemd service command:\nsystemctl --user status codelink-terminal`,
      'Copy CLI Command',
      'Copy Systemd Command'
    );

    if (action === 'Copy CLI Command') {
      await vscode.env.clipboard.writeText(safeCmd);
      vscode.window.showInformationMessage('Copied companion CLI command to clipboard.');
    } else if (action === 'Copy Systemd Command') {
      await vscode.env.clipboard.writeText('systemctl --user status codelink-terminal');
      vscode.window.showInformationMessage('Copied systemctl command to clipboard.');
    }
  }

  public async updateStatus(): Promise<void> {
    try {
      const isAvail = await this.client.isDaemonAvailable();
      if (!isAvail) {
        this.statusBarItem.text = '$(terminal) CodeLink: Terminal Off';
        this.statusBarItem.tooltip =
          'CodeLink Terminal companion daemon is not running. Click to manage.';
        this.statusBarItem.show();
        return;
      }

      const status = await this.client.getStatus();
      if (status.enabled) {
        if (status.activeSessions > 0) {
          this.statusBarItem.text = `$(terminal) CodeLink Terminal: Active (${status.activeSessions})`;
          this.statusBarItem.tooltip = `CodeLink Terminal: ${status.activeSessions} active session(s). Click to manage or reclaim control.`;
        } else {
          this.statusBarItem.text = '$(terminal) CodeLink Terminal: Ready';
          this.statusBarItem.tooltip =
            'CodeLink Terminal: Service running, 0 active sessions. Click to manage.';
        }
      } else {
        this.statusBarItem.text = '$(terminal) CodeLink Terminal: Disabled';
        this.statusBarItem.tooltip =
          'CodeLink Terminal: Feature disabled on host. Click to enable.';
      }
      this.statusBarItem.show();
    } catch {
      this.statusBarItem.text = '$(terminal) CodeLink: Terminal Off';
      this.statusBarItem.tooltip = 'CodeLink Terminal companion is offline.';
      this.statusBarItem.show();
    }
  }

  public async showMenu(): Promise<void> {
    const isAvail = await this.client.isDaemonAvailable();
    if (!isAvail) {
      const choice = await vscode.window.showWarningMessage(
        'CodeLink Terminal daemon is offline. Shells require the companion service.',
        'Start Companion',
        'Show CLI Commands',
        'Retry'
      );
      if (choice === 'Start Companion') {
        await this.startCompanionDaemon();
      } else if (choice === 'Show CLI Commands') {
        this.showLocalCliCommands();
      } else if (choice === 'Retry') {
        await this.updateStatus();
      }
      return;
    }

    let status;
    try {
      status = await this.client.getStatus();
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to communicate with companion: ${err}`);
      return;
    }

    const items: vscode.QuickPickItem[] = [
      {
        label: `$(info) Status: ${status.enabled ? 'Enabled' : 'Disabled'} (${status.activeSessions} sessions, uptime ${status.uptimeSeconds}s)`,
        description: 'Daemon running on local host',
      },
      {
        label: '$(device-desktop) Reclaim Control (Host Takeover)',
        description: 'Take over an active remote terminal session back to this laptop',
      },
      {
        label: '$(trash) Kill Terminal Session',
        description: 'Emergency stop a specific active session and process tree',
      },
      {
        label: '$(stop) Emergency Kill All Sessions',
        description: 'Terminate all active remote shells and background processes',
      },
      {
        label: status.enabled
          ? '$(circle-slash) Disable Companion Service'
          : '$(check) Enable Companion Service',
        description: status.enabled
          ? 'Disable remote shells and close connections'
          : 'Enable remote shell access',
      },
    ];

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'CodeLink Terminal Management',
    });

    if (!selected) return;

    if (selected.label.includes('Reclaim Control')) {
      const sessions = await this.client.listSessions();
      if (sessions.length === 0) {
        vscode.window.showInformationMessage('No active terminal sessions to take over.');
        return;
      }
      const sessionPicks = sessions.map((s) => ({
        label: s.title || s.id,
        description: `ID: ${s.id} | Controller: ${s.controllerDeviceId || 'none'} | Observers: ${s.observerCount}`,
        id: s.id,
      }));
      const chosenSession = await vscode.window.showQuickPick(sessionPicks, {
        placeHolder: 'Select session to reclaim control',
      });
      if (chosenSession) {
        await this.client.takeoverSession(chosenSession.id);
        vscode.window.showInformationMessage(
          `✓ Reclaimed control of session ${chosenSession.label}`
        );
        await this.updateStatus();
      }
    } else if (selected.label.includes('Kill Terminal Session')) {
      const sessions = await this.client.listSessions();
      if (sessions.length === 0) {
        vscode.window.showInformationMessage('No active terminal sessions to terminate.');
        return;
      }
      const sessionPicks = sessions.map((s) => ({
        label: s.title || s.id,
        description: `ID: ${s.id} | Controller: ${s.controllerDeviceId || 'none'}`,
        id: s.id,
      }));
      const chosenSession = await vscode.window.showQuickPick(sessionPicks, {
        placeHolder: 'Select session to emergency kill',
      });
      if (chosenSession) {
        await this.client.killSession(chosenSession.id);
        vscode.window.showWarningMessage(`Terminated terminal session ${chosenSession.label}`);
        await this.updateStatus();
      }
    } else if (selected.label.includes('Emergency Kill All')) {
      const confirm = await vscode.window.showWarningMessage(
        'Terminate all active remote terminal sessions and kill all child processes?',
        { modal: true },
        'Kill All'
      );
      if (confirm === 'Kill All') {
        await this.client.killAllSessions();
        vscode.window.showWarningMessage('All CodeLink terminal sessions have been terminated.');
        await this.updateStatus();
      }
    } else if (selected.label.includes('Disable Companion')) {
      await this.client.disableService();
      vscode.window.showInformationMessage('CodeLink Terminal companion service disabled.');
      await this.updateStatus();
    } else if (selected.label.includes('Enable Companion')) {
      await this.client.enableService();
      vscode.window.showInformationMessage('CodeLink Terminal companion service enabled.');
      await this.updateStatus();
    }
  }

  public startPolling(intervalMs: number = 10000): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    this.pollInterval = setInterval(() => {
      this.updateStatus();
    }, intervalMs);
  }

  public dispose(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    this.statusBarItem.dispose();
  }
}
