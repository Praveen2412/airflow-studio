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
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg')
    };
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
      authBackend: 'auto',  // Will be auto-detected
      username: data.username || undefined,
      apiMode: data.apiMode || 'auto',
      defaultRefreshInterval: 15,
      lastHealthStatus: 'unknown'
    };

    await this.serverManager.addServer(profile, data.password || undefined);
    vscode.window.showInformationMessage(`Server "${data.name}" added`);
    
    // Trigger full refresh of servers tree and status bar
    await vscode.commands.executeCommand('airflow.refreshServers');
    
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
<h1><svg width="24" height="24" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:8px"><path d="M0 0 C23.55361068 -0.63064041 51.57202413 -1.01442223 70 16 C76.47055993 22.19681071 82.76065103 28.57140339 89 35 C92.5683494 33.5170884 94.50827861 31.54942768 97.0078125 28.6328125 C101.93031186 23.02870528 107.07871355 17.70132995 112.34082031 12.41894531 C113.90108304 10.84875094 115.45037985 9.26819023 117 7.6875 C117.996742 6.68424582 118.99411367 5.68161674 119.9921875 4.6796875 C121.32805908 3.32979736 121.32805908 3.32979736 122.69091797 1.95263672 C125 0 125 0 128 0 C128.63064041 23.55361068 129.01442223 51.57202413 112 70 C105.80318929 76.47055993 99.42859661 82.76065103 93 89 C94.73070423 92.72322423 96.69616566 94.72241042 99.8125 97.4375 C105.64272254 102.64077653 111.2502231 108.06580406 116.79989624 113.56570435 C117.76648837 114.52175931 118.73591746 115.47495455 119.7081604 116.42526245 C121.08886254 117.77600499 122.45871862 119.13780692 123.828125 120.5 C124.6315332 121.2940625 125.43494141 122.088125 126.26269531 122.90625 C128 125 128 125 128 128 C102.80604924 128.63604614 75.97573914 128.50605871 56.32666016 110.55810547 C53.63610592 107.92935795 50.99665856 105.25989536 48.375 102.5625 C47.46621094 101.64017578 46.55742188 100.71785156 45.62109375 99.76757812 C43.40696805 97.51849254 41.20022249 95.26267422 39 93 C35.27677577 94.73070423 33.27758958 96.69616566 30.5625 99.8125 C25.35922347 105.64272254 19.93419594 111.2502231 14.43429565 116.79989624 C13.47824069 117.76648837 12.52504545 118.73591746 11.57473755 119.7081604 C10.22399501 121.08886254 8.86219308 122.45871862 7.5 123.828125 C6.7059375 124.6315332 5.911875 125.43494141 5.09375 126.26269531 C3 128 3 128 0 128 C-0.59575115 104.4021441 -1.07327965 76.49172315 16 58 C22.19681071 51.52944007 28.57140339 45.23934897 35 39 C33.5170884 35.4316506 31.54942768 33.49172139 28.6328125 30.9921875 C23.02870528 26.06968814 17.70132995 20.92128645 12.41894531 15.65917969 C10.84875094 14.09891696 9.26819023 12.54962015 7.6875 11 C6.68424582 10.003258 5.68161674 9.00588633 4.6796875 8.0078125 C3.77976074 7.11723145 2.87983398 6.22665039 1.95263672 5.30908203 C0 3 0 3 0 0 Z" fill="#00AD46"/><path d="M128 0 C128.76236888 28.47350018 127.29010126 53.79475417 107.08984375 75.4140625 C105.38029635 77.15881797 103.66278983 78.89580974 101.9375 80.625 C101.07833984 81.52089844 100.21917969 82.41679688 99.33398438 83.33984375 C92.27328383 90.44908999 92.27328383 90.44908999 88.12109375 91.22265625 C82.97521331 90.85555339 80.55063902 88.59632739 77 85 C66.36189876 72.19677239 66.36189876 72.19677239 65.625 65.6875 C67.60349297 60.38154158 71.12872585 59.20794685 75.984375 56.61328125 C82.25956257 53.25621847 87.25816651 48.70899965 90 42 C89.92652344 41.0615625 89.85304688 40.123125 89.77734375 39.15625 C90.0968677 34.62685783 92.61480205 32.4949803 95.6875 29.4375 C96.29311768 28.81415771 96.89873535 28.19081543 97.52270508 27.54858398 C98.88948223 26.14873012 100.26394883 24.75635773 101.64453125 23.37011719 C103.80308379 21.19814082 105.94282612 19.00898817 108.07707214 16.81315613 C109.96899042 14.86982802 111.86920418 12.93477435 113.7718811 11.00198364 C115.17683653 9.57334323 116.57708632 8.14008019 117.97729492 6.70678711 C118.84459229 5.83546143 119.71188965 4.96413574 120.60546875 4.06640625 C121.38043701 3.28209229 122.15540527 2.49777832 122.95385742 1.68969727 C125 0 125 0 128 0 Z" fill="#00C6D4"/><path d="M0 0 C28.43478862 -0.76133239 53.87761487 0.66912258 75.4140625 20.9453125 C77.1588322 22.66400194 78.89582355 24.39062302 80.625 26.125 C81.52089844 26.99253906 82.41679688 27.86007813 83.33984375 28.75390625 C84.18933594 29.60082031 85.03882812 30.44773437 85.9140625 31.3203125 C86.6767041 32.07586426 87.4393457 32.83141602 88.22509766 33.60986328 C90.34229675 36.46094706 90.75916588 38.4845452 91 42 C87.88404612 50.7952787 78.57772222 57.05698074 70.66796875 61.23046875 C68.75 62.0625 68.75 62.0625 66 63 C61.30383123 59.96130256 59.18946159 56.18089681 56.4609375 51.46484375 C52.94666519 45.53568379 48.49890681 40.65597276 42 38 C41.0615625 38.07347656 40.123125 38.14695313 39.15625 38.22265625 C34.62685783 37.9031323 32.4949803 35.38519795 29.4375 32.3125 C28.81415771 31.70688232 28.19081543 31.10126465 27.54858398 30.47729492 C26.14873012 29.11051777 24.75635773 27.73605117 23.37011719 26.35546875 C21.19814082 24.19691621 19.00898817 22.05717388 16.81315613 19.92292786 C14.86982802 18.03100958 12.93477435 16.13079582 11.00198364 14.2281189 C9.57334323 12.82316347 8.14008019 11.42291368 6.70678711 10.02270508 C5.83546143 9.15540771 4.96413574 8.28811035 4.06640625 7.39453125 C3.28209229 6.61956299 2.49777832 5.84459473 1.68969727 5.04614258 C0 3 0 3 0 0 Z" fill="#E43921"/></svg>Add New Server</h1>
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
      <h1><svg width="24" height="24" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:8px"><path d="M0 0 C23.55361068 -0.63064041 51.57202413 -1.01442223 70 16 C76.47055993 22.19681071 82.76065103 28.57140339 89 35 C92.5683494 33.5170884 94.50827861 31.54942768 97.0078125 28.6328125 C101.93031186 23.02870528 107.07871355 17.70132995 112.34082031 12.41894531 C113.90108304 10.84875094 115.45037985 9.26819023 117 7.6875 C117.996742 6.68424582 118.99411367 5.68161674 119.9921875 4.6796875 C121.32805908 3.32979736 121.32805908 3.32979736 122.69091797 1.95263672 C125 0 125 0 128 0 C128.63064041 23.55361068 129.01442223 51.57202413 112 70 C105.80318929 76.47055993 99.42859661 82.76065103 93 89 C94.73070423 92.72322423 96.69616566 94.72241042 99.8125 97.4375 C105.64272254 102.64077653 111.2502231 108.06580406 116.79989624 113.56570435 C117.76648837 114.52175931 118.73591746 115.47495455 119.7081604 116.42526245 C121.08886254 117.77600499 122.45871862 119.13780692 123.828125 120.5 C124.6315332 121.2940625 125.43494141 122.088125 126.26269531 122.90625 C128 125 128 125 128 128 C102.80604924 128.63604614 75.97573914 128.50605871 56.32666016 110.55810547 C53.63610592 107.92935795 50.99665856 105.25989536 48.375 102.5625 C47.46621094 101.64017578 46.55742188 100.71785156 45.62109375 99.76757812 C43.40696805 97.51849254 41.20022249 95.26267422 39 93 C35.27677577 94.73070423 33.27758958 96.69616566 30.5625 99.8125 C25.35922347 105.64272254 19.93419594 111.2502231 14.43429565 116.79989624 C13.47824069 117.76648837 12.52504545 118.73591746 11.57473755 119.7081604 C10.22399501 121.08886254 8.86219308 122.45871862 7.5 123.828125 C6.7059375 124.6315332 5.911875 125.43494141 5.09375 126.26269531 C3 128 3 128 0 128 C-0.59575115 104.4021441 -1.07327965 76.49172315 16 58 C22.19681071 51.52944007 28.57140339 45.23934897 35 39 C33.5170884 35.4316506 31.54942768 33.49172139 28.6328125 30.9921875 C23.02870528 26.06968814 17.70132995 20.92128645 12.41894531 15.65917969 C10.84875094 14.09891696 9.26819023 12.54962015 7.6875 11 C6.68424582 10.003258 5.68161674 9.00588633 4.6796875 8.0078125 C3.77976074 7.11723145 2.87983398 6.22665039 1.95263672 5.30908203 C0 3 0 3 0 0 Z" fill="#00AD46"/><path d="M128 0 C128.76236888 28.47350018 127.29010126 53.79475417 107.08984375 75.4140625 C105.38029635 77.15881797 103.66278983 78.89580974 101.9375 80.625 C101.07833984 81.52089844 100.21917969 82.41679688 99.33398438 83.33984375 C92.27328383 90.44908999 92.27328383 90.44908999 88.12109375 91.22265625 C82.97521331 90.85555339 80.55063902 88.59632739 77 85 C66.36189876 72.19677239 66.36189876 72.19677239 65.625 65.6875 C67.60349297 60.38154158 71.12872585 59.20794685 75.984375 56.61328125 C82.25956257 53.25621847 87.25816651 48.70899965 90 42 C89.92652344 41.0615625 89.85304688 40.123125 89.77734375 39.15625 C90.0968677 34.62685783 92.61480205 32.4949803 95.6875 29.4375 C96.29311768 28.81415771 96.89873535 28.19081543 97.52270508 27.54858398 C98.88948223 26.14873012 100.26394883 24.75635773 101.64453125 23.37011719 C103.80308379 21.19814082 105.94282612 19.00898817 108.07707214 16.81315613 C109.96899042 14.86982802 111.86920418 12.93477435 113.7718811 11.00198364 C115.17683653 9.57334323 116.57708632 8.14008019 117.97729492 6.70678711 C118.84459229 5.83546143 119.71188965 4.96413574 120.60546875 4.06640625 C121.38043701 3.28209229 122.15540527 2.49777832 122.95385742 1.68969727 C125 0 125 0 128 0 Z" fill="#00C6D4"/><path d="M0 0 C28.43478862 -0.76133239 53.87761487 0.66912258 75.4140625 20.9453125 C77.1588322 22.66400194 78.89582355 24.39062302 80.625 26.125 C81.52089844 26.99253906 82.41679688 27.86007813 83.33984375 28.75390625 C84.18933594 29.60082031 85.03882812 30.44773437 85.9140625 31.3203125 C86.6767041 32.07586426 87.4393457 32.83141602 88.22509766 33.60986328 C90.34229675 36.46094706 90.75916588 38.4845452 91 42 C87.88404612 50.7952787 78.57772222 57.05698074 70.66796875 61.23046875 C68.75 62.0625 68.75 62.0625 66 63 C61.30383123 59.96130256 59.18946159 56.18089681 56.4609375 51.46484375 C52.94666519 45.53568379 48.49890681 40.65597276 42 38 C41.0615625 38.07347656 40.123125 38.14695313 39.15625 38.22265625 C34.62685783 37.9031323 32.4949803 35.38519795 29.4375 32.3125 C28.81415771 31.70688232 28.19081543 31.10126465 27.54858398 30.47729492 C26.14873012 29.11051777 24.75635773 27.73605117 23.37011719 26.35546875 C21.19814082 24.19691621 19.00898817 22.05717388 16.81315613 19.92292786 C14.86982802 18.03100958 12.93477435 16.13079582 11.00198364 14.2281189 C9.57334323 12.82316347 8.14008019 11.42291368 6.70678711 10.02270508 C5.83546143 9.15540771 4.96413574 8.28811035 4.06640625 7.39453125 C3.28209229 6.61956299 2.49777832 5.84459473 1.68969727 5.04614258 C0 3 0 3 0 0 Z" fill="#E43921"/></svg>${esc(server.name)}</h1>
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
    ${server.authBackend ? `<div class="info-row"><span class="lbl">Auth Backend</span><span><span class="tag">${esc(server.authBackend)}</span></span></div>` : ''}
  </div>

  <div>
    <button id="btnRefresh">&#x1F504; Refresh</button>
    <button class="secondary" id="btnTest">&#x1F50C; Test Connection</button>
  </div>
