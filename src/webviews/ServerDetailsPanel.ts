import * as vscode from 'vscode';
import { ServerProfile, HealthStatus } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

export class ServerDetailsPanel {
  private static panels = new Map<string, ServerDetailsPanel>();
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    private serverId: string,
    private serverManager: ServerManager,
    extensionUri: vscode.Uri
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'airflowServerDetails',
      'Server Details',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.webview.onDidReceiveMessage(
      message => this.handleMessage(message),
      null,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  private async handleMessage(message: any) {
    Logger.info('ServerDetailsPanel: Message received', { command: message.command });
    
    switch (message.command) {
      case 'testConnection':
        const result = await this.serverManager.testConnection(this.serverId);
        if (result.success) {
          vscode.window.showInformationMessage('✓ Connection successful');
        } else {
          vscode.window.showErrorMessage(`✗ Connection failed: ${result.message}`);
        }
        break;
      case 'refresh':
        await this.update();
        vscode.window.showInformationMessage('Health status refreshed');
        break;
    }
  }

  public static show(serverId: string, serverManager: ServerManager, extensionUri: vscode.Uri) {
    const existing = ServerDetailsPanel.panels.get(serverId);
    if (existing) {
      existing.panel.reveal();
      existing.update();
      return;
    }

    const panel = new ServerDetailsPanel(serverId, serverManager, extensionUri);
    ServerDetailsPanel.panels.set(serverId, panel);
  }

  private async update() {
    try {
      const servers = await this.serverManager.getServers();
      const server = servers.find(s => s.id === this.serverId);
      if (!server) {
        this.panel.webview.html = this.getErrorHtml('Server not found');
        return;
      }

      this.panel.title = `Server: ${server.name}`;
      
      let health: HealthStatus | undefined;
      try {
        const client = await this.serverManager.getClient(this.serverId);
        health = await client?.getHealth();
      } catch (error) {
        Logger.error('ServerDetailsPanel: Failed to get health', error);
      }

      this.panel.webview.html = this.getHtml(server, health);
    } catch (error: any) {
      Logger.error('ServerDetailsPanel.update: Failed', error);
      this.panel.webview.html = this.getErrorHtml(error.message);
    }
  }

  private getHtml(server: ServerProfile, health?: HealthStatus): string {
    const healthHtml = health ? `
      <div class="section">
        <h2>Health Status</h2>
        <div class="health-grid">
          <div class="health-item">
            <span class="label">Metadatabase:</span>
            <span class="status ${health.metadatabase.status}">${health.metadatabase.status}</span>
          </div>
          <div class="health-item">
            <span class="label">Scheduler:</span>
            <span class="status ${health.scheduler.status}">${health.scheduler.status}</span>
          </div>
          ${health.triggerer ? `
          <div class="health-item">
            <span class="label">Triggerer:</span>
            <span class="status ${health.triggerer.status}">${health.triggerer.status}</span>
          </div>` : ''}
          ${health.dagProcessor ? `
          <div class="health-item">
            <span class="label">DAG Processor:</span>
            <span class="status ${health.dagProcessor.status}">${health.dagProcessor.status}</span>
          </div>` : ''}
        </div>
      </div>
    ` : '<div class="section"><p>Health check unavailable</p></div>';

    return `<!DOCTYPE html>
    <html>
    <head>
      <style>
        body { padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
        h1 { margin-top: 0; }
        .section { margin: 20px 0; padding: 15px; background: var(--vscode-editor-background); border-radius: 4px; }
        .info-grid { display: grid; grid-template-columns: 150px 1fr; gap: 10px; }
        .label { font-weight: bold; }
        .value { word-break: break-all; }
        .health-grid { display: grid; gap: 10px; }
        .health-item { display: flex; justify-content: space-between; }
        .status { padding: 2px 8px; border-radius: 3px; }
        .status.healthy { background: #28a745; color: white; }
        .status.unhealthy { background: #dc3545; color: white; }
        .status.unknown { background: #6c757d; color: white; }
        button { padding: 8px 16px; margin: 5px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; }
        button:hover { background: var(--vscode-button-hoverBackground); }
      </style>
    </head>
    <body>
      <h1>${server.name}</h1>
      
      <div class="section">
        <h2>Connection Details</h2>
        <div class="info-grid">
          <span class="label">Type:</span>
          <span class="value">${server.type === 'mwaa' ? 'AWS MWAA' : 'Self-hosted'}</span>
          
          <span class="label">Endpoint:</span>
          <span class="value">${server.baseUrl}</span>
          
          ${server.awsRegion ? `
          <span class="label">AWS Region:</span>
          <span class="value">${server.awsRegion}</span>` : ''}
          
          <span class="label">API Mode:</span>
          <span class="value">${server.apiMode}</span>
          
          ${server.username ? `
          <span class="label">Username:</span>
          <span class="value">${server.username}</span>` : ''}
          
          <span class="label">Auth Type:</span>
          <span class="value">${server.authType}</span>
        </div>
      </div>

      ${healthHtml}

      <div class="section">
        <button onclick="testConnection()">Test Connection</button>
        <button onclick="refreshHealth()">Refresh Health</button>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        function testConnection() {
          vscode.postMessage({ command: 'testConnection' });
        }
        function refreshHealth() {
          vscode.postMessage({ command: 'refresh' });
        }
      </script>
    </body>
    </html>`;
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html>
    <html><body><h1>Error</h1><p>${message}</p></body></html>`;
  }

  private dispose() {
    ServerDetailsPanel.panels.delete(this.serverId);
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
