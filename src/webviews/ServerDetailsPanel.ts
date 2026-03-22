import * as vscode from 'vscode';
import { ServerProfile, HealthStatus } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

export function showAddServerPanel(serverManager: ServerManager, extensionUri: vscode.Uri) {
  ServerDetailsPanel.showNew(serverManager, extensionUri);
}

export class ServerDetailsPanel {
  private static panels = new Map<string, ServerDetailsPanel>();
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    private serverId: string,
    private serverManager: ServerManager,
    private extensionUri: vscode.Uri
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

  static showNew(serverManager: ServerManager, extensionUri: vscode.Uri) {
    const p = new ServerDetailsPanel('__new__', serverManager, extensionUri);
    p.panel.title = 'Add New Server';
  }

  private async handleMessage(msg: any) {
    try {
      Logger.debug('ServerDetailsPanel.handleMessage', msg);
      switch (msg.command) {
        case 'refresh':
          await this.update();
          break;
        case 'testConnection':
          const result = await this.serverManager.testConnection(this.serverId);
          vscode.window.showInformationMessage(result.success ? '✓ Connection successful' : `✗ ${result.message}`);
          break;
        case 'editServer':
          await this.updateServer(msg.data);
          break;
        case 'deleteServer':
          await this.deleteServer();
          break;
        case 'addServer':
          await this.addServer(msg.data);
          break;
      }
    } catch (error: any) {
      Logger.error('ServerDetailsPanel.handleMessage: Failed', error);
      vscode.window.showErrorMessage(error.message);
    }
  }

  private async updateServer(data: any) {
    const servers = await this.serverManager.getServers();
    const server = servers.find(s => s.id === this.serverId);
    if (!server) return;

    const updated: ServerProfile = {
      ...server,
      name: data.name,
      baseUrl: data.baseUrl,
      awsRegion: data.awsRegion || undefined,
      username: data.username || undefined,
      apiMode: data.apiMode as any
    };

    await this.serverManager.updateServer(updated, data.password || undefined);
    vscode.window.showInformationMessage(`Server "${data.name}" updated`);
    this.update();
  }

  private async deleteServer() {
    const servers = await this.serverManager.getServers();
    const server = servers.find(s => s.id === this.serverId);
    if (!server) return;

    await this.serverManager.deleteServer(this.serverId);
    vscode.window.showInformationMessage(`Server "${server.name}" deleted`);
    vscode.commands.executeCommand('airflow.refreshServers');
    this.panel.dispose();
  }

  private async addServer(data: any) {
    const profile: ServerProfile = {
      id: Date.now().toString(),
      name: data.name,
      type: data.type as 'self-hosted' | 'mwaa',
      baseUrl: data.baseUrl,
      awsRegion: data.awsRegion || undefined,
      authType: data.type === 'mwaa' ? 'aws' : 'basic',
      username: data.username || undefined,
      apiMode: data.apiMode || 'auto',
      defaultRefreshInterval: 15,
      lastHealthStatus: 'unknown'
    };

    await this.serverManager.addServer(profile, data.password || undefined);
    vscode.window.showInformationMessage(`Server "${data.name}" added`);
    vscode.commands.executeCommand('airflow.refreshServers');
    
    // Switch to the new server's details
    this.serverId = profile.id;
    this.panel.title = `Server: ${profile.name}`;
    this.update();
  }

