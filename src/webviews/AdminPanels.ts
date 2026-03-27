import * as vscode from 'vscode';
import { Variable, Pool, Connection } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

const AIRFLOW_ICON = `<svg width="20" height="20" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-right:6px"><path d="M0 0 C23.55361068 -0.63064041 51.57202413 -1.01442223 70 16 C76.47055993 22.19681071 82.76065103 28.57140339 89 35 C92.5683494 33.5170884 94.50827861 31.54942768 97.0078125 28.6328125 C101.93031186 23.02870528 107.07871355 17.70132995 112.34082031 12.41894531 C113.90108304 10.84875094 115.45037985 9.26819023 117 7.6875 C117.996742 6.68424582 118.99411367 5.68161674 119.9921875 4.6796875 C121.32805908 3.32979736 121.32805908 3.32979736 122.69091797 1.95263672 C125 0 125 0 128 0 C128.63064041 23.55361068 129.01442223 51.57202413 112 70 C105.80318929 76.47055993 99.42859661 82.76065103 93 89 C94.73070423 92.72322423 96.69616566 94.72241042 99.8125 97.4375 C105.64272254 102.64077653 111.2502231 108.06580406 116.79989624 113.56570435 C117.76648837 114.52175931 118.73591746 115.47495455 119.7081604 116.42526245 C121.08886254 117.77600499 122.45871862 119.13780692 123.828125 120.5 C124.6315332 121.2940625 125.43494141 122.088125 126.26269531 122.90625 C128 125 128 125 128 128 C102.80604924 128.63604614 75.97573914 128.50605871 56.32666016 110.55810547 C53.63610592 107.92935795 50.99665856 105.25989536 48.375 102.5625 C47.46621094 101.64017578 46.55742188 100.71785156 45.62109375 99.76757812 C43.40696805 97.51849254 41.20022249 95.26267422 39 93 C35.27677577 94.73070423 33.27758958 96.69616566 30.5625 99.8125 C25.35922347 105.64272254 19.93419594 111.2502231 14.43429565 116.79989624 C13.47824069 117.76648837 12.52504545 118.73591746 11.57473755 119.7081604 C10.22399501 121.08886254 8.86219308 122.45871862 7.5 123.828125 C6.7059375 124.6315332 5.911875 125.43494141 5.09375 126.26269531 C3 128 3 128 0 128 C-0.59575115 104.4021441 -1.07327965 76.49172315 16 58 C22.19681071 51.52944007 28.57140339 45.23934897 35 39 C33.5170884 35.4316506 31.54942768 33.49172139 28.6328125 30.9921875 C23.02870528 26.06968814 17.70132995 20.92128645 12.41894531 15.65917969 C10.84875094 14.09891696 9.26819023 12.54962015 7.6875 11 C6.68424582 10.003258 5.68161674 9.00588633 4.6796875 8.0078125 C3.77976074 7.11723145 2.87983398 6.22665039 1.95263672 5.30908203 C0 3 0 3 0 0 Z" fill="#00AD46"/><path d="M128 0 C128.76236888 28.47350018 127.29010126 53.79475417 107.08984375 75.4140625 C105.38029635 77.15881797 103.66278983 78.89580974 101.9375 80.625 C101.07833984 81.52089844 100.21917969 82.41679688 99.33398438 83.33984375 C92.27328383 90.44908999 92.27328383 90.44908999 88.12109375 91.22265625 C82.97521331 90.85555339 80.55063902 88.59632739 77 85 C66.36189876 72.19677239 66.36189876 72.19677239 65.625 65.6875 C67.60349297 60.38154158 71.12872585 59.20794685 75.984375 56.61328125 C82.25956257 53.25621847 87.25816651 48.70899965 90 42 C89.92652344 41.0615625 89.85304688 40.123125 89.77734375 39.15625 C90.0968677 34.62685783 92.61480205 32.4949803 95.6875 29.4375 C96.29311768 28.81415771 96.89873535 28.19081543 97.52270508 27.54858398 C98.88948223 26.14873012 100.26394883 24.75635773 101.64453125 23.37011719 C103.80308379 21.19814082 105.94282612 19.00898817 108.07707214 16.81315613 C109.96899042 14.86982802 111.86920418 12.93477435 113.7718811 11.00198364 C115.17683653 9.57334323 116.57708632 8.14008019 117.97729492 6.70678711 C118.84459229 5.83546143 119.71188965 4.96413574 120.60546875 4.06640625 C121.38043701 3.28209229 122.15540527 2.49777832 122.95385742 1.68969727 C125 0 125 0 128 0 Z" fill="#00C6D4"/><path d="M0 0 C28.43478862 -0.76133239 53.87761487 0.66912258 75.4140625 20.9453125 C77.1588322 22.66400194 78.89582355 24.39062302 80.625 26.125 C81.52089844 26.99253906 82.41679688 27.86007813 83.33984375 28.75390625 C84.18933594 29.60082031 85.03882812 30.44773437 85.9140625 31.3203125 C86.6767041 32.07586426 87.4393457 32.83141602 88.22509766 33.60986328 C90.34229675 36.46094706 90.75916588 38.4845452 91 42 C87.88404612 50.7952787 78.57772222 57.05698074 70.66796875 61.23046875 C68.75 62.0625 68.75 62.0625 66 63 C61.30383123 59.96130256 59.18946159 56.18089681 56.4609375 51.46484375 C52.94666519 45.53568379 48.49890681 40.65597276 42 38 C41.0615625 38.07347656 40.123125 38.14695313 39.15625 38.22265625 C34.62685783 37.9031323 32.4949803 35.38519795 29.4375 32.3125 C28.81415771 31.70688232 28.19081543 31.10126465 27.54858398 30.47729492 C26.14873012 29.11051777 24.75635773 27.73605117 23.37011719 26.35546875 C21.19814082 24.19691621 19.00898817 22.05717388 16.81315613 19.92292786 C14.86982802 18.03100958 12.93477435 16.13079582 11.00198364 14.2281189 C9.57334323 12.82316347 8.14008019 11.42291368 6.70678711 10.02270508 C5.83546143 9.15540771 4.96413574 8.28811035 4.06640625 7.39453125 C3.28209229 6.61956299 2.49777832 5.84459473 1.68969727 5.04614258 C0 3 0 3 0 0 Z" fill="#E43921"/></svg>`;

