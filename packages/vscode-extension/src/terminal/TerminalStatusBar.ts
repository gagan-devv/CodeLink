import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { TerminalCompanionClient } from './TerminalCompanionClient';

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
    if (vscode.workspace.workspaceFolders) {
      for (const wf of vscode.workspace.workspaceFolders) {
        const candidate = path.join(
          wf.uri.fsPath,
          'packages',
          'companion',
          'dist',
          'bin',
          'codelink-terminal.js'
        );
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
    const extRelative = path.resolve(__dirname, '../../companion/dist/bin/codelink-terminal.js');
    if (fs.existsSync(extRelative)) {
      return extRelative;
    }
    return null;
  }

  public async startCompanionDaemon(): Promise<boolean> {
    const scriptPath = this.getCompanionScriptPath();
    if (!scriptPath) {
      const action = await vscode.window.showErrorMessage(
        'Could not locate built companion binary. Run "npm run build" in packages/companion first.',
        'Build Companion'
      );
      if (action === 'Build Companion') {
        const term = vscode.window.createTerminal('CodeLink Build');
        term.show();
        term.sendText('npm run build --workspace=@codelink/companion');
      }
      return false;
    }

    try {
      const child = child_process.spawn(process.execPath, [scriptPath, 'start-daemon'], {
        detached: true,
        stdio: 'ignore',
        env: process.env,
      });
      child.unref();

      vscode.window.showInformationMessage('Spawning CodeLink Terminal companion daemon...');
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const online = await this.client.isDaemonAvailable();
        if (online) {
          await this.updateStatus();
          vscode.window.showInformationMessage(
            '✓ CodeLink Terminal companion daemon started successfully.'
          );
          return true;
        }
      }
      await this.updateStatus();
      vscode.window.showWarningMessage(
        'Companion daemon was spawned, but socket is not ready yet. Check logs or run "systemctl --user status codelink-terminal".'
      );
      return false;
    } catch (err) {
      vscode.window.showErrorMessage(`Failed to spawn companion daemon: ${err}`);
      return false;
    }
  }

  public showLocalCliCommands(): void {
    const scriptPath =
      this.getCompanionScriptPath() || 'packages/companion/dist/bin/codelink-terminal.js';
    const term = vscode.window.createTerminal('CodeLink Companion');
    term.show();
    term.sendText(`# CodeLink Terminal Companion Commands:`);
    term.sendText(`# 1. Check status:`);
    term.sendText(`node "${scriptPath}" status`);
    term.sendText(`# 2. If managed by systemd:`);
    term.sendText(`systemctl --user status codelink-terminal`);
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