  private async update() {
    try {
      const servers = await this.serverManager.getServers();
      const server = servers.find(s => s.id === this.serverId);
      
      // If no server (viewing "add new" mode), show add form
      if (!server) {
        this.panel.webview.html = this.getAddServerHtml();
        return;
      }

      this.panel.title = `Server: ${server.name}`;
      this.panel.webview.html = loadingHtml(server.name);

      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = this.getHtml(server, undefined, undefined, '', 0, 0, 0); return; }

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

  private getAddServerHtml(): string {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${STYLES}
</style></head><body>
<h1>&#x2795; Add New Server</h1>
<div class="card">
  <h2>Server Configuration</h2>
  <label>Server Name</label>
  <input id="fName" type="text" placeholder="My Airflow Server">
  <label>Server Type</label>
  <select id="fType">
    <option value="self-hosted">Self-hosted</option>
    <option value="mwaa">AWS MWAA</option>
  </select>
  <div id="selfHostedFields">
    <label>Base URL</label>
    <input id="fBaseUrl" type="text" placeholder="http://localhost:8080">
    <label>Username (optional)</label>
    <input id="fUsername" type="text">
    <label>Password (optional)</label>
    <input id="fPassword" type="password">
  </div>
  <div id="mwaaFields" style="display:none">
    <label>Environment Name</label>
    <input id="fEnvName" type="text" placeholder="my-mwaa-environment">
    <label>AWS Region</label>
    <input id="fAwsRegion" type="text" value="us-east-1">
  </div>
  <label>API Mode</label>
  <select id="fApiMode">
    <option value="auto">Auto-detect</option>
    <option value="stable-v1">Airflow 2.x (API v1)</option>
    <option value="stable-v2">Airflow 3.x (API v2)</option>
  </select>
  <div class="form-actions">
    <button id="btnAdd">&#x2795; Add Server</button>
    <button class="secondary" id="btnCancel">Cancel</button>
  </div>
</div>
<script>
(function(){
const vscode=acquireVsCodeApi();
document.getElementById('fType').addEventListener('change',function(){
  const isMwaa=this.value==='mwaa';
  document.getElementById('selfHostedFields').style.display=isMwaa?'none':'block';
  document.getElementById('mwaaFields').style.display=isMwaa?'block':'none';
});
document.getElementById('btnAdd').addEventListener('click',function(){
  const name=document.getElementById('fName').value.trim();
  if(!name){alert('Server name is required');return;}
  const type=document.getElementById('fType').value;
  let baseUrl='';
  let awsRegion='';
  let username='';
  let password='';
  if(type==='self-hosted'){
    baseUrl=document.getElementById('fBaseUrl').value.trim();
    if(!baseUrl){alert('Base URL is required');return;}
    username=document.getElementById('fUsername').value.trim();
    password=document.getElementById('fPassword').value;
  }else{
    baseUrl=document.getElementById('fEnvName').value.trim();
    if(!baseUrl){alert('Environment name is required');return;}
    awsRegion=document.getElementById('fAwsRegion').value.trim();
  }
  vscode.postMessage({
    command:'addServer',
    data:{name,type,baseUrl,awsRegion,username,password,apiMode:document.getElementById('fApiMode').value}
  });
});
document.getElementById('btnCancel').addEventListener('click',function(){
  window.close();
});
})();
</script>
</body></html>`;
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

    const serverData = JSON.stringify({
      id: server.id,
      name: server.name,
      type: server.type,
      baseUrl: server.baseUrl,
      awsRegion: server.awsRegion || '',
      username: server.username || '',
      apiMode: server.apiMode
    });

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
${STYLES}
</style></head><body>
<div id="viewMode">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
    <div>
      <h1>${esc(server.name)}</h1>
      <div class="subtitle">${server.type === 'mwaa' ? 'AWS MWAA' : 'Self-hosted Airflow'} &bull; ${esc(server.baseUrl)} &bull; v${esc(version)}</div>
    </div>
    <div style="display:flex;gap:8px">
      <button id="btnEdit">&#x270F;&#xFE0F; Edit</button>
      <button class="danger" id="btnDelete">&#x1F5D1;&#xFE0F; Delete</button>
    </div>
  </div>

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
</div>

<div id="editMode" style="display:none">
  <h1>&#x270F;&#xFE0F; Edit Server</h1>
  <div class="card">
    <h2>Server Configuration</h2>
    <label>Server Name</label>
    <input id="eName" type="text">
    <label>Server Type</label>
    <select id="eType" disabled>
      <option value="self-hosted">Self-hosted</option>
      <option value="mwaa">AWS MWAA</option>
    </select>
    <div id="eSelfHostedFields">
      <label>Base URL</label>
      <input id="eBaseUrl" type="text">
      <label>Username (leave empty to keep current)</label>
      <input id="eUsername" type="text">
      <label>Password (leave empty to keep current)</label>
      <input id="ePassword" type="password" placeholder="••••••••">
    </div>
    <div id="eMwaaFields" style="display:none">
      <label>Environment Name</label>
      <input id="eEnvName" type="text">
      <label>AWS Region</label>
      <input id="eAwsRegion" type="text">
    </div>
    <label>API Mode</label>
    <select id="eApiMode">
      <option value="auto">Auto-detect</option>
      <option value="stable-v1">Airflow 2.x (API v1)</option>
      <option value="stable-v2">Airflow 3.x (API v2)</option>
    </select>
    <div class="form-actions">
      <button id="btnSave">&#x1F4BE; Save Changes</button>
      <button class="secondary" id="btnCancelEdit">Cancel</button>
    </div>
  </div>
</div>

<script>
(function(){
const vscode=acquireVsCodeApi();
const server=${serverData};

document.getElementById('btnRefresh').addEventListener('click',function(){vscode.postMessage({command:'refresh'});});
document.getElementById('btnTest').addEventListener('click',function(){vscode.postMessage({command:'testConnection'});});

document.getElementById('btnEdit').addEventListener('click',function(){
  document.getElementById('viewMode').style.display='none';
  document.getElementById('editMode').style.display='block';
  document.getElementById('eName').value=server.name;
  document.getElementById('eType').value=server.type;
  const isMwaa=server.type==='mwaa';
  document.getElementById('eSelfHostedFields').style.display=isMwaa?'none':'block';
  document.getElementById('eMwaaFields').style.display=isMwaa?'block':'none';
  if(isMwaa){
    document.getElementById('eEnvName').value=server.baseUrl;
    document.getElementById('eAwsRegion').value=server.awsRegion;
  }else{
    document.getElementById('eBaseUrl').value=server.baseUrl;
    document.getElementById('eUsername').value=server.username;
  }
  document.getElementById('eApiMode').value=server.apiMode;
});

document.getElementById('btnCancelEdit').addEventListener('click',function(){
  document.getElementById('editMode').style.display='none';
  document.getElementById('viewMode').style.display='block';
});

document.getElementById('btnSave').addEventListener('click',function(){
  const name=document.getElementById('eName').value.trim();
  if(!name){alert('Server name is required');return;}
  let baseUrl='';
  let awsRegion='';
  let username='';
  let password='';
  if(server.type==='self-hosted'){
    baseUrl=document.getElementById('eBaseUrl').value.trim();
    if(!baseUrl){alert('Base URL is required');return;}
    username=document.getElementById('eUsername').value.trim();
    password=document.getElementById('ePassword').value;
  }else{
    baseUrl=document.getElementById('eEnvName').value.trim();
    if(!baseUrl){alert('Environment name is required');return;}
    awsRegion=document.getElementById('eAwsRegion').value.trim();
  }
  vscode.postMessage({
    command:'editServer',
    data:{name,baseUrl,awsRegion,username,password,apiMode:document.getElementById('eApiMode').value}
  });
  document.getElementById('editMode').style.display='none';
  document.getElementById('viewMode').style.display='block';
});

document.getElementById('btnDelete').addEventListener('click',function(){
  if(confirm('Delete server "'+server.name+'"? This cannot be undone.')){
    vscode.postMessage({command:'deleteServer'});
  }
});
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

const STYLES = `
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
button.danger{background:#c0392b;color:white}
.tag{display:inline-block;padding:2px 8px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:10px;font-size:11px;margin:2px}
.card{background:var(--vscode-sideBar-background);border:1px solid var(--vscode-panel-border);border-radius:6px;padding:16px;margin-bottom:16px}
.card h2{font-size:14px;font-weight:600;margin-bottom:12px}
label{display:block;margin:12px 0 4px;font-weight:600;font-size:13px}
input,select,textarea{width:100%;padding:8px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:3px;font-family:var(--vscode-font-family);font-size:13px}
.form-actions{margin-top:16px;display:flex;gap:8px}
`;

function esc(v: any): string {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function errHtml(msg: string): string {
  return `<!DOCTYPE html><html><body style="padding:20px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)"><h2>Error</h2><p>${esc(msg)}</p></body></html>`;
}
function loadingHtml(name: string): string {
  return `<!DOCTYPE html><html><body style="padding:20px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)"><h2>${esc(name)}</h2><p>Loading...</p></body></html>`;
}
