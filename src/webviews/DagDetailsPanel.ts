import * as vscode from 'vscode';
import { DagSummary } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';
import { Constants } from '../utils/constants';

export class DagDetailsPanel {
  private static panels = new Map<string, DagDetailsPanel>();
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private dagDetails: any;

  private constructor(
    private dagId: string,
    private serverManager: ServerManager,
    extensionUri: vscode.Uri,
    private serverId?: string
  ) {
    this.panel = vscode.window.createWebviewPanel(
      'airflowDagDetails', `DAG: ${dagId}`, vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false }
    );
    this.panel.iconPath = {
      light: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg'),
      dark: vscode.Uri.joinPath(extensionUri, 'resources', 'airflow.svg')
    };
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(dagId: string, serverManager: ServerManager, extensionUri: vscode.Uri, serverId?: string) {
    const existing = DagDetailsPanel.panels.get(dagId);
    if (existing) { existing.panel.reveal(); existing.update(); return; }
    const p = new DagDetailsPanel(dagId, serverManager, extensionUri, serverId);
    DagDetailsPanel.panels.set(dagId, p);
  }

  private async handleMessage(msg: any) {
    Logger.info('DagDetailsPanel.handleMessage', { command: msg.command, dagId: this.dagId });
    const client = await this.serverManager.getClient(this.serverId);
    if (!client) { Logger.error('DagDetailsPanel: No client'); return; }
    try {
      switch (msg.command) {
        case 'trigger':
          Logger.info('DagDetailsPanel: Triggering DAG', { dagId: this.dagId, hasConf: !!msg.conf, logicalDate: msg.logicalDate });
          await client.triggerDagRun(this.dagId, msg.conf || undefined, msg.logicalDate || undefined);
          vscode.window.showInformationMessage(`DAG ${this.dagId} triggered`);
          Logger.info('DagDetailsPanel: DAG triggered successfully', { dagId: this.dagId });
          setTimeout(() => this.loadDagRuns(Constants.DEFAULT_DAG_RUN_LIMIT), Constants.TASK_REFRESH_DELAY);
          break;
        case 'pause':
          Logger.info('DagDetailsPanel: Pausing DAG', { dagId: this.dagId });
          await client.pauseDag(this.dagId, true);
          vscode.window.showInformationMessage(`DAG ${this.dagId} paused`);
          Logger.info('DagDetailsPanel: DAG paused successfully', { dagId: this.dagId });
          this.update();
          break;
        case 'unpause':
          Logger.info('DagDetailsPanel: Unpausing DAG', { dagId: this.dagId });
          await client.pauseDag(this.dagId, false);
          vscode.window.showInformationMessage(`DAG ${this.dagId} unpaused`);
          Logger.info('DagDetailsPanel: DAG unpaused successfully', { dagId: this.dagId });
          this.update();
          break;
        case 'refresh':
          Logger.info('DagDetailsPanel: Refreshing', { dagId: this.dagId });
          this.update();
          break;
        case 'loadDagRuns':
          Logger.info('DagDetailsPanel: Loading DAG runs', { dagId: this.dagId, limit: msg.limit });
          this.loadDagRuns(msg.limit || 25);
          break;
        case 'loadTasks':
          Logger.info('DagDetailsPanel: Loading tasks', { dagId: this.dagId, dagRunId: msg.dagRunId });
          this.loadTasks(msg.dagRunId);
          break;
        case 'clearTask':
          Logger.info('DagDetailsPanel: Confirming task clear', { dagId: this.dagId, dagRunId: msg.dagRunId, taskId: msg.taskId });
          const confirmClear = await vscode.window.showWarningMessage(
            `Clear task ${msg.taskId}?`,
            { modal: true },
            'Clear'
          );
          if (confirmClear === 'Clear') {
            Logger.info('DagDetailsPanel: Clearing task', { dagId: this.dagId, dagRunId: msg.dagRunId, taskId: msg.taskId });
            await client.clearTaskInstances(this.dagId, msg.dagRunId, [msg.taskId]);
            vscode.window.showInformationMessage(`Task ${msg.taskId} cleared`);
            Logger.info('DagDetailsPanel: Task cleared successfully', { dagId: this.dagId, taskId: msg.taskId });
            // Refresh tasks after a short delay to allow Airflow to process
            setTimeout(() => this.loadTasks(msg.dagRunId), Constants.TASK_REFRESH_DELAY);
          }
          break;
        case 'setTaskState':
          Logger.info('DagDetailsPanel: Confirming task state change', { dagId: this.dagId, dagRunId: msg.dagRunId, taskId: msg.taskId, state: msg.state });
          const confirmTask = await vscode.window.showWarningMessage(
            `Set task ${msg.taskId} to ${msg.state}?`,
            { modal: true },
            'Confirm'
          );
          if (confirmTask === 'Confirm') {
            Logger.info('DagDetailsPanel: Setting task state', { dagId: this.dagId, dagRunId: msg.dagRunId, taskId: msg.taskId, state: msg.state });
            await client.setTaskInstanceState(this.dagId, msg.dagRunId, msg.taskId, msg.state);
            vscode.window.showInformationMessage(`Task ${msg.taskId} set to ${msg.state}`);
            Logger.info('DagDetailsPanel: Task state set successfully', { dagId: this.dagId, taskId: msg.taskId, state: msg.state });
            // Refresh tasks after a short delay
            setTimeout(() => this.loadTasks(msg.dagRunId), Constants.TASK_REFRESH_DELAY);
          }
          break;
        case 'setDagRunState':
          Logger.info('DagDetailsPanel: Confirming DAG run state change', { dagId: this.dagId, dagRunId: msg.dagRunId, state: msg.state });
          const confirmRun = await vscode.window.showWarningMessage(
            `Mark DAG run as ${msg.state}?`,
            { modal: true },
            'Confirm'
          );
          if (confirmRun === 'Confirm') {
            Logger.info('DagDetailsPanel: Setting DAG run state', { dagId: this.dagId, dagRunId: msg.dagRunId, state: msg.state });
            await client.setDagRunState(this.dagId, msg.dagRunId, msg.state);
            vscode.window.showInformationMessage(`DAG run set to ${msg.state}`);
            Logger.info('DagDetailsPanel: DAG run state set successfully', { dagId: this.dagId, dagRunId: msg.dagRunId, state: msg.state });
            this.loadDagRuns();
          }
          break;
        case 'viewLogs':
          Logger.info('DagDetailsPanel: Viewing logs', { dagId: this.dagId, dagRunId: msg.dagRunId, taskId: msg.taskId, tryNumber: msg.tryNumber });
          this.loadTaskLogs(msg.dagRunId, msg.taskId, msg.tryNumber || 1, msg.maxTries || 1);
          break;
        case 'viewRendered':
          Logger.info('DagDetailsPanel: Viewing rendered template', { dagId: this.dagId, dagRunId: msg.dagRunId, taskId: msg.taskId });
          this.loadRenderedTemplate(msg.dagRunId, msg.taskId);
          break;
        case 'viewSource':
          Logger.info('DagDetailsPanel: Viewing source', { dagId: this.dagId });
          this.loadDagSource();
          break;
        case 'openInEditor':
          Logger.info('DagDetailsPanel: Opening in editor', { dagId: this.dagId });
          const source = await client.getDagSource(this.dagId);
          const doc = await vscode.workspace.openTextDocument({ content: source, language: 'python' });
          await vscode.window.showTextDocument(doc, { preview: false });
          Logger.info('DagDetailsPanel: Opened in editor successfully', { dagId: this.dagId });
          break;
      }
    } catch (error: any) {
      Logger.error('DagDetailsPanel.handleMessage: Failed', error, { command: msg.command, dagId: this.dagId });
      vscode.window.showErrorMessage(error.message);
    }
  }