const STYLES = `
  body{padding:12px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);font-size:12px}
  h2{margin:0 0 10px;font-size:14px;font-weight:600;display:flex;align-items:center}
  button{padding:4px 10px;margin:2px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;cursor:pointer;border-radius:3px;font-size:11px}
  button:hover{background:var(--vscode-button-hoverBackground)}
  button.small{padding:2px 6px;font-size:10px}
  button.danger{background:#c0392b;color:white}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
  th,td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--vscode-panel-border)}
  th{font-weight:600;background:var(--vscode-sideBar-background);font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
  tr:hover{background:var(--vscode-list-hoverBackground)}
  input,textarea{width:100%;padding:5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:3px;box-sizing:border-box;font-family:var(--vscode-font-family);font-size:11px}
  label{display:block;margin:6px 0 3px;font-weight:600;font-size:11px}
  #form{display:none;margin:10px 0;padding:10px;background:var(--vscode-sideBar-background);border-radius:4px;border:1px solid var(--vscode-panel-border)}
  .row{margin-top:8px;display:flex;gap:6px}
`;

function page(title: string, tableHead: string, rows: string, formBody: string, script: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${STYLES}</style></head><body>
<h2>${AIRFLOW_ICON}${title}</h2>
<div style="margin-bottom:8px">
  <button id="btnCreate" title="Create new ${title.toLowerCase().slice(0,-1)}">Create</button>
  <button id="btnRefresh" title="Refresh ${title.toLowerCase()} list">🔄 Refresh</button>
</div>
<div id="form">
  <h3 id="formTitle" style="font-size:12px;margin-bottom:8px">Create</h3>
  <input type="hidden" id="editMode" value="false">
  ${formBody}
  <div class="row">
    <button id="btnSave">💾 Save</button>
    <button id="btnCancel">Cancel</button>
  </div>
</div>
<table>
  <thead>${tableHead}</thead>
  <tbody id="tbody">${rows}</tbody>
</table>
<script>
(function(){
  const vscode = acquireVsCodeApi();
  document.getElementById('btnRefresh').addEventListener('click', function(){ vscode.postMessage({command:'refresh'}); });
  document.getElementById('btnCancel').addEventListener('click', function(){ document.getElementById('form').style.display='none'; });
  ${script}
  window.handleAction = function(btn){
    console.log('[Airflow Studio] Button clicked:', btn.dataset.action, btn.dataset);
    const action = btn.dataset.action;
    if(action === 'delete'){
      if(btn.dataset.key){
        console.log('[Airflow Studio] Sending delete request for variable:', btn.dataset.key);
        vscode.postMessage({command:'delete', key: btn.dataset.key});
      } else if(btn.dataset.name){
        console.log('[Airflow Studio] Sending delete request for pool:', btn.dataset.name);
        vscode.postMessage({command:'delete', name: btn.dataset.name});
      } else if(btn.dataset.id){
        console.log('[Airflow Studio] Sending delete request for connection:', btn.dataset.id);
        vscode.postMessage({command:'delete', connectionId: btn.dataset.id});
      }
    } else if(action === 'edit'){
      console.log('[Airflow Studio] Editing item');
      handleEdit(btn);
    }
  };
  document.addEventListener('click', function(e){
    const btn = e.target.closest('[data-action]');
    if(!btn) return;
    console.log('[Airflow Studio] Click event on button with action:', btn.dataset.action);
    handleAction(btn);
  });
})();
</script>
</body></html>`;
}

function esc(v: any): string {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function attr(v: any): string {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#039;').replace(/\n/g,' ');
}
function errPage(msg: string): string {
  return `<!DOCTYPE html><html><body style="padding:20px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)"><h2>Error</h2><p>${esc(msg)}</p></body></html>`;
}

export class VariablesPanel {
  private static instance?: VariablesPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri, private serverId: string) {
    this.panel = vscode.window.createWebviewPanel('airflowVariables', 'Airflow Variables', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: false });
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg')
    };
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(serverManager: ServerManager, extensionUri: vscode.Uri, serverId: string) {
    if (VariablesPanel.instance) { VariablesPanel.instance.panel.reveal(); VariablesPanel.instance.update(); return; }
    VariablesPanel.instance = new VariablesPanel(serverManager, extensionUri, serverId);
  }

  private async handleMessage(msg: any) {
    console.log('[Airflow Studio] VariablesPanel.handleMessage called', msg);
    Logger.info('VariablesPanel.handleMessage', { command: msg.command, key: msg.key });
    const client = await this.serverManager.getClient(this.serverId);
    if (!client) { 
      console.error('[Airflow Studio] VariablesPanel: No client');
      Logger.error('VariablesPanel: No client'); 
      return; 
    }
    try {
      if (msg.command === 'create' || msg.command === 'edit') {
        console.log('[Airflow Studio] VariablesPanel: Upserting variable', msg.key);
        Logger.info('VariablesPanel: Upserting variable', { key: msg.key });
        await client.upsertVariable(msg.key, msg.value, msg.description);
        vscode.window.showInformationMessage(`Variable "${msg.key}" saved`);
        Logger.info('VariablesPanel: Variable saved', { key: msg.key });
      } else if (msg.command === 'delete') {
        console.log('[Airflow Studio] VariablesPanel: Confirming delete for variable', msg.key);
        const confirm = await vscode.window.showWarningMessage(
          `Delete variable "${msg.key}"?`,
          { modal: true },
          'Delete'
        );
        if (confirm === 'Delete') {
          console.log('[Airflow Studio] VariablesPanel: Deleting variable', msg.key);
          Logger.info('VariablesPanel: Deleting variable', { key: msg.key });
          await client.deleteVariable(msg.key);
          vscode.window.showInformationMessage(`Variable "${msg.key}" deleted`);
          Logger.info('VariablesPanel: Variable deleted', { key: msg.key });
        }
      } else if (msg.command === 'refresh') {
        console.log('[Airflow Studio] VariablesPanel: Refreshing');
        Logger.info('VariablesPanel: Refreshing');
      }
      console.log('[Airflow Studio] VariablesPanel: Calling update()');
      this.update();
    } catch (e: any) {
      console.error('[Airflow Studio] VariablesPanel: Operation failed', e);
      Logger.error('VariablesPanel: Operation failed', e, { command: msg.command, key: msg.key });
      vscode.window.showErrorMessage(e.message);
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = errPage('No active server'); return; }
      const vars = await client.listVariables();
      this.panel.webview.html = this.getHtml(vars);
    } catch (e: any) { this.panel.webview.html = errPage(e.message); }
  }

  private getHtml(vars: Variable[]): string {
    const rows = vars.map(v =>
      `<tr>
        <td>${esc(v.key)}</td>
        <td title="${esc(v.value)}">${esc(v.value.substring(0,60))}${v.value.length>60?'...':''}</td>
        <td>${esc(v.description||'')}</td>
        <td>
          <button class="small" data-action="edit" data-key="${attr(v.key)}" data-value="${attr(v.value)}" data-desc="${attr(v.description||'')}" title="Edit this variable">Edit</button>
          <button class="small danger" data-action="delete" data-key="${attr(v.key)}" title="Delete this variable">Delete</button>
        </td>
      </tr>`).join('');

    const formBody = `
      <label>Key</label><input id="fKey" type="text">
      <label>Value</label><textarea id="fValue" rows="4"></textarea>
      <label>Description</label><input id="fDesc" type="text">`;

    const script = `
      document.getElementById('btnCreate').addEventListener('click', function(){
        document.getElementById('formTitle').textContent = 'Create Variable';
        document.getElementById('editMode').value = 'false';
        document.getElementById('fKey').value = '';
        document.getElementById('fKey').disabled = false;
        document.getElementById('fValue').value = '';
        document.getElementById('fDesc').value = '';
        document.getElementById('form').style.display = 'block';
      });
      document.getElementById('btnSave').addEventListener('click', function(){
        const key = document.getElementById('fKey').value.trim();
        if(!key){ alert('Key is required'); return; }
        vscode.postMessage({
          command: document.getElementById('editMode').value === 'true' ? 'edit' : 'create',
          key: key,
          value: document.getElementById('fValue').value,
          description: document.getElementById('fDesc').value
        });
        document.getElementById('form').style.display = 'none';
      });
      window.handleEdit = function(btn){
        document.getElementById('formTitle').textContent = 'Edit Variable';
        document.getElementById('editMode').value = 'true';
        document.getElementById('fKey').value = btn.dataset.key;
        document.getElementById('fKey').disabled = true;
        document.getElementById('fValue').value = btn.dataset.value;
        document.getElementById('fDesc').value = btn.dataset.desc;
        document.getElementById('form').style.display = 'block';
      };`;

    return page('Variables',
      '<tr><th>Key</th><th>Value</th><th>Description</th><th>Actions</th></tr>',
      rows, formBody, script);
  }

  private dispose() {
    VariablesPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}

export class PoolsPanel {
  private static instance?: PoolsPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri, private serverId: string) {
    this.panel = vscode.window.createWebviewPanel('airflowPools', 'Airflow Pools', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: false });
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg')
    };
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(serverManager: ServerManager, extensionUri: vscode.Uri, serverId: string) {
    if (PoolsPanel.instance) { PoolsPanel.instance.panel.reveal(); PoolsPanel.instance.update(); return; }
    PoolsPanel.instance = new PoolsPanel(serverManager, extensionUri, serverId);
  }

  private async handleMessage(msg: any) {
    console.log('[Airflow Studio] PoolsPanel.handleMessage called', msg);
    Logger.info('PoolsPanel.handleMessage', { command: msg.command, name: msg.name });
    const client = await this.serverManager.getClient(this.serverId);
    if (!client) { 
      console.error('[Airflow Studio] PoolsPanel: No client');
      Logger.error('PoolsPanel: No client'); 
      return; 
    }
    try {
      if (msg.command === 'create' || msg.command === 'edit') {
        console.log('[Airflow Studio] PoolsPanel: Upserting pool', msg.name);
        Logger.info('PoolsPanel: Upserting pool', { name: msg.name, slots: msg.slots });
        await client.upsertPool(msg.name, parseInt(msg.slots), msg.description);
        vscode.window.showInformationMessage(`Pool "${msg.name}" saved`);
        Logger.info('PoolsPanel: Pool saved', { name: msg.name });
      } else if (msg.command === 'delete') {
        console.log('[Airflow Studio] PoolsPanel: Confirming delete for pool', msg.name);
        const confirm = await vscode.window.showWarningMessage(
          `Delete pool "${msg.name}"?`,
          { modal: true },
          'Delete'
        );
        if (confirm === 'Delete') {
          console.log('[Airflow Studio] PoolsPanel: Deleting pool', msg.name);
          Logger.info('PoolsPanel: Deleting pool', { name: msg.name });
          await client.deletePool(msg.name);
          vscode.window.showInformationMessage(`Pool "${msg.name}" deleted`);
          Logger.info('PoolsPanel: Pool deleted', { name: msg.name });
        }
      } else if (msg.command === 'refresh') {
        console.log('[Airflow Studio] PoolsPanel: Refreshing');
        Logger.info('PoolsPanel: Refreshing');
      }
      console.log('[Airflow Studio] PoolsPanel: Calling update()');
      this.update();
    } catch (e: any) {
      console.error('[Airflow Studio] PoolsPanel: Operation failed', e);
      Logger.error('PoolsPanel: Operation failed', e, { command: msg.command, name: msg.name });
      vscode.window.showErrorMessage(e.message);
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = errPage('No active server'); return; }
      const pools = await client.listPools();
      this.panel.webview.html = this.getHtml(pools);
    } catch (e: any) { this.panel.webview.html = errPage(e.message); }
  }

  private getHtml(pools: Pool[]): string {
    const rows = pools.map(p =>
      `<tr>
        <td>${esc(p.name)}</td>
        <td>${p.slots}</td><td>${p.occupiedSlots}</td><td>${p.runningSlots}</td><td>${p.queuedSlots}</td>
        <td>${esc(p.description||'')}</td>
        <td>
          <button class="small" data-action="edit" data-name="${attr(p.name)}" data-slots="${p.slots}" data-desc="${attr(p.description||'')}" title="Edit this pool">Edit</button>
          <button class="small danger" data-action="delete" data-name="${attr(p.name)}" title="Delete this pool">Delete</button>
        </td>
      </tr>`).join('');

    const formBody = `
      <label>Name</label><input id="fName" type="text">
      <label>Slots</label><input id="fSlots" type="number" min="1" value="1">
      <label>Description</label><input id="fDesc" type="text">`;

    const script = `
      document.getElementById('btnCreate').addEventListener('click', function(){
        document.getElementById('formTitle').textContent = 'Create Pool';
        document.getElementById('editMode').value = 'false';
        document.getElementById('fName').value = '';
        document.getElementById('fName').disabled = false;
        document.getElementById('fSlots').value = '1';
        document.getElementById('fDesc').value = '';
        document.getElementById('form').style.display = 'block';
      });
      document.getElementById('btnSave').addEventListener('click', function(){
        const name = document.getElementById('fName').value.trim();
        if(!name){ alert('Name is required'); return; }
        vscode.postMessage({
          command: document.getElementById('editMode').value === 'true' ? 'edit' : 'create',
          name: name,
          slots: document.getElementById('fSlots').value,
          description: document.getElementById('fDesc').value
        });
        document.getElementById('form').style.display = 'none';
      });
      window.handleEdit = function(btn){
        document.getElementById('formTitle').textContent = 'Edit Pool';
        document.getElementById('editMode').value = 'true';
        document.getElementById('fName').value = btn.dataset.name;
        document.getElementById('fName').disabled = true;
        document.getElementById('fSlots').value = btn.dataset.slots;
        document.getElementById('fDesc').value = btn.dataset.desc;
        document.getElementById('form').style.display = 'block';
      };`;

    return page('Pools',
      '<tr><th>Name</th><th>Slots</th><th>Occupied</th><th>Running</th><th>Queued</th><th>Description</th><th>Actions</th></tr>',
      rows, formBody, script);
  }

  private dispose() {
    PoolsPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}

export class ConnectionsPanel {
  private static instance?: ConnectionsPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri, private serverId: string) {
    this.panel = vscode.window.createWebviewPanel('airflowConnections', 'Airflow Connections', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: false });
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg')
    };
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(serverManager: ServerManager, extensionUri: vscode.Uri, serverId: string) {
    if (ConnectionsPanel.instance) { ConnectionsPanel.instance.panel.reveal(); ConnectionsPanel.instance.update(); return; }
    ConnectionsPanel.instance = new ConnectionsPanel(serverManager, extensionUri, serverId);
  }

  private async handleMessage(msg: any) {
    console.log('[Airflow Studio] ConnectionsPanel.handleMessage called', msg);
    Logger.info('ConnectionsPanel.handleMessage', { command: msg.command, connectionId: msg.connectionId });
    const client = await this.serverManager.getClient(this.serverId);
    if (!client) { 
      console.error('[Airflow Studio] ConnectionsPanel: No client');
      Logger.error('ConnectionsPanel: No client'); 
      return; 
    }
    try {
      if (msg.command === 'create' || msg.command === 'edit') {
        console.log('[Airflow Studio] ConnectionsPanel: Upserting connection', msg.connectionId);
        Logger.info('ConnectionsPanel: Upserting connection', { connectionId: msg.connectionId });
        await client.upsertConnection({
          connectionId: msg.connectionId, connType: msg.connType,
          host: msg.host, schema: msg.schema, login: msg.login,
          port: msg.port ? parseInt(msg.port) : undefined, extra: msg.extra
        });
        vscode.window.showInformationMessage(`Connection "${msg.connectionId}" saved`);
        Logger.info('ConnectionsPanel: Connection saved', { connectionId: msg.connectionId });
      } else if (msg.command === 'delete') {
        console.log('[Airflow Studio] ConnectionsPanel: Confirming delete for connection', msg.connectionId);
        const confirm = await vscode.window.showWarningMessage(
          `Delete connection "${msg.connectionId}"?`,
          { modal: true },
          'Delete'
        );
        if (confirm === 'Delete') {
          console.log('[Airflow Studio] ConnectionsPanel: Deleting connection', msg.connectionId);
          Logger.info('ConnectionsPanel: Deleting connection', { connectionId: msg.connectionId });
          await client.deleteConnection(msg.connectionId);
          vscode.window.showInformationMessage(`Connection "${msg.connectionId}" deleted`);
          Logger.info('ConnectionsPanel: Connection deleted', { connectionId: msg.connectionId });
        }
      } else if (msg.command === 'refresh') {
        console.log('[Airflow Studio] ConnectionsPanel: Refreshing');
        Logger.info('ConnectionsPanel: Refreshing');
      }
      console.log('[Airflow Studio] ConnectionsPanel: Calling update()');
      this.update();
    } catch (e: any) {
      console.error('[Airflow Studio] ConnectionsPanel: Operation failed', e);
      Logger.error('ConnectionsPanel: Operation failed', e, { command: msg.command, connectionId: msg.connectionId });
      vscode.window.showErrorMessage(e.message);
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = errPage('No active server'); return; }
      const conns = await client.listConnections();
      this.panel.webview.html = this.getHtml(conns);
    } catch (e: any) { this.panel.webview.html = errPage(e.message); }
  }

  private getHtml(conns: Connection[]): string {
    const rows = conns.map(c =>
      `<tr>
        <td>${esc(c.connectionId)}</td>
        <td>${esc(c.connType)}</td>
        <td>${esc(c.host||'')}</td>
        <td>${esc(c.schema||'')}</td>
        <td>${esc(c.login||'')}</td>
        <td>${c.port||''}</td>
        <td>
          <button class="small" data-action="edit"
            data-id="${attr(c.connectionId)}" data-type="${attr(c.connType)}"
            data-host="${attr(c.host||'')}" data-schema="${attr(c.schema||'')}"
            data-login="${attr(c.login||'')}" data-port="${c.port||''}"
            data-extra="${attr(c.extra||'')}" title="Edit this connection">Edit</button>
          <button class="small danger" data-action="delete" data-id="${attr(c.connectionId)}" title="Delete this connection">Delete</button>
        </td>
      </tr>`).join('');

    const formBody = `
      <label>Connection ID</label><input id="fId" type="text">
      <label>Type</label><input id="fType" type="text" placeholder="e.g. http, postgres">
      <label>Host</label><input id="fHost" type="text">
      <label>Schema</label><input id="fSchema" type="text">
      <label>Login</label><input id="fLogin" type="text">
      <label>Port</label><input id="fPort" type="number">
      <label>Extra (JSON)</label><textarea id="fExtra" rows="3"></textarea>`;

    const script = `
      document.getElementById('btnCreate').addEventListener('click', function(){
        document.getElementById('formTitle').textContent = 'Create Connection';
        document.getElementById('editMode').value = 'false';
        ['fId','fType','fHost','fSchema','fLogin','fPort','fExtra'].forEach(function(id){
          var el = document.getElementById(id);
          el.value = '';
          el.disabled = false;
        });
        document.getElementById('form').style.display = 'block';
      });
      document.getElementById('btnSave').addEventListener('click', function(){
        const id = document.getElementById('fId').value.trim();
        if(!id){ alert('Connection ID is required'); return; }
        vscode.postMessage({
          command: document.getElementById('editMode').value === 'true' ? 'edit' : 'create',
          connectionId: id,
          connType: document.getElementById('fType').value,
          host: document.getElementById('fHost').value,
          schema: document.getElementById('fSchema').value,
          login: document.getElementById('fLogin').value,
          port: document.getElementById('fPort').value,
          extra: document.getElementById('fExtra').value
        });
        document.getElementById('form').style.display = 'none';
      });
      window.handleEdit = function(btn){
        document.getElementById('formTitle').textContent = 'Edit Connection';
        document.getElementById('editMode').value = 'true';
        document.getElementById('fId').value = btn.dataset.id;
        document.getElementById('fId').disabled = true;
        document.getElementById('fType').value = btn.dataset.type;
        document.getElementById('fHost').value = btn.dataset.host;
        document.getElementById('fSchema').value = btn.dataset.schema;
        document.getElementById('fLogin').value = btn.dataset.login;
        document.getElementById('fPort').value = btn.dataset.port;
        document.getElementById('fExtra').value = btn.dataset.extra;
        document.getElementById('form').style.display = 'block';
      };`;

    return page('Connections',
      '<tr><th>ID</th><th>Type</th><th>Host</th><th>Schema</th><th>Login</th><th>Port</th><th>Actions</th></tr>',
      rows, formBody, script);
  }

  private dispose() {
    ConnectionsPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}

export class ConfigPanel {
  private static instance?: ConfigPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri, private serverId: string) {
    this.panel = vscode.window.createWebviewPanel('airflowConfig', 'Airflow Config', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: false });
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg')
    };
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(serverManager: ServerManager, extensionUri: vscode.Uri, serverId: string) {
    if (ConfigPanel.instance) { ConfigPanel.instance.panel.reveal(); ConfigPanel.instance.update(); return; }
    ConfigPanel.instance = new ConfigPanel(serverManager, extensionUri, serverId);
  }

  private async handleMessage(msg: any) {
    if (msg.command === 'refresh') {
      this.update();
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = errPage('No active server'); return; }
      const config = await client.getConfig();
      this.panel.webview.html = this.getHtml(config);
    } catch (e: any) {
      // Handle 403 when config is disabled by admin
      if (e.response?.status === 403 || e.status === 403) {
        this.panel.webview.html = errPage('Configuration endpoint is disabled by your Airflow administrator for security reasons.');
      } else {
        this.panel.webview.html = errPage(e.message);
      }
    }
  }

  private getHtml(config: any): string {
    const configStr = JSON.stringify(config, null, 2);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${STYLES}</style></head><body>
<h2>${AIRFLOW_ICON}Airflow Configuration</h2>
<button id="btnRefresh" title="Refresh configuration">🔄 Refresh</button>
<pre style="background:var(--vscode-terminal-background);color:var(--vscode-terminal-foreground);padding:10px;border-radius:3px;overflow:auto;margin-top:10px">${esc(configStr)}</pre>
<script>
const vscode=acquireVsCodeApi();
document.getElementById('btnRefresh').addEventListener('click',function(){vscode.postMessage({command:'refresh'});});
</script>
</body></html>`;
  }

  private dispose() {
    ConfigPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}

