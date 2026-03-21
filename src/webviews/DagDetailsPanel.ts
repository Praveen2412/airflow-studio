import * as vscode from 'vscode';
import { DagSummary } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

export class DagDetailsPanel {
  private static panels = new Map<string, DagDetailsPanel>();
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private dagDetails: any;

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

    this.panel.webview.onDidReceiveMessage(message => this.handleMessage(message), null, this.disposables);
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
          await client.triggerDagRun(this.dagId, message.conf || undefined);
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
          vscode.window.showInformationMessage(`Task ${message.taskId} set to ${message.state}`);
          this.loadTasks(message.dagRunId);
          break;
        case 'setDagRunState':
          await client.setDagRunState(this.dagId, message.dagRunId, message.state);
          vscode.window.showInformationMessage(`DAG run set to ${message.state}`);
          this.loadDagRuns();
          break;
        case 'viewLogs':
          this.loadTaskLogs(message.dagRunId, message.taskId, message.tryNumber || 1);
          break;
        case 'viewSource':
          this.loadDagSource();
          break;
        case 'openInEditor':
          const source = await client.getDagSource(this.dagId);
          const doc = await vscode.workspace.openTextDocument({ content: source, language: 'python' });
          await vscode.window.showTextDocument(doc, { preview: false });
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
      this.panel.webview.postMessage({ command: 'updateDagRuns', runs: [], error: error.message });
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
      this.panel.webview.postMessage({ command: 'updateTasks', tasks: [], dagRunId, error: error.message });
    }
  }

  private async loadTaskLogs(dagRunId: string, taskId: string, tryNumber: number) {
    try {
      const client = await this.serverManager.getClient();
      if (!client) return;
      const logs = await client.getTaskLogs(this.dagId, taskId, dagRunId, tryNumber);
      this.panel.webview.postMessage({ command: 'showLogs', logs, taskId, tryNumber });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadTaskLogs: Failed', error);
      vscode.window.showErrorMessage(`Failed to load logs: ${error.message}`);
    }
  }

  private async loadDagSource() {
    try {
      const client = await this.serverManager.getClient();
      if (!client) return;
      const source = await client.getDagSource(this.dagId);
      this.panel.webview.postMessage({ command: 'showCode', source, dagId: this.dagId });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadDagSource: Failed', error);
      vscode.window.showErrorMessage(`Failed to load DAG source: ${error.message}`);
    }
  }

  private getHtml(dag: DagSummary): string {
    const tasks = this.dagDetails?.tasks || [];
    // Safely pass dag data to JS via JSON
    const dagJson = JSON.stringify({ dagId: dag.dagId, paused: dag.paused });
    const tasksJson = JSON.stringify(tasks.map((t: any) => ({
      task_id: t.task_id || '',
      task_type: t.task_type || t.operator_name || 'Task',
      downstream_task_ids: t.downstream_task_ids || []
    })));

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { padding: 20px; font-family: var(--vscode-font-family); color: var(--vscode-foreground); background: var(--vscode-editor-background); }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 10px; }
    h1 { font-size: 20px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button { padding: 6px 14px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; cursor: pointer; border-radius: 4px; font-size: 13px; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    button.small { padding: 3px 8px; font-size: 12px; }
    button.danger { background: #c0392b; color: white; }
    button.success-btn { background: #27ae60; color: white; }
    .card { background: var(--vscode-sideBar-background); padding: 15px; border-radius: 6px; border: 1px solid var(--vscode-panel-border); margin-bottom: 15px; }
    .card h2 { font-size: 14px; margin-bottom: 10px; }
    .info-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--vscode-panel-border); font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .label { font-weight: 600; color: var(--vscode-descriptionForeground); }
    .badge { display: inline-block; padding: 2px 7px; margin: 2px; background: var(--vscode-badge-background); color: var(--vscode-badge-foreground); border-radius: 10px; font-size: 11px; }
    .status { padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; display: inline-block; }
    .status.active, .status.success { background: #27ae60; color: white; }
    .status.paused, .status.queued { background: #f39c12; color: black; }
    .status.failed { background: #c0392b; color: white; }
    .status.running { background: #2980b9; color: white; }
    .status.none, .status.skipped, .status.upstream_failed, .status.up_for_retry { background: #7f8c8d; color: white; }
    .tabs { display: flex; gap: 5px; margin-bottom: 15px; border-bottom: 2px solid var(--vscode-panel-border); }
    .tab { padding: 8px 18px; background: transparent; border: none; cursor: pointer; border-bottom: 3px solid transparent; color: var(--vscode-foreground); font-size: 13px; margin-bottom: -2px; }
    .tab.active { border-bottom-color: var(--vscode-button-background); font-weight: 600; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); font-size: 13px; }
    th { font-weight: 600; background: var(--vscode-editor-background); }
    tr:hover { background: var(--vscode-list-hoverBackground); }
    .empty { text-align: center; padding: 30px; color: var(--vscode-descriptionForeground); font-size: 13px; }
    .loading { text-align: center; padding: 20px; color: var(--vscode-descriptionForeground); }
    #inlineView { display: none; }
    .toolbar { display: flex; gap: 8px; margin-bottom: 10px; align-items: center; }
    .toolbar h3 { margin: 0; flex: 1; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    pre { background: var(--vscode-terminal-background, #1e1e1e); color: var(--vscode-terminal-foreground, #d4d4d4); padding: 15px; border-radius: 4px; overflow: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all; max-height: 600px; }
    .task-actions { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; }
    select { background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 3px; padding: 3px 6px; font-size: 12px; cursor: pointer; }
  </style>
</head>
<body>
  <div id="mainView">
    <div class="header">
      <h1>&#x1F4CA; ${this.esc(dag.dagId)}</h1>
      <div class="actions">
        <button id="triggerBtn">&#x25B6;&#xFE0F; Trigger</button>
        <button id="pauseBtn" class="secondary">${dag.paused ? '&#x25B6;&#xFE0F; Unpause' : '&#x23F8;&#xFE0F; Pause'}</button>
        <button id="sourceBtn" class="secondary">&#x1F4C4; Source</button>
        <button id="refreshBtn" class="secondary">&#x1F504; Refresh</button>
      </div>
    </div>

    <div class="card">
      <div class="info-row">
        <span class="label">Status</span>
        <span class="status ${dag.paused ? 'paused' : 'active'}">${dag.paused ? 'Paused' : 'Active'}</span>
      </div>
      <div class="info-row">
        <span class="label">Owner</span><span>${this.esc(dag.owner)}</span>
      </div>
      <div class="info-row">
        <span class="label">Schedule</span><span>${this.esc(dag.schedule || 'None')}</span>
      </div>
      <div class="info-row">
        <span class="label">Tags</span>
        <span>${dag.tags.map(t => `<span class="badge">${this.esc(t)}</span>`).join('') || 'None'}</span>
      </div>
    </div>

    <div class="tabs">
      <button class="tab active" id="tab-tasks" onclick="switchTab('tasks', this)">&#x1F4CB; Tasks (${tasks.length})</button>
      <button class="tab" id="tab-runs" onclick="switchTab('runs', this)">&#x1F3C3; DAG Runs</button>
    </div>

    <div id="tasksTab" class="tab-content active">
      <div id="taskStructure"></div>
    </div>

    <div id="runsTab" class="tab-content">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h2>Recent DAG Runs</h2>
          <button class="small" id="loadRunsBtn">&#x1F504; Load Runs</button>
        </div>
        <div id="runsContent" class="loading">Click "Load Runs" to view DAG runs</div>
      </div>
      <div id="tasksCard" class="card" style="display:none;margin-top:10px;">
        <h2 id="tasksCardTitle">Task Instances</h2>
        <div id="tasksContent"></div>
      </div>
    </div>
  </div>

  <div id="inlineView">
    <div class="toolbar">
      <h3 id="inlineTitle"></h3>
      <button class="secondary" id="backBtn">&#x2190; Back</button>
      <button id="openEditorBtn" style="display:none">&#x1F4DD; Open in Editor</button>
    </div>
    <pre id="inlineContent"></pre>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const dag = ${dagJson};
    const taskStructure = ${tasksJson};

    // Render task structure
    (function() {
      const el = document.getElementById('taskStructure');
      if (taskStructure.length === 0) {
        el.innerHTML = '<div class="empty">No task structure available. Go to DAG Runs tab to see task instances.</div>';
        return;
      }
      let html = '<table><thead><tr><th>Task ID</th><th>Type</th><th>Downstream</th></tr></thead><tbody>';
      taskStructure.forEach(function(t) {
        html += '<tr><td>' + escHtml(t.task_id) + '</td><td>' + escHtml(t.task_type) + '</td><td>' + (t.downstream_task_ids.join(', ') || '-') + '</td></tr>';
      });
      html += '</tbody></table>';
      el.innerHTML = html;
    })();

    // Button handlers
    document.getElementById('triggerBtn').addEventListener('click', triggerDag);
    document.getElementById('pauseBtn').addEventListener('click', function() {
      vscode.postMessage({ command: dag.paused ? 'unpause' : 'pause' });
    });
    document.getElementById('sourceBtn').addEventListener('click', function() {
      vscode.postMessage({ command: 'viewSource' });
    });
    document.getElementById('refreshBtn').addEventListener('click', function() {
      vscode.postMessage({ command: 'refresh' });
    });
    document.getElementById('loadRunsBtn').addEventListener('click', loadDagRuns);
    document.getElementById('backBtn').addEventListener('click', goBack);
    document.getElementById('openEditorBtn').addEventListener('click', function() {
      vscode.postMessage({ command: 'openInEditor' });
    });

    window.addEventListener('message', function(event) {
      var msg = event.data;
      if (msg.command === 'updateDagRuns') displayDagRuns(msg.runs, msg.error);
      else if (msg.command === 'updateTasks') displayTasks(msg.tasks, msg.dagRunId, msg.error);
      else if (msg.command === 'showLogs') showInline('Logs: ' + msg.taskId + ' (try ' + msg.tryNumber + ')', msg.logs, false);
      else if (msg.command === 'showCode') showInline('Source: ' + msg.dagId, msg.source, true);
    });

    function switchTab(tab, btn) {
      document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
      document.querySelectorAll('.tab-content').forEach(function(c) { c.classList.remove('active'); });
      btn.classList.add('active');
      document.getElementById(tab + 'Tab').classList.add('active');
    }

    function showInline(title, content, showEditorBtn) {
      document.getElementById('mainView').style.display = 'none';
      document.getElementById('inlineView').style.display = 'block';
      document.getElementById('inlineTitle').textContent = title;
      document.getElementById('inlineContent').textContent = content || '(empty)';
      document.getElementById('openEditorBtn').style.display = showEditorBtn ? 'inline-block' : 'none';
    }

    function goBack() {
      document.getElementById('inlineView').style.display = 'none';
      document.getElementById('mainView').style.display = 'block';
    }

    function loadDagRuns() {
      document.getElementById('runsContent').innerHTML = '<div class="loading">Loading...</div>';
      vscode.postMessage({ command: 'loadDagRuns' });
    }

    function displayDagRuns(runs, error) {
      if (error) { document.getElementById('runsContent').innerHTML = '<div class="empty">Error: ' + escHtml(error) + '</div>'; return; }
      if (!runs || runs.length === 0) { document.getElementById('runsContent').innerHTML = '<div class="empty">No DAG runs found</div>'; return; }
      var html = '<table><thead><tr><th>Run ID</th><th>State</th><th>Execution Date</th><th>Duration</th><th>Actions</th></tr></thead><tbody>';
      runs.forEach(function(run) {
        var dur = (run.endDate && run.startDate) ? Math.round((new Date(run.endDate) - new Date(run.startDate)) / 1000) + 's' : '-';
        html += '<tr>'
          + '<td>' + escHtml(run.dagRunId) + '</td>'
          + '<td><span class="status ' + escHtml(run.state) + '">' + escHtml(run.state) + '</span></td>'
          + '<td>' + new Date(run.executionDate).toLocaleString() + '</td>'
          + '<td>' + dur + '</td>'
          + '<td class="task-actions">'
          + '<button class="small" data-run-id="' + escAttr(run.dagRunId) + '" data-action="load-tasks">Tasks</button>'
          + '<button class="small success-btn" data-run-id="' + escAttr(run.dagRunId) + '" data-action="run-success">&#x2705;</button>'
          + '<button class="small danger" data-run-id="' + escAttr(run.dagRunId) + '" data-action="run-failed">&#x274C;</button>'
          + '</td></tr>';
      });
      html += '</tbody></table>';
      document.getElementById('runsContent').innerHTML = html;
    }

    function displayTasks(tasks, dagRunId, error) {
      if (error) { document.getElementById('tasksContent').innerHTML = '<div class="empty">Error: ' + escHtml(error) + '</div>'; return; }
      if (!tasks || tasks.length === 0) { document.getElementById('tasksContent').innerHTML = '<div class="empty">No tasks found</div>'; return; }
      var html = '<table><thead><tr><th>Task ID</th><th>State</th><th>Try</th><th>Duration</th><th>Actions</th></tr></thead><tbody>';
      tasks.forEach(function(task) {
        var state = task.state || 'none';
        var dur = task.duration ? task.duration.toFixed(2) + 's' : '-';
        html += '<tr>'
          + '<td>' + escHtml(task.taskId) + '</td>'
          + '<td><span class="status ' + escHtml(state) + '">' + escHtml(state) + '</span></td>'
          + '<td>' + task.tryNumber + '</td>'
          + '<td>' + dur + '</td>'
          + '<td class="task-actions">'
          + '<button class="small" data-run-id="' + escAttr(dagRunId) + '" data-task-id="' + escAttr(task.taskId) + '" data-try="' + task.tryNumber + '" data-action="view-logs">&#x1F4C4; Logs</button>'
          + '<button class="small secondary" data-run-id="' + escAttr(dagRunId) + '" data-task-id="' + escAttr(task.taskId) + '" data-action="clear-task">&#x1F504; Clear</button>'
          + '<select data-run-id="' + escAttr(dagRunId) + '" data-task-id="' + escAttr(task.taskId) + '" data-action="set-task-state">'
          + '<option value="">Set state...</option>'
          + '<option value="success">&#x2705; Success</option>'
          + '<option value="failed">&#x274C; Failed</option>'
          + '<option value="skipped">&#x23ED;&#xFE0F; Skipped</option>'
          + '</select>'
          + '</td></tr>';
      });
      html += '</tbody></table>';
      document.getElementById('tasksContent').innerHTML = html;
    }

    // Delegated event handler for dynamically created buttons
    document.addEventListener('click', function(e) {
      var btn = e.target.closest('[data-action]');
      if (!btn || btn.tagName === 'SELECT') return;
      var action = btn.dataset.action;
      var runId = btn.dataset.runId;
      var taskId = btn.dataset.taskId;
      if (action === 'load-tasks') {
        document.getElementById('tasksCard').style.display = 'block';
        document.getElementById('tasksCardTitle').textContent = 'Tasks: ' + runId;
        document.getElementById('tasksContent').innerHTML = '<div class="loading">Loading...</div>';
        vscode.postMessage({ command: 'loadTasks', dagRunId: runId });
      } else if (action === 'run-success') {
        if (confirm('Mark DAG run as success?')) vscode.postMessage({ command: 'setDagRunState', dagRunId: runId, state: 'success' });
      } else if (action === 'run-failed') {
        if (confirm('Mark DAG run as failed?')) vscode.postMessage({ command: 'setDagRunState', dagRunId: runId, state: 'failed' });
      } else if (action === 'view-logs') {
        vscode.postMessage({ command: 'viewLogs', dagRunId: runId, taskId: taskId, tryNumber: parseInt(btn.dataset.try) });
      } else if (action === 'clear-task') {
        if (confirm('Clear task ' + taskId + '?')) vscode.postMessage({ command: 'clearTask', dagRunId: runId, taskId: taskId });
      }
    });

    document.addEventListener('change', function(e) {
      var sel = e.target.closest('select[data-action="set-task-state"]');
      if (!sel || !sel.value) return;
      var state = sel.value;
      var runId = sel.dataset.runId;
      var taskId = sel.dataset.taskId;
      if (confirm('Set task ' + taskId + ' to ' + state + '?')) {
        vscode.postMessage({ command: 'setTaskState', dagRunId: runId, taskId: taskId, state: state });
      }
      sel.value = '';
    });

    function triggerDag() {
      var conf = prompt('Enter configuration JSON (optional, leave empty to trigger without config):');
      if (conf === null) return;
      var parsed = undefined;
      if (conf.trim()) {
        try { parsed = JSON.parse(conf); } catch(e) { alert('Invalid JSON'); return; }
      }
      vscode.postMessage({ command: 'trigger', conf: parsed });
    }

    function escHtml(str) {
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }
    function escAttr(str) {
      return String(str).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }
  </script>
</body>
</html>`;
  }

  private esc(text: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, m => map[m]);
  }

  private getErrorHtml(message: string): string {
    return `<!DOCTYPE html><html><body style="padding:20px;font-family:var(--vscode-font-family);color:var(--vscode-foreground)"><h2>Error</h2><p>${message}</p></body></html>`;
  }

  private dispose() {
    DagDetailsPanel.panels.delete(this.dagId);
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