  private async update() {
    try {
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) { this.panel.webview.html = errHtml('No active server'); return; }
      const dag = await client.getDag(this.dagId);
      try { 
        this.dagDetails = await client.getDagDetails(this.dagId);
        Logger.debug('DagDetailsPanel.update: Got dag details', { tasks: this.dagDetails?.tasks?.length || 0 });
      } catch (e) { 
        Logger.debug('DagDetailsPanel.update: No dag details available', e);
        this.dagDetails = null; 
      }
      this.panel.webview.html = this.getHtml(dag);
      // Always try to load task structure
      setTimeout(() => this.loadTaskStructure(), Constants.WEBVIEW_UPDATE_DELAY);
    } catch (error: any) {
      Logger.error('DagDetailsPanel.update: Failed', error, { dagId: this.dagId });
      this.panel.webview.html = errHtml(error.message);
    }
  }

  private async loadTaskStructure() {
    try {
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) return;
      
      // Priority 1: Use task structure from details API if available
      if (this.dagDetails && this.dagDetails.tasks && this.dagDetails.tasks.length > 0) {
        Logger.debug('DagDetailsPanel.loadTaskStructure: Using task structure from details API', { count: this.dagDetails.tasks.length });
        const taskStructure = this.dagDetails.tasks.map((t: any) => ({
          task_id: t.task_id || t.taskId || '',
          task_type: t.task_type || t.operator_name || t.taskType || 'Task',
          downstream_task_ids: t.downstream_task_ids || t.downstreamTaskIds || []
        }));
        this.panel.webview.postMessage({ command: 'updateTaskStructure', tasks: taskStructure });
      }
      
      // Load DAG runs
      const runs = await client.listDagRuns(this.dagId, Constants.DEFAULT_DAG_RUN_LIMIT);
      this.panel.webview.postMessage({ command: 'updateDagRuns', runs });
      
      // Priority 2: If no task structure from details API, try to load from first run
      if ((!this.dagDetails || !this.dagDetails.tasks || this.dagDetails.tasks.length === 0) && runs.length > 0) {
        Logger.debug('DagDetailsPanel.loadTaskStructure: Loading tasks from first run');
        const firstRun = runs[0];
        const tasks = await client.listTaskInstances(this.dagId, firstRun.dagRunId);
        const taskStructure = tasks.map(t => ({
          task_id: t.taskId,
          task_type: 'Task',
          downstream_task_ids: []
        }));
        this.panel.webview.postMessage({ command: 'updateTaskStructure', tasks: taskStructure });
      }
      
      // If still no task structure, log it
      if ((!this.dagDetails || !this.dagDetails.tasks || this.dagDetails.tasks.length === 0) && runs.length === 0) {
        Logger.debug('DagDetailsPanel.loadTaskStructure: No task structure available - no details API data and no runs');
      }
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadTaskStructure: Failed', error);
      this.panel.webview.postMessage({ command: 'updateDagRuns', runs: [], error: error.message });
    }
  }

  private async loadDagRuns(limit: number = Constants.DEFAULT_DAG_RUN_LIMIT) {
    try {
      Logger.debug('DagDetailsPanel.loadDagRuns: Starting', { dagId: this.dagId, limit });
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) return;
      const runs = await client.listDagRuns(this.dagId, limit);
      Logger.info('DagDetailsPanel.loadDagRuns: Success', { dagId: this.dagId, count: runs.length });
      this.panel.webview.postMessage({ command: 'updateDagRuns', runs });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadDagRuns: Failed', error, { dagId: this.dagId });
      this.panel.webview.postMessage({ command: 'updateDagRuns', runs: [], error: error.message });
    }
  }

  private async loadTasks(dagRunId: string) {
    try {
      Logger.debug('DagDetailsPanel.loadTasks: Starting', { dagId: this.dagId, dagRunId });
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) return;
      const tasks = await client.listTaskInstances(this.dagId, dagRunId);
      Logger.info('DagDetailsPanel.loadTasks: Success', { dagId: this.dagId, dagRunId, count: tasks.length });
      this.panel.webview.postMessage({ command: 'updateTasks', tasks, dagRunId });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadTasks: Failed', error, { dagId: this.dagId, dagRunId });
      this.panel.webview.postMessage({ command: 'updateTasks', tasks: [], dagRunId, error: error.message });
    }
  }

  private async loadTaskLogs(dagRunId: string, taskId: string, tryNumber: number, maxTries: number) {
    try {
      Logger.debug('DagDetailsPanel.loadTaskLogs: Starting', { dagId: this.dagId, dagRunId, taskId, tryNumber });
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) return;
      const logs = await client.getTaskLogs(this.dagId, taskId, dagRunId, tryNumber);
      Logger.info('DagDetailsPanel.loadTaskLogs: Success', { dagId: this.dagId, taskId, tryNumber, logLength: logs.length });
      this.panel.webview.postMessage({ command: 'showLogs', logs, taskId, tryNumber, maxTries, dagRunId });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadTaskLogs: Failed', error, { dagId: this.dagId, taskId, tryNumber });
      vscode.window.showErrorMessage(`Failed to load logs: ${error.message}`);
    }
  }

  private async loadRenderedTemplate(dagRunId: string, taskId: string) {
    try {
      Logger.debug('DagDetailsPanel.loadRenderedTemplate: Starting', { dagId: this.dagId, dagRunId, taskId });
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) return;
      const rendered = await client.getRenderedTemplate(this.dagId, taskId, dagRunId);
      Logger.info('DagDetailsPanel.loadRenderedTemplate: Success', { dagId: this.dagId, taskId });
      const content = JSON.stringify(rendered, null, 2);
      this.panel.webview.postMessage({ command: 'showRendered', content, taskId, dagRunId });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadRenderedTemplate: Failed', error, { dagId: this.dagId, taskId });
      vscode.window.showErrorMessage(`Failed to load rendered template: ${error.message}`);
    }
  }

  private async loadDagSource() {
    try {
      Logger.debug('DagDetailsPanel.loadDagSource: Starting', { dagId: this.dagId });
      const client = await this.serverManager.getClient(this.serverId);
      if (!client) return;
      const source = await client.getDagSource(this.dagId);
      Logger.info('DagDetailsPanel.loadDagSource: Success', { dagId: this.dagId, sourceLength: source.length });
      this.panel.webview.postMessage({ command: 'showCode', source, dagId: this.dagId });
    } catch (error: any) {
      Logger.error('DagDetailsPanel.loadDagSource: Failed', error, { dagId: this.dagId });
      vscode.window.showErrorMessage(`Failed to load DAG source: ${error.message}`);
    }
  }

  private getHtml(dag: DagSummary): string {
    const tasks = this.dagDetails?.tasks || [];
    const taskCount = tasks.length;
    const dagData = JSON.stringify({ dagId: dag.dagId, paused: dag.paused, owner: dag.owner, schedule: dag.schedule, tags: dag.tags });
    const tasksData = JSON.stringify(tasks.map((t: any) => ({
      task_id: t.task_id || t.taskId || '',
      task_type: t.task_type || t.operator_name || t.taskType || 'Task',
      downstream_task_ids: t.downstream_task_ids || t.downstreamTaskIds || []
    })));

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{padding:12px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-editor-background);font-size:12px}
h1{font-size:16px;margin-bottom:10px;font-weight:600;display:flex;align-items:center}
h1 svg{margin-right:6px;flex-shrink:0}
.actions{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
button{padding:4px 10px;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;cursor:pointer;border-radius:3px;font-size:11px;line-height:1.4}
button:hover{background:var(--vscode-button-hoverBackground)}
button.secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
button.secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
button.small{padding:2px 6px;font-size:10px}
button.danger{background:#c0392b;color:white}
button.success-btn{background:#27ae60;color:white}
.card{background:var(--vscode-sideBar-background);padding:10px;border-radius:4px;border:1px solid var(--vscode-panel-border);margin-bottom:10px}
.card h2{font-size:12px;margin-bottom:8px;font-weight:600}
.info-row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--vscode-panel-border);font-size:11px}
.info-row:last-child{border-bottom:none}
.label{font-weight:600;color:var(--vscode-descriptionForeground)}
.badge{display:inline-block;padding:1px 5px;margin:1px;background:var(--vscode-badge-background);color:var(--vscode-badge-foreground);border-radius:8px;font-size:10px}
.status{padding:2px 6px;border-radius:3px;font-size:10px;font-weight:600;display:inline-block}
.status.active,.status.success{background:#27ae60;color:white}
.status.paused,.status.queued{background:#f39c12;color:black}
.status.failed{background:#c0392b;color:white}
.status.running{background:#2980b9;color:white}
.status.none,.status.skipped,.status.upstream_failed,.status.up_for_retry{background:#7f8c8d;color:white}
.tabs{display:flex;gap:4px;margin-bottom:10px;border-bottom:1px solid var(--vscode-panel-border)}
.tab{padding:6px 12px;background:transparent;border:none;cursor:pointer;border-bottom:2px solid transparent;color:var(--vscode-foreground);font-size:11px;margin-bottom:-1px}
.tab.active{border-bottom-color:var(--vscode-button-background);font-weight:600}
.tab-content{display:none}
.tab-content.active{display:block}
table{width:100%;border-collapse:collapse;font-size:11px}
th,td{padding:6px 8px;text-align:left;border-bottom:1px solid var(--vscode-panel-border)}
th{font-weight:600;background:var(--vscode-editor-background);font-size:10px;text-transform:uppercase;letter-spacing:0.5px}
tr:hover{background:var(--vscode-list-hoverBackground)}
.empty{text-align:center;padding:20px;color:var(--vscode-descriptionForeground);font-size:11px}
.loading{text-align:center;padding:15px;color:var(--vscode-descriptionForeground);font-size:11px}
#inlineView{display:none}
.toolbar{display:flex;gap:6px;margin-bottom:8px;align-items:center}
.toolbar h3{margin:0;flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
pre{background:var(--vscode-terminal-background,#1e1e1e);color:var(--vscode-terminal-foreground,#d4d4d4);padding:10px;border-radius:3px;overflow:auto;font-size:11px;white-space:pre-wrap;word-break:break-all;max-height:500px}
.task-actions{display:flex;gap:3px;flex-wrap:wrap;align-items:center}
select{background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:2px;padding:2px 4px;font-size:10px;cursor:pointer}
input,textarea{width:100%;padding:5px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border);border-radius:3px;font-family:var(--vscode-font-family);font-size:11px}
label{display:block;margin:6px 0 3px;font-weight:600;font-size:11px}
#triggerForm{display:none;margin:8px 0;padding:10px;background:var(--vscode-editor-background);border-radius:3px;border:1px solid var(--vscode-panel-border)}
</style></head><body>
<div id="mainView">
  <h1><svg width="20" height="20" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><path d="M0 0 C23.55361068 -0.63064041 51.57202413 -1.01442223 70 16 C76.47055993 22.19681071 82.76065103 28.57140339 89 35 C92.5683494 33.5170884 94.50827861 31.54942768 97.0078125 28.6328125 C101.93031186 23.02870528 107.07871355 17.70132995 112.34082031 12.41894531 C113.90108304 10.84875094 115.45037985 9.26819023 117 7.6875 C117.996742 6.68424582 118.99411367 5.68161674 119.9921875 4.6796875 C121.32805908 3.32979736 121.32805908 3.32979736 122.69091797 1.95263672 C125 0 125 0 128 0 C128.63064041 23.55361068 129.01442223 51.57202413 112 70 C105.80318929 76.47055993 99.42859661 82.76065103 93 89 C94.73070423 92.72322423 96.69616566 94.72241042 99.8125 97.4375 C105.64272254 102.64077653 111.2502231 108.06580406 116.79989624 113.56570435 C117.76648837 114.52175931 118.73591746 115.47495455 119.7081604 116.42526245 C121.08886254 117.77600499 122.45871862 119.13780692 123.828125 120.5 C124.6315332 121.2940625 125.43494141 122.088125 126.26269531 122.90625 C128 125 128 125 128 128 C102.80604924 128.63604614 75.97573914 128.50605871 56.32666016 110.55810547 C53.63610592 107.92935795 50.99665856 105.25989536 48.375 102.5625 C47.46621094 101.64017578 46.55742188 100.71785156 45.62109375 99.76757812 C43.40696805 97.51849254 41.20022249 95.26267422 39 93 C35.27677577 94.73070423 33.27758958 96.69616566 30.5625 99.8125 C25.35922347 105.64272254 19.93419594 111.2502231 14.43429565 116.79989624 C13.47824069 117.76648837 12.52504545 118.73591746 11.57473755 119.7081604 C10.22399501 121.08886254 8.86219308 122.45871862 7.5 123.828125 C6.7059375 124.6315332 5.911875 125.43494141 5.09375 126.26269531 C3 128 3 128 0 128 C-0.59575115 104.4021441 -1.07327965 76.49172315 16 58 C22.19681071 51.52944007 28.57140339 45.23934897 35 39 C33.5170884 35.4316506 31.54942768 33.49172139 28.6328125 30.9921875 C23.02870528 26.06968814 17.70132995 20.92128645 12.41894531 15.65917969 C10.84875094 14.09891696 9.26819023 12.54962015 7.6875 11 C6.68424582 10.003258 5.68161674 9.00588633 4.6796875 8.0078125 C3.77976074 7.11723145 2.87983398 6.22665039 1.95263672 5.30908203 C0 3 0 3 0 0 Z" fill="#00AD46"/><path d="M128 0 C128.76236888 28.47350018 127.29010126 53.79475417 107.08984375 75.4140625 C105.38029635 77.15881797 103.66278983 78.89580974 101.9375 80.625 C101.07833984 81.52089844 100.21917969 82.41679688 99.33398438 83.33984375 C92.27328383 90.44908999 92.27328383 90.44908999 88.12109375 91.22265625 C82.97521331 90.85555339 80.55063902 88.59632739 77 85 C66.36189876 72.19677239 66.36189876 72.19677239 65.625 65.6875 C67.60349297 60.38154158 71.12872585 59.20794685 75.984375 56.61328125 C82.25956257 53.25621847 87.25816651 48.70899965 90 42 C89.92652344 41.0615625 89.85304688 40.123125 89.77734375 39.15625 C90.0968677 34.62685783 92.61480205 32.4949803 95.6875 29.4375 C96.29311768 28.81415771 96.89873535 28.19081543 97.52270508 27.54858398 C98.88948223 26.14873012 100.26394883 24.75635773 101.64453125 23.37011719 C103.80308379 21.19814082 105.94282612 19.00898817 108.07707214 16.81315613 C109.96899042 14.86982802 111.86920418 12.93477435 113.7718811 11.00198364 C115.17683653 9.57334323 116.57708632 8.14008019 117.97729492 6.70678711 C118.84459229 5.83546143 119.71188965 4.96413574 120.60546875 4.06640625 C121.38043701 3.28209229 122.15540527 2.49777832 122.95385742 1.68969727 C125 0 125 0 128 0 Z" fill="#00C6D4"/><path d="M0 0 C28.43478862 -0.76133239 53.87761487 0.66912258 75.4140625 20.9453125 C77.1588322 22.66400194 78.89582355 24.39062302 80.625 26.125 C81.52089844 26.99253906 82.41679688 27.86007813 83.33984375 28.75390625 C84.18933594 29.60082031 85.03882812 30.44773437 85.9140625 31.3203125 C86.6767041 32.07586426 87.4393457 32.83141602 88.22509766 33.60986328 C90.34229675 36.46094706 90.75916588 38.4845452 91 42 C87.88404612 50.7952787 78.57772222 57.05698074 70.66796875 61.23046875 C68.75 62.0625 68.75 62.0625 66 63 C61.30383123 59.96130256 59.18946159 56.18089681 56.4609375 51.46484375 C52.94666519 45.53568379 48.49890681 40.65597276 42 38 C41.0615625 38.07347656 40.123125 38.14695313 39.15625 38.22265625 C34.62685783 37.9031323 32.4949803 35.38519795 29.4375 32.3125 C28.81415771 31.70688232 28.19081543 31.10126465 27.54858398 30.47729492 C26.14873012 29.11051777 24.75635773 27.73605117 23.37011719 26.35546875 C21.19814082 24.19691621 19.00898817 22.05717388 16.81315613 19.92292786 C14.86982802 18.03100958 12.93477435 16.13079582 11.00198364 14.2281189 C9.57334323 12.82316347 8.14008019 11.42291368 6.70678711 10.02270508 C5.83546143 9.15540771 4.96413574 8.28811035 4.06640625 7.39453125 C3.28209229 6.61956299 2.49777832 5.84459473 1.68969727 5.04614258 C0 3 0 3 0 0 Z" fill="#E43921"/></svg>${esc(dag.dagId)}</h1>
  <div class="actions">
    <button id="btnTrigger" title="Trigger DAG with optional configuration">▶ Trigger</button>
    <button id="btnPause" class="secondary" title="${dag.paused?'Resume DAG execution':'Pause DAG execution'}">${dag.paused?'▶ Unpause':'⏸ Pause'}</button>
    <button id="btnSource" class="secondary" title="View DAG source code">📄 Source</button>
    <button id="btnRefresh" class="secondary" title="Refresh DAG details">🔄 Refresh</button>
  </div>
  <div id="triggerForm">
    <label>Logical Date (optional)</label>
    <input type="datetime-local" id="triggerLogicalDate" placeholder="Leave empty for current time">
    <label>Configuration JSON (optional)</label>
    <textarea id="triggerConf" rows="3" placeholder='{"key": "value"}'></textarea>
    <div style="margin-top:8px;display:flex;gap:8px">
      <button id="btnTriggerSubmit">&#x25B6;&#xFE0F; Trigger DAG</button>
      <button id="btnTriggerCancel" class="secondary">Cancel</button>
    </div>
  </div>
  <div class="card">
    <div class="info-row"><span class="label">Status</span><span class="status ${dag.paused?'paused':'active'}">${dag.paused?'Paused':'Active'}</span></div>
    <div class="info-row"><span class="label">Owner</span><span>${esc(dag.owner)}</span></div>
    <div class="info-row"><span class="label">Schedule</span><span>${esc(dag.schedule||'None')}</span></div>
    <div class="info-row"><span class="label">Tags</span><span>${dag.tags.map(t=>`<span class="badge">${esc(t)}</span>`).join('')||'None'}</span></div>
  </div>
  <div class="tabs">
    <button class="tab active" data-tab="tasks" title="View task structure">📋 Tasks (<span id="taskCount">${taskCount}</span>)</button>
    <button class="tab" data-tab="runs" title="View DAG run history">🏃 DAG Runs</button>
  </div>
  <div id="tasksTab" class="tab-content active">
    <div id="taskStructure"></div>
  </div>
  <div id="runsTab" class="tab-content">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2>Recent DAG Runs</h2>
        <div style="display:flex;gap:8px;align-items:center">
          <label style="margin:0;font-size:10px">Limit:</label>
          <select id="runLimit" style="padding:2px 4px;font-size:10px">
            <option value="25" selected>25</option>
            <option value="100">100</option>
            <option value="365">365</option>
          </select>
          <button class="small" id="btnLoadRuns" title="Load recent DAG runs">🔄 Load</button>
        </div>
      </div>
      <div id="runsContent" class="loading">Loading DAG runs...</div>
    </div>
    <div id="tasksCard" class="card" style="display:none;margin-top:10px">
      <h2 id="tasksCardTitle">Task Instances</h2>
      <div id="tasksContent"></div>
    </div>
  </div>
</div>
<div id="inlineView">
  <div class="toolbar">
    <h3 id="inlineTitle"></h3>
    <select id="trySelector" style="display:none;margin-right:8px"></select>
    <button class="secondary" id="btnBack" title="Go back to main view">← Back</button>
    <button id="btnOpenEditor" style="display:none" title="Open source code in editor">📝 Open</button>
  </div>
  <pre id="inlineContent"></pre>
</div>
<script>
(function(){
const vscode=acquireVsCodeApi();
const dag=${dagData};
const taskStructure=${tasksData};
console.log('[Airflow] DAG Details Panel initialized', { dagId: dag.dagId, taskCount: taskStructure.length });
(function(){
  const el=document.getElementById('taskStructure');
  if(taskStructure.length===0){el.innerHTML='<div class="empty">No task structure available. Switch to DAG Runs tab to view task instances.</div>';return;}
  let h='<table><thead><tr><th>Task ID</th><th>Type</th><th>Downstream Tasks</th></tr></thead><tbody>';
  taskStructure.forEach(function(t){h+='<tr><td>'+esc(t.task_id)+'</td><td>'+esc(t.task_type)+'</td><td>'+(t.downstream_task_ids.length>0?t.downstream_task_ids.join(', '):'-')+'</td></tr>';});
  h+='</tbody></table>';
  el.innerHTML=h;
  console.log('[Airflow] Task structure rendered:', taskStructure.length, 'tasks');
})();
document.getElementById('btnTrigger').addEventListener('click',function(){document.getElementById('triggerForm').style.display='block';});
document.getElementById('btnTriggerCancel').addEventListener('click',function(){document.getElementById('triggerForm').style.display='none';});
document.getElementById('btnTriggerSubmit').addEventListener('click',function(){
  const confStr=document.getElementById('triggerConf').value.trim();
  const logicalDateInput=document.getElementById('triggerLogicalDate').value;
  let conf=undefined;
  let logicalDate=undefined;
  if(confStr){try{conf=JSON.parse(confStr);}catch(e){alert('Invalid JSON');return;}}
  if(logicalDateInput){logicalDate=new Date(logicalDateInput).toISOString();}
  vscode.postMessage({command:'trigger',conf:conf,logicalDate:logicalDate});
  document.getElementById('triggerForm').style.display='none';
  document.getElementById('triggerConf').value='';
  document.getElementById('triggerLogicalDate').value='';
  setTimeout(function(){document.querySelectorAll('.tab')[1].click();},500);
});
document.getElementById('btnPause').addEventListener('click',function(){vscode.postMessage({command:dag.paused?'unpause':'pause'});});
document.getElementById('btnSource').addEventListener('click',function(){vscode.postMessage({command:'viewSource'});});
document.getElementById('btnRefresh').addEventListener('click',function(){vscode.postMessage({command:'refresh'});});
document.getElementById('btnLoadRuns').addEventListener('click',function(){
  const limit=parseInt(document.getElementById('runLimit').value)||25;
  document.getElementById('runsContent').innerHTML='<div class="loading">Loading...</div>';
  vscode.postMessage({command:'loadDagRuns',limit:limit});
});
document.getElementById('btnBack').addEventListener('click',function(){
  document.getElementById('inlineView').style.display='none';
  document.getElementById('mainView').style.display='block';
  document.getElementById('trySelector').style.display='none';
});
document.getElementById('trySelector').addEventListener('change',function(e){
  const sel=e.target;
  const tryNum=parseInt(sel.value);
  const dagRunId=sel.dataset.dagRunId;
  const taskId=sel.dataset.taskId;
  const maxTries=parseInt(sel.dataset.maxTries);
  if(tryNum&&dagRunId&&taskId){
    vscode.postMessage({command:'viewLogs',dagRunId:dagRunId,taskId:taskId,tryNumber:tryNum,maxTries:maxTries});
  }
});
document.getElementById('btnOpenEditor').addEventListener('click',function(){vscode.postMessage({command:'openInEditor'});});
document.querySelectorAll('.tab').forEach(function(tab){
  tab.addEventListener('click',function(){
    document.querySelectorAll('.tab').forEach(function(t){t.classList.remove('active');});
    document.querySelectorAll('.tab-content').forEach(function(c){c.classList.remove('active');});
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab+'Tab').classList.add('active');
  });
});
window.addEventListener('message',function(e){
  const msg=e.data;
  console.log('[Airflow] Message received from extension:', msg.command, msg);
  if(msg.command==='updateDagRuns')displayDagRuns(msg.runs,msg.error);
  else if(msg.command==='updateTasks')displayTasks(msg.tasks,msg.dagRunId,msg.error);
  else if(msg.command==='showLogs')showLogs(msg.taskId,msg.logs,msg.tryNumber,msg.maxTries,msg.dagRunId);
  else if(msg.command==='showRendered')showInline('Rendered: '+msg.taskId,msg.content,false);
  else if(msg.command==='showCode')showInline('Source: '+msg.dagId,msg.source,true);
  else if(msg.command==='updateTaskStructure')updateTaskStructure(msg.tasks);
});
function updateTaskStructure(tasks){
  console.log('[Airflow] Updating task structure:', tasks ? tasks.length : 0, 'tasks');
  const el=document.getElementById('taskStructure');
  const countEl=document.getElementById('taskCount');
  if(countEl)countEl.textContent=tasks?tasks.length:'0';
  if(!tasks||tasks.length===0){el.innerHTML='<div class="empty">No task structure available. Switch to DAG Runs tab to view task instances.</div>';return;}
  let h='<table><thead><tr><th>Task ID</th><th>Type</th><th>Downstream Tasks</th></tr></thead><tbody>';
  tasks.forEach(function(t){h+='<tr><td>'+esc(t.task_id)+'</td><td>'+esc(t.task_type)+'</td><td>'+(t.downstream_task_ids&&t.downstream_task_ids.length>0?t.downstream_task_ids.join(', '):'-')+'</td></tr>';});
  h+='</tbody></table>';
  el.innerHTML=h;
  console.log('[Airflow] Task structure updated successfully');
}
function showInline(title,content,showEditor){
  document.getElementById('mainView').style.display='none';
  document.getElementById('inlineView').style.display='block';
  document.getElementById('inlineTitle').textContent=title;
  document.getElementById('inlineContent').textContent=content||'(empty)';
  document.getElementById('btnOpenEditor').style.display=showEditor?'inline-block':'none';
  document.getElementById('trySelector').style.display='none';
}
function showLogs(taskId,logs,tryNumber,maxTries,dagRunId){
  document.getElementById('mainView').style.display='none';
  document.getElementById('inlineView').style.display='block';
  document.getElementById('inlineTitle').textContent='Logs: '+taskId;
  document.getElementById('inlineContent').textContent=logs||'(empty)';
  document.getElementById('btnOpenEditor').style.display='none';
  const sel=document.getElementById('trySelector');
  if(maxTries>1){
    sel.style.display='inline-block';
    sel.innerHTML='';
    for(let i=1;i<=maxTries;i++){
      const opt=document.createElement('option');
      opt.value=i;
      opt.textContent='Try '+i+(i===maxTries?' (latest)':'');
      if(i===tryNumber)opt.selected=true;
      sel.appendChild(opt);
    }
    sel.dataset.dagRunId=dagRunId;
    sel.dataset.taskId=taskId;
    sel.dataset.maxTries=maxTries;
  }else{
    sel.style.display='none';
  }
}
function displayDagRuns(runs,error){
  if(error){document.getElementById('runsContent').innerHTML='<div class="empty">Error: '+esc(error)+'</div>';return;}
  if(!runs||runs.length===0){document.getElementById('runsContent').innerHTML='<div class="empty">No DAG runs found</div>';return;}
  // Sort runs by execution date descending (latest first)
  runs.sort(function(a,b){return new Date(b.executionDate)-new Date(a.executionDate);});
  let h='<table><thead><tr><th>Run ID</th><th>State</th><th>Execution Date</th><th>Duration</th><th>Actions</th></tr></thead><tbody>';
  runs.forEach(function(run){
    const dur=(run.endDate&&run.startDate)?Math.round((new Date(run.endDate)-new Date(run.startDate))/1000)+'s':'-';
    h+='<tr><td>'+esc(run.dagRunId)+'</td><td><span class="status '+esc(run.state)+'">'+esc(run.state)+'</span></td><td>'+new Date(run.executionDate).toLocaleString()+'</td><td>'+dur+'</td><td class="task-actions">'
      +'<button class="small" data-action="load-tasks" data-run-id="'+attr(run.dagRunId)+'" title="View task instances for this run">📋</button>'
      +'<button class="small success-btn" data-action="run-success" data-run-id="'+attr(run.dagRunId)+'" title="Mark run as success">✓</button>'
      +'<button class="small danger" data-action="run-failed" data-run-id="'+attr(run.dagRunId)+'" title="Mark run as failed">✗</button>'
      +'</td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('runsContent').innerHTML=h;
}
function displayTasks(tasks,dagRunId,error){
  if(error){document.getElementById('tasksContent').innerHTML='<div class="empty">Error: '+esc(error)+'</div>';return;}
  if(!tasks||tasks.length===0){document.getElementById('tasksContent').innerHTML='<div class="empty">No tasks found</div>';return;}
  let h='<table><thead><tr><th>Task ID</th><th>State</th><th>Try</th><th>Duration</th><th>Actions</th></tr></thead><tbody>';
  tasks.forEach(function(task){
    const state=task.state||'none';
    const dur=task.duration?task.duration.toFixed(2)+'s':'-';
    h+='<tr><td>'+esc(task.taskId)+'</td><td><span class="status '+esc(state)+'">'+esc(state)+'</span></td><td>'+task.tryNumber+'</td><td>'+dur+'</td><td class="task-actions">'
      +'<button class="small" data-action="view-logs" data-run-id="'+attr(dagRunId)+'" data-task-id="'+attr(task.taskId)+'" data-try="'+task.tryNumber+'" data-max-tries="'+task.tryNumber+'" title="View task logs">📄</button>'
      +'<button class="small" data-action="view-rendered" data-run-id="'+attr(dagRunId)+'" data-task-id="'+attr(task.taskId)+'" title="View rendered template">📝</button>'
      +'<button class="small secondary" data-action="clear-task" data-run-id="'+attr(dagRunId)+'" data-task-id="'+attr(task.taskId)+'" title="Clear task instance to re-run">🔄</button>'
      +'<select data-action="set-task-state" data-run-id="'+attr(dagRunId)+'" data-task-id="'+attr(task.taskId)+'" title="Manually set task state"><option value="">Set...</option><option value="success">✓ Success</option><option value="failed">✗ Failed</option><option value="skipped">⏭ Skipped</option></select>'
      +'</td></tr>';
  });
  h+='</tbody></table>';
  document.getElementById('tasksContent').innerHTML=h;
  document.getElementById('tasksCard').style.display='block';
  document.getElementById('tasksCardTitle').textContent='Tasks: '+dagRunId;
}
document.addEventListener('click',function(e){
  const btn=e.target.closest('button[data-action]');
  if(!btn)return;
  console.log('[Airflow] DAG Details button clicked:', btn.dataset.action, btn.dataset);
  const action=btn.dataset.action;
  const runId=btn.dataset.runId;
  const taskId=btn.dataset.taskId;
  if(action==='load-tasks'){
    console.log('[Airflow] Loading tasks for run:', runId);
    document.getElementById('tasksContent').innerHTML='<div class="loading">Loading...</div>';
    vscode.postMessage({command:'loadTasks',dagRunId:runId});
  }else if(action==='run-success'){
    console.log('[Airflow] Sending setDagRunState message for success');
    vscode.postMessage({command:'setDagRunState',dagRunId:runId,state:'success'});
  }else if(action==='run-failed'){
    console.log('[Airflow] Sending setDagRunState message for failed');
    vscode.postMessage({command:'setDagRunState',dagRunId:runId,state:'failed'});
  }else if(action==='view-logs'){
    console.log('[Airflow] Viewing logs for task:', taskId);
    vscode.postMessage({command:'viewLogs',dagRunId:runId,taskId:taskId,tryNumber:parseInt(btn.dataset.try),maxTries:parseInt(btn.dataset.maxTries||'1')});
  }else if(action==='view-rendered'){
    console.log('[Airflow] Viewing rendered template for task:', taskId);
    vscode.postMessage({command:'viewRendered',dagRunId:runId,taskId:taskId});
  }else if(action==='clear-task'){
    console.log('[Airflow] Sending clearTask message');
    vscode.postMessage({command:'clearTask',dagRunId:runId,taskId:taskId});
  }
});
document.addEventListener('change',function(e){
  const sel=e.target;
  if(!sel||sel.tagName!=='SELECT'||sel.dataset.action!=='set-task-state')return;
  if(!sel.value)return;
  console.log('[Airflow] Sending setTaskState message');
  const state=sel.value;
  const runId=sel.dataset.runId;
  const taskId=sel.dataset.taskId;
  vscode.postMessage({command:'setTaskState',dagRunId:runId,taskId:taskId,state:state});
  sel.value='';
});
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function attr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
})();
</script>
</body></html>`;
  }

  private dispose() {
    DagDetailsPanel.panels.delete(this.dagId);
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
