import * as vscode from 'vscode';
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
        'Retry',
        'Open Terminal CLI Help'
      );
      if (choice === 'Retry') {
        await this.updateStatus();
      } else if (choice === 'Open Terminal CLI Help') {
        const term = vscode.window.createTerminal('CodeLink Companion');
        term.show();
        term.sendText('npx codelink-terminal status');
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
