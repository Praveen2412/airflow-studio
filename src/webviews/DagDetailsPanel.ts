import * as vscode from 'vscode';
import { DagSummary, DagRun, TaskInstance } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

export class DagDetailsPanel {
  private static panels = new Map<string, DagDetailsPanel>();
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private dagDetails: any;
  private currentView: 'main' | 'code' | 'logs' = 'main';

  private constructor(
    private dagId: string,
    private serverManager: ServerManager,
    extensionUri: vscode.Uri
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'airflowDagDetails',
      `DAG: ${dagId}`,
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

  public static show(dagId: string, serverManager: ServerManager, extensionUri: vscode.Uri) {
    const existing = DagDetailsPanel.panels.get(dagId);
    if (existing) {
      existing.panel.reveal();
      existing.update();
      return;
    }

    const panel = new DagDetailsPanel(dagId, serverManager, extensionUri);
    DagDetailsPanel.panels.set(dagId, panel);
  }

  private async handleMessage(message: any) {
    const client = await this.serverManager.getClient();
    if (!client) return;

    try {
      switch (message.command) {
        case 'trigger':
          const conf = message.conf ? JSON.parse(message.conf) : undefined;
          await client.triggerDagRun(this.dagId, conf);
          vscode.window.showInformationMessage(`DAG ${this.dagId} triggered`);
          setTimeout(() => this.loadDagRuns(), 1000);
          break;
        case 'pause':
          await client.pauseDag(this.dagId, true);
          vscode.window.showInformationMessage(`DAG ${this.dagId} paused`);
          this.update();
          break;
        case 'unpause':
          await client.pauseDag(this.dagId, false);
          vscode.window.showInformationMessage(`DAG ${this.dagId} unpaused`);
          this.update();
          break;
        case 'refresh':
          this.update();
          break;
        case 'loadDagRuns':
          this.loadDagRuns();
          break;
        case 'loadTasks':
          this.loadTasks(message.dagRunId);
          break;
        case 'clearTask':
          await client.clearTaskInstances(this.dagId, message.dagRunId, [message.taskId]);
          vscode.window.showInformationMessage(`Task ${message.taskId} cleared`);
          this.loadTasks(message.dagRunId);
          break;
        case 'setTaskState':
          await client.setTaskInstanceState(this.dagId, message.dagRunId, message.taskId, message.state);
          vscode.window.showInformationMessage(`Task ${message.taskId} marked as ${message.state}`);
          this.loadTasks(message.dagRunId);
          break;
        case 'setDagRunState':
          await client.setDagRunState(this.dagId, message.dagRunId, message.state);
          vscode.window.showInformationMessage(`DAG run ${message.dagRunId} marked as ${message.state}`);
          this.loadDagRuns();
          break;
        case 'viewLogs':
          this.showTaskLogs(message.dagRunId, message.taskId, message.tryNumber || 1);
          break;
        case 'viewSource':
          this.showDagSource();
          break;
        case 'openInEditor':
          if (message.type === 'code') {
            const source = await client.getDagSource(this.dagId);
            const doc = await vscode.workspace.openTextDocument({ content: source, language: 'python' });
            await vscode.window.showTextDocument(doc, { preview: false });
          }
          break;
        case 'goBack':
          this.currentView = 'main';
          this.update();
          break;
      }
    } catch (error: any) {
      Logger.error('DagDetailsPanel.handleMessage: Failed', error, { command: message.command });
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

      const dag = await client.getDag(this.dagId);
      try {
        this.dagDetails = await client.getDagDetails(this.dagId);
      } catch (e) {
        this.dagDetails = null;
      }

      this.panel.webview.html = this.getHtml(dag);
    } catch (error: any) {
      Logger.error('DagDetailsPanel.update: Failed', error, { dagId: this.dagId });
      this.panel.webview.html = this.getErrorHtml(error.message);
    }
  }

  private async loadDagRuns() {
    try {
      const client = await this.serverManager.getClient();
      if (!client) return;

      const runs = await client.listDagRuns(this.dagId, 25);
      this.panel.webview.postMessage({ command: 'updateDagRuns', runs });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadDagRuns: Failed', error);
    }
  }

  private async loadTasks(dagRunId: string) {
    try {
      const client = await this.serverManager.getClient();
      if (!client) return;

      const tasks = await client.listTaskInstances(this.dagId, dagRunId);
      this.panel.webview.postMessage({ command: 'updateTasks', tasks, dagRunId });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadTasks: Failed', error);
    }
  }

  private async showTaskLogs(dagRunId: string, taskId: string, tryNumber: number) {
    try {
      const client = await this.serverManager.getClient();
      if (!client) return;

      const logs = await client.getTaskLogs(this.dagId, taskId, dagRunId, tryNumber);
      this.panel.webview.postMessage({ command: 'showLogs', logs, taskId, tryNumber });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.showTaskLogs: Failed', error);
      vscode.window.showErrorMessage(`Failed to load logs: ${error.message}`);
    }
  }

  private async showDagSource() {
    try {
      const client = await this.serverManager.getClient();
      if (!client) return;

      const source = await client.getDagSource(this.dagId);
      this.panel.webview.postMessage({ command: 'showCode', source });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.showDagSource: Failed', error);
      vscode.window.showErrorMessage(`Failed to load DAG source: ${error.message}`);
    }
  }

  private getHtml(dag: DagSummary): string {
    const tasks = this.dagDetails?.tasks || [];
    return `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { 
          padding: 20px; 
          font-family: var(--vscode-font-family); 
          color: var(--vscode-foreground);
          background: var(--vscode-editor-background);
        }
        .header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 10px;
        }
        h1 { font-size: 24px; margin: 0; }
        .actions { display: flex; gap: 8px; flex-wrap: wrap; }
        button { 
          padding: 8px 16px; 
          background: var(--vscode-button-background); 
          color: var(--vscode-button-foreground); 
          border: none; 
          cursor: pointer; 
          border-radius: 4px;
          font-size: 13px;
        }
        button:hover { background: var(--vscode-button-hoverBackground); }
        button.secondary { 
          background: var(--vscode-button-secondaryBackground); 
          color: var(--vscode-button-secondaryForeground); 
        }
        button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
        button.small { padding: 4px 10px; font-size: 12px; }
        
        .grid { 
          display: grid; 
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
          gap: 15px; 
          margin-bottom: 20px;
        }
        .card { 
          background: var(--vscode-sideBar-background); 
          padding: 15px; 
          border-radius: 6px;
          border: 1px solid var(--vscode-panel-border);
        }
        .card h2 { font-size: 16px; margin-bottom: 12px; color: var(--vscode-foreground); }
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          padding: 6px 0; 
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        .info-row:last-child { border-bottom: none; }
        .label { font-weight: 600; color: var(--vscode-descriptionForeground); }
        .badge { 
          display: inline-block; 
          padding: 3px 8px; 
          margin: 2px; 
          background: var(--vscode-badge-background); 
          color: var(--vscode-badge-foreground); 
          border-radius: 12px; 
          font-size: 11px;
        }
        .status { 
          padding: 4px 10px; 
          border-radius: 4px; 
          font-size: 12px; 
          font-weight: 600;
        }
        .status.active { background: #28a745; color: white; }
        .status.paused { background: #ffc107; color: black; }
        .status.success { background: #28a745; color: white; }
        .status.failed { background: #dc3545; color: white; }
        .status.running { background: #007bff; color: white; }
        .status.queued { background: #6c757d; color: white; }
        
        .tabs { 
          display: flex; 
          gap: 5px; 
          margin-bottom: 15px; 
          border-bottom: 2px solid var(--vscode-panel-border);
        }
        .tab { 
          padding: 10px 20px; 
          background: transparent; 
          border: none; 
          cursor: pointer; 
          border-bottom: 3px solid transparent;
          color: var(--vscode-foreground);
        }
        .tab.active { 
          border-bottom-color: var(--vscode-button-background); 
          font-weight: 600;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        
        table { 
          width: 100%; 
          border-collapse: collapse; 
          background: var(--vscode-sideBar-background);
        }
        th, td { 
          padding: 10px; 
          text-align: left; 
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        th { 
          font-weight: 600; 
          background: var(--vscode-editor-background);
          position: sticky;
          top: 0;
        }
        tr:hover { background: var(--vscode-list-hoverBackground); }
        tr.clickable { cursor: pointer; }
        
        .empty { 
          text-align: center; 
          padding: 40px; 
          color: var(--vscode-descriptionForeground);
        }
        .loading { text-align: center; padding: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 ${this.escapeHtml(dag.dagId)}</h1>
        <div class="actions">
          <button onclick="triggerDag()">▶️ Trigger</button>
          ${dag.paused ? 
            '<button onclick="unpauseDag()">▶️ Unpause</button>' : 
            '<button class="secondary" onclick="pauseDag()">⏸️ Pause</button>'}
          <button class="secondary" onclick="viewSource()">📄 Source</button>
          <button class="secondary" onclick="refresh()">🔄 Refresh</button>
        </div>
      </div>

      <div class="grid">
        <div class="card">
          <h2>DAG Information</h2>
          <div class="info-row">
            <span class="label">Status</span>
            <span class="status ${dag.paused ? 'paused' : 'active'}">${dag.paused ? '⏸️ Paused' : '▶️ Active'}</span>
          </div>
          <div class="info-row">
            <span class="label">Owner</span>
            <span>${this.escapeHtml(dag.owner)}</span>
          </div>
          <div class="info-row">
            <span class="label">Schedule</span>
            <span>${this.escapeHtml(dag.schedule || 'None')}</span>
          </div>
          <div class="info-row">
            <span class="label">Tags</span>
            <span>${dag.tags.map(t => `<span class="badge">${this.escapeHtml(t)}</span>`).join('') || 'None'}</span>
          </div>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active" onclick="switchTab('tasks')">📋 Tasks (${tasks.length})</button>
        <button class="tab" onclick="switchTab('runs')">🏃 DAG Runs</button>
        <button class="tab" onclick="switchTab('code')">💻 Code</button>
      </div>

      <div id="tasksTab" class="tab-content active">
        <div class="card">
          <h2>Task Structure</h2>
          ${tasks.length > 0 ? `
            <table>
              <thead>
                <tr><th>Task ID</th><th>Type</th><th>Depends On</th></tr>
              </thead>
              <tbody>
                ${tasks.map((t: any) => `
                  <tr>
                    <td>${this.escapeHtml(t.task_id)}</td>
                    <td>${this.escapeHtml(t.task_type || t.operator_name || 'Task')}</td>
                    <td>${(t.downstream_task_ids || []).join(', ') || '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : '<div class="empty">No task information available</div>'}
        </div>
      </div>

      <div id="runsTab" class="tab-content">
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
            <h2>Recent DAG Runs</h2>
            <button class="small" onclick="loadDagRuns()">🔄 Load Runs</button>
          </div>
          <div id="runsContent" class="loading">Click "Load Runs" to view DAG runs</div>
        </div>
        <div id="tasksCard" class="card" style="display: none; margin-top: 15px;">
          <h2>Task Instances</h2>
          <div id="tasksContent"></div>
        </div>
      </div>

      <div id="codeTab" class="tab-content">
        <div class="card">
          <h2>DAG Source Code</h2>
          <button onclick="viewSource()">📄 Open in Editor</button>
        </div>
      </div>

      <script>
        const vscode = acquireVsCodeApi();
        let currentDagRunId = null;
        
        window.addEventListener('message', event => {
          const msg = event.data;
          if (msg.command === 'updateDagRuns') {
            displayDagRuns(msg.runs);
          } else if (msg.command === 'updateTasks') {
            displayTasks(msg.tasks, msg.dagRunId);
          }
        });
        
        function switchTab(tab) {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
          event.target.classList.add('active');
          document.getElementById(tab + 'Tab').classList.add('active');
        }
        
        function loadDagRuns() {
          document.getElementById('runsContent').innerHTML = '<div class="loading">Loading...</div>';
          vscode.postMessage({ command: 'loadDagRuns' });
        }
        
        function displayDagRuns(runs) {
          if (!runs || runs.length === 0) {
            document.getElementById('runsContent').innerHTML = '<div class="empty">No DAG runs found</div>';
            return;
          }
          document.getElementById('runsContent').innerHTML = \`
            <table>
              <thead>
                <tr><th>Run ID</th><th>State</th><th>Execution Date</th><th>Duration</th><th>Actions</th></tr>
              </thead>
              <tbody>
                \${runs.map(run => \`
                  <tr class="clickable" onclick="loadTasks('\${run.dagRunId}')">
                    <td>\${run.dagRunId}</td>
                    <td><span class="status \${run.state}">\${run.state}</span></td>
                    <td>\${new Date(run.executionDate).toLocaleString()}</td>
                    <td>\${run.endDate && run.startDate ? 
                      Math.round((new Date(run.endDate) - new Date(run.startDate)) / 1000) + 's' : '-'}</td>
                    <td><button class="small" onclick="event.stopPropagation(); loadTasks('\${run.dagRunId}')">View Tasks</button></td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \`;
        }
        
        function loadTasks(dagRunId) {
          currentDagRunId = dagRunId;
          document.getElementById('tasksCard').style.display = 'block';
          document.getElementById('tasksContent').innerHTML = '<div class="loading">Loading tasks...</div>';
          vscode.postMessage({ command: 'loadTasks', dagRunId });
        }
        
        function displayTasks(tasks, dagRunId) {
          if (!tasks || tasks.length === 0) {
            document.getElementById('tasksContent').innerHTML = '<div class="empty">No tasks found</div>';
            return;
          }
          document.getElementById('tasksContent').innerHTML = \`
            <table>
              <thead>
                <tr><th>Task ID</th><th>State</th><th>Try</th><th>Duration</th><th>Actions</th></tr>
              </thead>
              <tbody>
                \${tasks.map(task => \`
                  <tr>
                    <td>\${task.taskId}</td>
                    <td><span class="status \${task.state || 'none'}">\${task.state || 'none'}</span></td>
                    <td>\${task.tryNumber}</td>
                    <td>\${task.duration ? task.duration.toFixed(2) + 's' : '-'}</td>
                    <td>
                      <button class="small" onclick="viewLogs('\${dagRunId}', '\${task.taskId}', \${task.tryNumber})">📄 Logs</button>
                      <button class="small" onclick="clearTask('\${dagRunId}', '\${task.taskId}')">🔄 Clear</button>
                      <button class="small" onclick="markSuccess('\${dagRunId}', '\${task.taskId}')">✅ Success</button>
                    </td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \`;
        }
        
        function viewLogs(dagRunId, taskId, tryNumber) {
          vscode.postMessage({ command: 'viewLogs', dagRunId, taskId, tryNumber });
        }
        
        function clearTask(dagRunId, taskId) {
          if (confirm('Clear task ' + taskId + '?')) {
            vscode.postMessage({ command: 'clearTask', dagRunId, taskId });
          }
        }
        
        function markSuccess(dagRunId, taskId) {
          if (confirm('Mark task ' + taskId + ' as success?')) {
            vscode.postMessage({ command: 'markSuccess', dagRunId, taskId });
          }
        }
        
        function triggerDag() {
          const conf = prompt('Enter configuration JSON (optional):');
          if (conf !== null) {
            try {
              const parsed = conf ? JSON.parse(conf) : undefined;
              vscode.postMessage({ command: 'trigger', conf: parsed });
            } catch (e) {
              alert('Invalid JSON');
            }
          }
        }
        
        function pauseDag() { vscode.postMessage({ command: 'pause' }); }
        function unpauseDag() { vscode.postMessage({ command: 'unpause' }); }
        function viewSource() { vscode.postMessage({ command: 'viewSource' }); }
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
    return `<!DOCTYPE html>
    <html><body><h1>Error</h1><p>${message}</p></body></html>`;
  }

  private dispose() {
    DagDetailsPanel.panels.delete(this.dagId);
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