export class PluginsPanel {
  private static instance?: PluginsPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri, private serverId: string) {
    this.panel = vscode.window.createWebviewPanel('airflowPlugins', 'Airflow Plugins', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: false });
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg')
    };
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(serverManager: ServerManager, extensionUri: vscode.Uri, serverId: string) {
    if (PluginsPanel.instance) { PluginsPanel.instance.panel.reveal(); PluginsPanel.instance.update(); return; }
    PluginsPanel.instance = new PluginsPanel(serverManager, extensionUri, serverId);
  }

  private async handleMessage(msg: any) {
    if (msg.command === 'refresh') {
      this.update();
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = errPage('No active server'); return; }
      const plugins = await client.listPlugins();
      this.panel.webview.html = this.getHtml(plugins);
    } catch (e: any) { this.panel.webview.html = errPage(e.message); }
  }

  private getHtml(plugins: any[]): string {
    const rows = plugins.map(p => `<tr><td>${esc(p.name||'N/A')}</td><td>${esc(p.hooks||'N/A')}</td><td>${esc(p.executors||'N/A')}</td><td>${esc(p.macros||'N/A')}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${STYLES}</style></head><body>
<h2>${AIRFLOW_ICON}Plugins (${plugins.length})</h2>
<button id="btnRefresh" title="Refresh plugins list">🔄 Refresh</button>
<table style="margin-top:10px"><thead><tr><th>Name</th><th>Hooks</th><th>Executors</th><th>Macros</th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center">No plugins found</td></tr>'}</tbody></table>
<script>
const vscode=acquireVsCodeApi();
document.getElementById('btnRefresh').addEventListener('click',function(){vscode.postMessage({command:'refresh'});});
</script>
</body></html>`;
  }

  private dispose() {
    PluginsPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}

export class ProvidersPanel {
  private static instance?: ProvidersPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri, private serverId: string) {
    this.panel = vscode.window.createWebviewPanel('airflowProviders', 'Airflow Providers', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: false });
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg')
    };
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(serverManager: ServerManager, extensionUri: vscode.Uri, serverId: string) {
    if (ProvidersPanel.instance) { ProvidersPanel.instance.panel.reveal(); ProvidersPanel.instance.update(); return; }
    ProvidersPanel.instance = new ProvidersPanel(serverManager, extensionUri, serverId);
  }

  private async handleMessage(msg: any) {
    if (msg.command === 'refresh') {
      this.update();
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = errPage('No active server'); return; }
      const providers = await client.listProviders();
      this.panel.webview.html = this.getHtml(providers);
    } catch (e: any) { this.panel.webview.html = errPage(e.message); }
  }

  private getHtml(providers: any[]): string {
    const rows = providers.map(p => `<tr><td>${esc(p.package_name||'N/A')}</td><td>${esc(p.version||'N/A')}</td><td>${esc(p.description||'N/A')}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${STYLES}</style></head><body>
<h2>${AIRFLOW_ICON}Providers (${providers.length})</h2>
<button id="btnRefresh" title="Refresh providers list">🔄 Refresh</button>
<table style="margin-top:10px"><thead><tr><th>Package Name</th><th>Version</th><th>Description</th></tr></thead><tbody>${rows || '<tr><td colspan="3" style="text-align:center">No providers found</td></tr>'}</tbody></table>
<script>
const vscode=acquireVsCodeApi();
document.getElementById('btnRefresh').addEventListener('click',function(){vscode.postMessage({command:'refresh'});});
</script>
</body></html>`;
  }

  private dispose() {
    ProvidersPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}