</div>

<div id="editMode" style="display:none">
  <h1><svg width="24" height="24" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:8px"><path d="M0 0 C23.55361068 -0.63064041 51.57202413 -1.01442223 70 16 C76.47055993 22.19681071 82.76065103 28.57140339 89 35 C92.5683494 33.5170884 94.50827861 31.54942768 97.0078125 28.6328125 C101.93031186 23.02870528 107.07871355 17.70132995 112.34082031 12.41894531 C113.90108304 10.84875094 115.45037985 9.26819023 117 7.6875 C117.996742 6.68424582 118.99411367 5.68161674 119.9921875 4.6796875 C121.32805908 3.32979736 121.32805908 3.32979736 122.69091797 1.95263672 C125 0 125 0 128 0 C128.63064041 23.55361068 129.01442223 51.57202413 112 70 C105.80318929 76.47055993 99.42859661 82.76065103 93 89 C94.73070423 92.72322423 96.69616566 94.72241042 99.8125 97.4375 C105.64272254 102.64077653 111.2502231 108.06580406 116.79989624 113.56570435 C117.76648837 114.52175931 118.73591746 115.47495455 119.7081604 116.42526245 C121.08886254 117.77600499 122.45871862 119.13780692 123.828125 120.5 C124.6315332 121.2940625 125.43494141 122.088125 126.26269531 122.90625 C128 125 128 125 128 128 C102.80604924 128.63604614 75.97573914 128.50605871 56.32666016 110.55810547 C53.63610592 107.92935795 50.99665856 105.25989536 48.375 102.5625 C47.46621094 101.64017578 46.55742188 100.71785156 45.62109375 99.76757812 C43.40696805 97.51849254 41.20022249 95.26267422 39 93 C35.27677577 94.73070423 33.27758958 96.69616566 30.5625 99.8125 C25.35922347 105.64272254 19.93419594 111.2502231 14.43429565 116.79989624 C13.47824069 117.76648837 12.52504545 118.73591746 11.57473755 119.7081604 C10.22399501 121.08886254 8.86219308 122.45871862 7.5 123.828125 C6.7059375 124.6315332 5.911875 125.43494141 5.09375 126.26269531 C3 128 3 128 0 128 C-0.59575115 104.4021441 -1.07327965 76.49172315 16 58 C22.19681071 51.52944007 28.57140339 45.23934897 35 39 C33.5170884 35.4316506 31.54942768 33.49172139 28.6328125 30.9921875 C23.02870528 26.06968814 17.70132995 20.92128645 12.41894531 15.65917969 C10.84875094 14.09891696 9.26819023 12.54962015 7.6875 11 C6.68424582 10.003258 5.68161674 9.00588633 4.6796875 8.0078125 C3.77976074 7.11723145 2.87983398 6.22665039 1.95263672 5.30908203 C0 3 0 3 0 0 Z" fill="#00AD46"/><path d="M128 0 C128.76236888 28.47350018 127.29010126 53.79475417 107.08984375 75.4140625 C105.38029635 77.15881797 103.66278983 78.89580974 101.9375 80.625 C101.07833984 81.52089844 100.21917969 82.41679688 99.33398438 83.33984375 C92.27328383 90.44908999 92.27328383 90.44908999 88.12109375 91.22265625 C82.97521331 90.85555339 80.55063902 88.59632739 77 85 C66.36189876 72.19677239 66.36189876 72.19677239 65.625 65.6875 C67.60349297 60.38154158 71.12872585 59.20794685 75.984375 56.61328125 C82.25956257 53.25621847 87.25816651 48.70899965 90 42 C89.92652344 41.0615625 89.85304688 40.123125 89.77734375 39.15625 C90.0968677 34.62685783 92.61480205 32.4949803 95.6875 29.4375 C96.29311768 28.81415771 96.89873535 28.19081543 97.52270508 27.54858398 C98.88948223 26.14873012 100.26394883 24.75635773 101.64453125 23.37011719 C103.80308379 21.19814082 105.94282612 19.00898817 108.07707214 16.81315613 C109.96899042 14.86982802 111.86920418 12.93477435 113.7718811 11.00198364 C115.17683653 9.57334323 116.57708632 8.14008019 117.97729492 6.70678711 C118.84459229 5.83546143 119.71188965 4.96413574 120.60546875 4.06640625 C121.38043701 3.28209229 122.15540527 2.49777832 122.95385742 1.68969727 C125 0 125 0 128 0 Z" fill="#00C6D4"/><path d="M0 0 C28.43478862 -0.76133239 53.87761487 0.66912258 75.4140625 20.9453125 C77.1588322 22.66400194 78.89582355 24.39062302 80.625 26.125 C81.52089844 26.99253906 82.41679688 27.86007813 83.33984375 28.75390625 C84.18933594 29.60082031 85.03882812 30.44773437 85.9140625 31.3203125 C86.6767041 32.07586426 87.4393457 32.83141602 88.22509766 33.60986328 C90.34229675 36.46094706 90.75916588 38.4845452 91 42 C87.88404612 50.7952787 78.57772222 57.05698074 70.66796875 61.23046875 C68.75 62.0625 68.75 62.0625 66 63 C61.30383123 59.96130256 59.18946159 56.18089681 56.4609375 51.46484375 C52.94666519 45.53568379 48.49890681 40.65597276 42 38 C41.0615625 38.07347656 40.123125 38.14695313 39.15625 38.22265625 C34.62685783 37.9031323 32.4949803 35.38519795 29.4375 32.3125 C28.81415771 31.70688232 28.19081543 31.10126465 27.54858398 30.47729492 C26.14873012 29.11051777 24.75635773 27.73605117 23.37011719 26.35546875 C21.19814082 24.19691621 19.00898817 22.05717388 16.81315613 19.92292786 C14.86982802 18.03100958 12.93477435 16.13079582 11.00198364 14.2281189 C9.57334323 12.82316347 8.14008019 11.42291368 6.70678711 10.02270508 C5.83546143 9.15540771 4.96413574 8.28811035 4.06640625 7.39453125 C3.28209229 6.61956299 2.49777832 5.84459473 1.68969727 5.04614258 C0 3 0 3 0 0 Z" fill="#E43921"/></svg>Edit Server</h1>
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
h1{font-size:22px;margin-bottom:4px;display:flex;align-items:center}
h1 svg{margin-right:8px}
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
