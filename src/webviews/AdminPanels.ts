import * as vscode from 'vscode';
import { Variable, Pool, Connection } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

const STYLES = `
  body{padding:12px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);font-size:12px}
  h2{margin:0 0 10px;font-size:14px;font-weight:600}
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
<h2>${title}</h2>
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
        console.log('[Airflow Studio] Deleting variable:', btn.dataset.key);
        if(confirm('Delete variable "' + btn.dataset.key + '"?')){
          console.log('[Airflow Studio] Sending delete message for variable');
          vscode.postMessage({command:'delete', key: btn.dataset.key});
        }
      } else if(btn.dataset.name){
        console.log('[Airflow Studio] Deleting pool:', btn.dataset.name);
        if(confirm('Delete pool "' + btn.dataset.name + '"?')){
          console.log('[Airflow Studio] Sending delete message for pool');
          vscode.postMessage({command:'delete', name: btn.dataset.name});
        }
      } else if(btn.dataset.id){
        console.log('[Airflow Studio] Deleting connection:', btn.dataset.id);
        if(confirm('Delete connection "' + btn.dataset.id + '"?')){
          console.log('[Airflow Studio] Sending delete message for connection');
          vscode.postMessage({command:'delete', connectionId: btn.dataset.id});
        }
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
    this.panel = vscode.window.createWebviewPanel('airflowVariables', 'Airflow Variables', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
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
        console.log('[Airflow Studio] VariablesPanel: Deleting variable', msg.key);
        Logger.info('VariablesPanel: Deleting variable', { key: msg.key });
        await client.deleteVariable(msg.key);
        vscode.window.showInformationMessage(`Variable "${msg.key}" deleted`);
        Logger.info('VariablesPanel: Variable deleted', { key: msg.key });
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
    this.panel = vscode.window.createWebviewPanel('airflowPools', 'Airflow Pools', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
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
        console.log('[Airflow Studio] PoolsPanel: Deleting pool', msg.name);
        Logger.info('PoolsPanel: Deleting pool', { name: msg.name });
        await client.deletePool(msg.name);
        vscode.window.showInformationMessage(`Pool "${msg.name}" deleted`);
        Logger.info('PoolsPanel: Pool deleted', { name: msg.name });
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
    this.panel = vscode.window.createWebviewPanel('airflowConnections', 'Airflow Connections', vscode.ViewColumn.One, { enableScripts: true, retainContextWhenHidden: true });
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
        console.log('[Airflow Studio] ConnectionsPanel: Deleting connection', msg.connectionId);
        Logger.info('ConnectionsPanel: Deleting connection', { connectionId: msg.connectionId });
        await client.deleteConnection(msg.connectionId);
        vscode.window.showInformationMessage(`Connection "${msg.connectionId}" deleted`);
        Logger.info('ConnectionsPanel: Connection deleted', { connectionId: msg.connectionId });
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
