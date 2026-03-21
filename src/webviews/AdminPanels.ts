import * as vscode from 'vscode';
import { Variable, Pool, Connection } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

export class VariablesPanel {
  private static instance?: VariablesPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri) {
    this.panel = vscode.window.createWebviewPanel(
      'airflowVariables',
      'Airflow Variables',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  public static show(serverManager: ServerManager, extensionUri: vscode.Uri) {
    if (VariablesPanel.instance) {
      VariablesPanel.instance.panel.reveal();
      VariablesPanel.instance.update();
      return;
    }
    VariablesPanel.instance = new VariablesPanel(serverManager, extensionUri);
  }

  private async handleMessage(message: any) {
    const client = await this.serverManager.getClient();
    if (!client) return;

    try {
      switch (message.command) {
        case 'create':
        case 'edit':
          await client.upsertVariable(message.key, message.value, message.description);
          vscode.window.showInformationMessage(`Variable ${message.key} saved`);
          this.update();
          break;
        case 'delete':
          await client.deleteVariable(message.key);
          vscode.window.showInformationMessage(`Variable ${message.key} deleted`);
          this.update();
          break;
        case 'refresh':
          this.update();
          break;
      }
    } catch (error: any) {
      Logger.error('VariablesPanel.handleMessage: Failed', error);
      vscode.window.showErrorMessage(error.message);
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient();
      if (!client) {
        this.panel.webview.html = this.getErrorHtml('No active server');
        return;
      }

      const variables = await client.listVariables();
      this.panel.webview.html = this.getHtml(variables);
    } catch (error: any) {
      Logger.error('VariablesPanel.update: Failed', error);
      this.panel.webview.html = this.getErrorHtml(error.message);
    }
  }

  private getHtml(variables: Variable[]): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <style>
        body { padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
        button { padding: 8px 16px; margin: 5px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 3px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.small { padding: 4px 8px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
        input, textarea { width: 100%; padding: 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; box-sizing: border-box; }
        label { display: block; margin: 10px 0 5px; font-weight: bold; }
        #formContainer { display: none; margin: 20px 0; padding: 20px; background: var(--vscode-editor-background); border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>Variables</h1>
      <button onclick="showCreateForm()">➕ Create Variable</button>
      <button onclick="refresh()">🔄 Refresh</button>
      
      <div id="formContainer">
        <h3 id="formTitle">Create Variable</h3>
        <input type="hidden" id="editMode" value="false"/>
        <label>Key: <input id="key" type="text"/></label>
        <label>Value: <textarea id="value" rows="4"></textarea></label>
        <label>Description: <input id="description" type="text"/></label>
        <button onclick="saveVariable()">💾 Save</button>
        <button onclick="hideForm()">❌ Cancel</button>
      </div>

      <table>
        <thead>
          <tr><th>Key</th><th>Value</th><th>Description</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${variables.map(v => `
            <tr>
              <td>${this.escapeHtml(v.key)}</td>
              <td title="${this.escapeHtml(v.value)}">${this.escapeHtml(v.value.substring(0, 50))}${v.value.length > 50 ? '...' : ''}</td>
              <td>${this.escapeHtml(v.description || '-')}</td>
              <td>
                <button class="small" onclick='editVariable(${JSON.stringify(v)})'>✏️ Edit</button>
                <button class="small" onclick="deleteVariable('${this.escapeHtml(v.key)}')">🗑️ Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <script>
        const vscode = acquireVsCodeApi();
        function showCreateForm() {
          document.getElementById('formTitle').textContent = 'Create Variable';
          document.getElementById('editMode').value = 'false';
          document.getElementById('key').value = '';
          document.getElementById('key').disabled = false;
          document.getElementById('value').value = '';
          document.getElementById('description').value = '';
          document.getElementById('formContainer').style.display = 'block';
        }
        function editVariable(variable) {
          document.getElementById('formTitle').textContent = 'Edit Variable';
          document.getElementById('editMode').value = 'true';
          document.getElementById('key').value = variable.key;
          document.getElementById('key').disabled = true;
          document.getElementById('value').value = variable.value;
          document.getElementById('description').value = variable.description || '';
          document.getElementById('formContainer').style.display = 'block';
        }
        function hideForm() { document.getElementById('formContainer').style.display = 'none'; }
        function saveVariable() {
          const key = document.getElementById('key').value;
          if (!key) { alert('Key is required'); return; }
          vscode.postMessage({
            command: document.getElementById('editMode').value === 'true' ? 'edit' : 'create',
            key: key,
            value: document.getElementById('value').value,
            description: document.getElementById('description').value
          });
          hideForm();
        }
        function deleteVariable(key) {
          if (confirm('Delete variable ' + key + '?')) {
            vscode.postMessage({ command: 'delete', key });
          }
        }
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
      </script>
    </body>
    </html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html><html><body><h1>Error</h1><p>${message}</p></body></html>`;
  }

  private dispose() {
    VariablesPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

export class PoolsPanel {
  private static instance?: PoolsPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri) {
    this.panel = vscode.window.createWebviewPanel(
      'airflowPools',
      'Airflow Pools',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  public static show(serverManager: ServerManager, extensionUri: vscode.Uri) {
    if (PoolsPanel.instance) {
      PoolsPanel.instance.panel.reveal();
      PoolsPanel.instance.update();
      return;
    }
    PoolsPanel.instance = new PoolsPanel(serverManager, extensionUri);
  }

  private async handleMessage(message: any) {
    const client = await this.serverManager.getClient();
    if (!client) return;

    try {
      switch (message.command) {
        case 'create':
        case 'edit':
          await client.upsertPool(message.name, parseInt(message.slots), message.description);
          vscode.window.showInformationMessage(`Pool ${message.name} saved`);
          this.update();
          break;
        case 'delete':
          await client.deletePool(message.name);
          vscode.window.showInformationMessage(`Pool ${message.name} deleted`);
          this.update();
          break;
        case 'refresh':
          this.update();
          break;
      }
    } catch (error: any) {
      Logger.error('PoolsPanel.handleMessage: Failed', error);
      vscode.window.showErrorMessage(error.message);
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient();
      if (!client) {
        this.panel.webview.html = this.getErrorHtml('No active server');
        return;
      }

      const pools = await client.listPools();
      this.panel.webview.html = this.getHtml(pools);
    } catch (error: any) {
      Logger.error('PoolsPanel.update: Failed', error);
      this.panel.webview.html = this.getErrorHtml(error.message);
    }
  }

  private getHtml(pools: Pool[]): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <style>
        body { padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
        button { padding: 8px 16px; margin: 5px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 3px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.small { padding: 4px 8px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
        input { width: 100%; padding: 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; box-sizing: border-box; }
        label { display: block; margin: 10px 0 5px; font-weight: bold; }
        #formContainer { display: none; margin: 20px 0; padding: 20px; background: var(--vscode-editor-background); border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>Pools</h1>
      <button onclick="showCreateForm()">➕ Create Pool</button>
      <button onclick="refresh()">🔄 Refresh</button>
      
      <div id="formContainer">
        <h3 id="formTitle">Create Pool</h3>
        <input type="hidden" id="editMode" value="false"/>
        <label>Name: <input id="name" type="text"/></label>
        <label>Slots: <input id="slots" type="number" min="1"/></label>
        <label>Description: <input id="description" type="text"/></label>
        <button onclick="savePool()">💾 Save</button>
        <button onclick="hideForm()">❌ Cancel</button>
      </div>

      <table>
        <thead>
          <tr><th>Name</th><th>Slots</th><th>Occupied</th><th>Running</th><th>Queued</th><th>Description</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${pools.map(p => `
            <tr>
              <td>${this.escapeHtml(p.name)}</td>
              <td>${p.slots}</td>
              <td>${p.occupiedSlots}</td>
              <td>${p.runningSlots}</td>
              <td>${p.queuedSlots}</td>
              <td>${this.escapeHtml(p.description || '-')}</td>
              <td>
                <button class="small" onclick='editPool(${JSON.stringify(p)})'>✏️ Edit</button>
                <button class="small" onclick="deletePool('${this.escapeHtml(p.name)}')">🗑️ Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <script>
        const vscode = acquireVsCodeApi();
        function showCreateForm() {
          document.getElementById('formTitle').textContent = 'Create Pool';
          document.getElementById('editMode').value = 'false';
          document.getElementById('name').value = '';
          document.getElementById('name').disabled = false;
          document.getElementById('slots').value = '1';
          document.getElementById('description').value = '';
          document.getElementById('formContainer').style.display = 'block';
        }
        function editPool(pool) {
          document.getElementById('formTitle').textContent = 'Edit Pool';
          document.getElementById('editMode').value = 'true';
          document.getElementById('name').value = pool.name;
          document.getElementById('name').disabled = true;
          document.getElementById('slots').value = pool.slots;
          document.getElementById('description').value = pool.description || '';
          document.getElementById('formContainer').style.display = 'block';
        }
        function hideForm() { document.getElementById('formContainer').style.display = 'none'; }
        function savePool() {
          const name = document.getElementById('name').value;
          if (!name) { alert('Name is required'); return; }
          vscode.postMessage({
            command: document.getElementById('editMode').value === 'true' ? 'edit' : 'create',
            name: name,
            slots: document.getElementById('slots').value,
            description: document.getElementById('description').value
          });
          hideForm();
        }
        function deletePool(name) {
          if (confirm('Delete pool ' + name + '?')) {
            vscode.postMessage({ command: 'delete', name });
          }
        }
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
      </script>
    </body>
    </html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html><html><body><h1>Error</h1><p>${message}</p></body></html>`;
  }

  private dispose() {
    PoolsPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

export class ConnectionsPanel {
  private static instance?: ConnectionsPanel;
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(private serverManager: ServerManager, extensionUri: vscode.Uri) {
    this.panel = vscode.window.createWebviewPanel(
      'airflowConnections',
      'Airflow Connections',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  public static show(serverManager: ServerManager, extensionUri: vscode.Uri) {
    if (ConnectionsPanel.instance) {
      ConnectionsPanel.instance.panel.reveal();
      ConnectionsPanel.instance.update();
      return;
    }
    ConnectionsPanel.instance = new ConnectionsPanel(serverManager, extensionUri);
  }

  private async handleMessage(message: any) {
    const client = await this.serverManager.getClient();
    if (!client) return;

    try {
      switch (message.command) {
        case 'create':
        case 'edit':
          await client.upsertConnection({
            connectionId: message.connectionId,
            connType: message.connType,
            host: message.host,
            schema: message.schema,
            login: message.login,
            port: message.port ? parseInt(message.port) : undefined,
            extra: message.extra
          });
          vscode.window.showInformationMessage(`Connection ${message.connectionId} saved`);
          this.update();
          break;
        case 'delete':
          await client.deleteConnection(message.connectionId);
          vscode.window.showInformationMessage(`Connection ${message.connectionId} deleted`);
          this.update();
          break;
        case 'refresh':
          this.update();
          break;
      }
    } catch (error: any) {
      Logger.error('ConnectionsPanel.handleMessage: Failed', error);
      vscode.window.showErrorMessage(error.message);
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient();
      if (!client) {
        this.panel.webview.html = this.getErrorHtml('No active server');
        return;
      }

      const connections = await client.listConnections();
      this.panel.webview.html = this.getHtml(connections);
    } catch (error: any) {
      Logger.error('ConnectionsPanel.update: Failed', error);
      this.panel.webview.html = this.getErrorHtml(error.message);
    }
  }

  private getHtml(connections: Connection[]): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <style>
        body { padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); }
        button { padding: 8px 16px; margin: 5px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 3px; }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.small { padding: 4px 8px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
        input, textarea { width: 100%; padding: 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; box-sizing: border-box; }
        label { display: block; margin: 10px 0 5px; font-weight: bold; }
        #formContainer { display: none; margin: 20px 0; padding: 20px; background: var(--vscode-editor-background); border-radius: 5px; }
      </style>
    </head>
    <body>
      <h1>Connections</h1>
      <button onclick="showCreateForm()">➕ Create Connection</button>
      <button onclick="refresh()">🔄 Refresh</button>

      <div id="formContainer">
        <h3 id="formTitle">Create Connection</h3>
        <input type="hidden" id="editMode" value="false"/>
        <label>Connection ID: <input id="connectionId" type="text"/></label>
        <label>Type: <input id="connType" type="text" placeholder="e.g., http, postgres, mysql"/></label>
        <label>Host: <input id="host" type="text"/></label>
        <label>Schema: <input id="schema" type="text"/></label>
        <label>Login: <input id="login" type="text"/></label>
        <label>Port: <input id="port" type="number"/></label>
        <label>Extra (JSON): <textarea id="extra" rows="3" placeholder='{"key": "value"}'></textarea></label>
        <button onclick="saveConnection()">💾 Save</button>
        <button onclick="hideForm()">❌ Cancel</button>
      </div>

      <table>
        <thead>
          <tr><th>Connection ID</th><th>Type</th><th>Host</th><th>Schema</th><th>Login</th><th>Port</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${connections.map(c => `
            <tr>
              <td>${this.escapeHtml(c.connectionId)}</td>
              <td>${this.escapeHtml(c.connType)}</td>
              <td>${this.escapeHtml(c.host || '-')}</td>
              <td>${this.escapeHtml(c.schema || '-')}</td>
              <td>${this.escapeHtml(c.login || '-')}</td>
              <td>${c.port || '-'}</td>
              <td>
                <button class="small" onclick='editConnection(${JSON.stringify(c)})'>✏️ Edit</button>
                <button class="small" onclick="deleteConnection('${this.escapeHtml(c.connectionId)}')">🗑️ Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <script>
        const vscode = acquireVsCodeApi();
        function showCreateForm() {
          document.getElementById('formTitle').textContent = 'Create Connection';
          document.getElementById('editMode').value = 'false';
          document.getElementById('connectionId').value = '';
          document.getElementById('connectionId').disabled = false;
          document.getElementById('connType').value = '';
          document.getElementById('host').value = '';
          document.getElementById('schema').value = '';
          document.getElementById('login').value = '';
          document.getElementById('port').value = '';
          document.getElementById('extra').value = '';
          document.getElementById('formContainer').style.display = 'block';
        }
        function editConnection(conn) {
          document.getElementById('formTitle').textContent = 'Edit Connection';
          document.getElementById('editMode').value = 'true';
          document.getElementById('connectionId').value = conn.connectionId;
          document.getElementById('connectionId').disabled = true;
          document.getElementById('connType').value = conn.connType;
          document.getElementById('host').value = conn.host || '';
          document.getElementById('schema').value = conn.schema || '';
          document.getElementById('login').value = conn.login || '';
          document.getElementById('port').value = conn.port || '';
          document.getElementById('extra').value = conn.extra || '';
          document.getElementById('formContainer').style.display = 'block';
        }
        function hideForm() { document.getElementById('formContainer').style.display = 'none'; }
        function saveConnection() {
          const connectionId = document.getElementById('connectionId').value;
          if (!connectionId) { alert('Connection ID is required'); return; }
          vscode.postMessage({
            command: document.getElementById('editMode').value === 'true' ? 'edit' : 'create',
            connectionId: connectionId,
            connType: document.getElementById('connType').value,
            host: document.getElementById('host').value,
            schema: document.getElementById('schema').value,
            login: document.getElementById('login').value,
            port: document.getElementById('port').value,
            extra: document.getElementById('extra').value
          });
          hideForm();
        }
        function deleteConnection(connectionId) {
          if (confirm('Delete connection ' + connectionId + '?')) {
            vscode.postMessage({ command: 'delete', connectionId });
          }
        }
        function refresh() { vscode.postMessage({ command: 'refresh' }); }
      </script>
    </body>
    </html>`;
  }

  private escapeHtml(text: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html><html><body><h1>Error</h1><p>${message}</p></body></html>`;
  }

  private dispose() {
    ConnectionsPanel.instance = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
