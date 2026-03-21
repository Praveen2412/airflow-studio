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
      'airflowServerDetails', 'Server Details', vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(serverId: string, serverManager: ServerManager, extensionUri: vscode.Uri) {
    const existing = ServerDetailsPanel.panels.get(serverId);
    if (existing) { existing.panel.reveal(); existing.update(); return; }
    const p = new ServerDetailsPanel(serverId, serverManager, extensionUri);
    ServerDetailsPanel.panels.set(serverId, p);
  }

  private async handleMessage(msg: any) {
    if (msg.command === 'refresh') {
      await this.update();
    } else if (msg.command === 'testConnection') {
      const result = await this.serverManager.testConnection(this.serverId);
      vscode.window.showInformationMessage(result.success ? '✓ Connection successful' : `✗ ${result.message}`);
    }
  }

  private async update() {
    try {
      const servers = await this.serverManager.getServers();
      const server = servers.find(s => s.id === this.serverId);
      if (!server) { this.panel.webview.html = errHtml('Server not found'); return; }
      this.panel.title = `Server: ${server.name}`;
      this.panel.webview.html = loadingHtml(server.name);

      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = errHtml('Could not create client'); return; }

      // Fetch all data in parallel, don't fail if some endpoints are unavailable
      const [health, dagStats, version, dags] = await Promise.all([
        client.getHealth().catch(() => undefined),
        client.getDagStats().catch(() => undefined),
        client.getVersion().catch(() => 'unknown'),
        client.listDags().catch(() => [])
      ]);

      const total = dags.length;
      const active = dags.filter(d => !d.paused).length;
      const paused = dags.filter(d => d.paused).length;

      this.panel.webview.html = this.getHtml(server, health, dagStats, version as string, total, active, paused);
    } catch (error: any) {
      Logger.error('ServerDetailsPanel.update: Failed', error);
      this.panel.webview.html = errHtml(error.message);
    }
  }

  private getHtml(
    server: ServerProfile,
    health: HealthStatus | undefined,
    dagStats: any,
    version: string,
    total: number,
    active: number,
    paused: number
  ): string {
    const statusColor = (s: string) => s === 'healthy' ? '#27ae60' : s === 'unhealthy' ? '#c0392b' : '#7f8c8d';
    const statusDot = (s: string) => `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${statusColor(s)};margin-right:6px"></span>`;

    const healthRows = health ? [
      ['Metadatabase', health.metadatabase.status],
      ['Scheduler', health.scheduler.status],
      ...(health.triggerer ? [['Triggerer', health.triggerer.status]] : []),
      ...(health.dagProcessor ? [['DAG Processor', health.dagProcessor.status]] : []),
      ...(health.scheduler.latestHeartbeat ? [['Last Heartbeat', new Date(health.scheduler.latestHeartbeat).toLocaleString()]] : [])
    ].map(([label, val]) =>
      `<div class="info-row"><span class="lbl">${label}</span><span>${statusDot(val)}${val}</span></div>`
    ).join('') : '<div class="info-row"><span class="lbl">Health</span><span>Unavailable</span></div>';

    const runStats = dagStats ? [
      ['Running', dagStats.running ?? '-', '#2980b9'],
      ['Queued', dagStats.queued ?? '-', '#f39c12'],
      ['Success', dagStats.success ?? '-', '#27ae60'],
      ['Failed', dagStats.failed ?? '-', '#c0392b'],
    ] : [];

    const runStatsHtml = runStats.length ? runStats.map(([label, val, color]) =>
      `<div class="metric-card" style="border-top:3px solid ${color}">
        <div class="metric-val" style="color:${color}">${val}</div>
        <div class="metric-lbl">${label} Runs</div>
      </div>`
    ).join('') : '';

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{padding:24px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background)}
      h1{font-size:22px;margin-bottom:4px}
      .subtitle{color:var(--vscode-descriptionForeground);font-size:13px;margin-bottom:20px}
      .section{background:var(--vscode-sideBar-background);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:16px;margin-bottom:16px}
      .section h2{font-size:14px;font-weight:600;margin-bottom:12px;color:var(--vscode-descriptionForeground);text-transform:uppercase;letter-spacing:.5px}
      .info-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--vscode-panel-border);font-size:13px}
      .info-row:last-child{border-bottom:none}
      .lbl{font-weight:600;color:var(--vscode-descriptionForeground)}
      .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
      .metric-card{background:var(--vscode-sideBar-background);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:16px;text-align:center}
      .metric-val{font-size:32px;font-weight:700;line-height:1}
      .metric-lbl{font-size:12px;color:var(--vscode-descriptionForeground);margin-top:4px}
      .run-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
      button{padding:7px 16px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;cursor:pointer;border-radius:4px;font-size:13px;margin-right:8px}
      button:hover{background:var(--vscode-button-hoverBackground)}
      button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
      .tag{display:inline-block;padding:2px 8px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:10px;font-size:11px;margin:2px}
    </style></head><body>
      <h1>${esc(server.name)}</h1>
      <div class="subtitle">${server.type === 'mwaa' ? 'AWS MWAA' : 'Self-hosted Airflow'} &bull; ${esc(server.baseUrl)} &bull; v${esc(version)}</div>

      <div class="metrics">
        <div class="metric-card" style="border-top:3px solid var(--vscode-button-background)">
          <div class="metric-val">${total}</div>
          <div class="metric-lbl">Total DAGs</div>
        </div>
        <div class="metric-card" style="border-top:3px solid #27ae60">
          <div class="metric-val" style="color:#27ae60">${active}</div>
          <div class="metric-lbl">Active DAGs</div>
        </div>
        <div class="metric-card" style="border-top:3px solid #f39c12">
          <div class="metric-val" style="color:#f39c12">${paused}</div>
          <div class="metric-lbl">Paused DAGs</div>
        </div>
      </div>

      ${runStatsHtml ? `<div class="run-metrics">${runStatsHtml}</div>` : ''}

      <div class="section">
        <h2>Health Status</h2>
        ${healthRows}
      </div>

      <div class="section">
        <h2>Connection Details</h2>
        <div class="info-row"><span class="lbl">Type</span><span>${server.type === 'mwaa' ? 'AWS MWAA' : 'Self-hosted'}</span></div>
        <div class="info-row"><span class="lbl">Endpoint</span><span>${esc(server.baseUrl)}</span></div>
        ${server.awsRegion ? `<div class="info-row"><span class="lbl">AWS Region</span><span>${esc(server.awsRegion)}</span></div>` : ''}
        <div class="info-row"><span class="lbl">API Mode</span><span><span class="tag">${esc(server.apiMode)}</span></span></div>
        ${server.username ? `<div class="info-row"><span class="lbl">Username</span><span>${esc(server.username)}</span></div>` : ''}
        <div class="info-row"><span class="lbl">Auth Type</span><span>${esc(server.authType)}</span></div>
      </div>

      <div>
        <button id="btnRefresh">&#x1F504; Refresh</button>
        <button class="secondary" id="btnTest">&#x1F50C; Test Connection</button>
      </div>

      <script>
      (function(){
        const vscode = acquireVsCodeApi();
        document.getElementById('btnRefresh').addEventListener('click', function(){ vscode.postMessage({command:'refresh'}); });
        document.getElementById('btnTest').addEventListener('click', function(){ vscode.postMessage({command:'testConnection'}); });
      })();
      </script>
    </body></html>`;
  }

  private dispose() {
    ServerDetailsPanel.panels.delete(this.serverId);
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}

function esc(v: any): string {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function errHtml(msg: string): string {
  return `<!DOCTYPE html><html><body style="padding:20px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)"><h2>Error</h2><p>${esc(msg)}</p></body></html>`;
}
function loadingHtml(name: string): string {
  return `<!DOCTYPE html><html><body style="padding:20px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)"><h2>${esc(name)}</h2><p>Loading...</p></body></html>`;
}
