# Airflow VS Code Extension - Technical Documentation (Part 5)

## Part 5: Webview Panels and Interactive UI

### 5.1 Webview Architecture Overview

Webviews are embedded web pages within VS Code that provide rich, interactive UI experiences.

#### 5.1.1 Communication Model

```
Extension (TypeScript)  ←→  Webview (HTML/JavaScript)
        ↓                           ↓
    postMessage()              postMessage()
        ↓                           ↓
onDidReceiveMessage()      window.addEventListener('message')
```

**Bidirectional Communication**:
- Extension → Webview: `panel.webview.postMessage(data)`
- Webview → Extension: `vscode.postMessage(data)`

#### 5.1.2 Common Webview Pattern

```typescript
export class XxxPanel {
  private static panels = new Map<string, XxxPanel>();
  private panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(id: string, serverManager: ServerManager, extensionUri: vscode.Uri) {
    this.panel = vscode.window.createWebviewPanel(
      'viewType', 'Title', vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );
    this.panel.webview.onDidReceiveMessage(msg => this.handleMessage(msg), null, this.disposables);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.update();
  }

  static show(id: string, serverManager: ServerManager, extensionUri: vscode.Uri) {
    const existing = XxxPanel.panels.get(id);
    if (existing) { existing.panel.reveal(); existing.update(); return; }
    const p = new XxxPanel(id, serverManager, extensionUri);
    XxxPanel.panels.set(id, p);
  }

  private async handleMessage(msg: any) {
    // Handle messages from webview
  }

  private async update() {
    // Fetch data and update HTML
    this.panel.webview.html = this.getHtml(data);
  }

  private getHtml(data: any): string {
    // Return HTML string
  }

  private dispose() {
    XxxPanel.panels.delete(this.id);
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}
```

**Key Features**:
- Singleton per ID (prevents duplicate panels)
- Automatic cleanup on disposal
- Retained context (state preserved when hidden)
- Message-based communication

---

### 5.2 ServerDetailsPanel (`src/webviews/ServerDetailsPanel.ts`)

#### 5.2.1 Purpose
Displays detailed server information, health status, and provides server management UI.

#### 5.2.2 Modes

**View Mode**:
- Display server details
- Show health metrics
- Show DAG statistics
- Action buttons (Edit, Delete, Refresh, Test)

**Edit Mode**:
- Form to edit server configuration
- Save/Cancel buttons
- Validation

**Add Mode** (Special case):
- Form to add new server
- Server type selection
- API mode selection

#### 5.2.3 Data Flow

```
Extension Side:
1. User clicks server in tree
2. Command: airflow.openServerDetails
3. ServerDetailsPanel.show(serverId, ...)
4. Constructor creates webview
5. update() fetches data
6. getHtml() generates HTML
7. Set panel.webview.html

Webview Side:
8. HTML loads
9. JavaScript initializes
10. User clicks button
11. vscode.postMessage({ command: 'action' })

Extension Side:
12. handleMessage() receives message
13. Execute action (edit, delete, test, refresh)
14. update() refreshes display
```

#### 5.2.4 Message Commands

**From Webview to Extension**:
```typescript
{ command: 'refresh' }                    // Reload server data
{ command: 'testConnection' }             // Test server connection
{ command: 'editServer', data: {...} }    // Update server config
{ command: 'deleteServer' }               // Delete server
{ command: 'addServer', data: {...} }     // Add new server
```

**From Extension to Webview**:
```typescript
// No direct messages - uses HTML updates
```

#### 5.2.5 HTML Structure

```html
<div id="viewMode">
  <!-- Server name and actions -->
  <h1>Server Name</h1>
  <button id="btnEdit">Edit</button>
  <button id="btnDelete">Delete</button>
  
  <!-- Metrics -->
  <div class="metrics">
    <div class="metric-card">Total DAGs</div>
    <div class="metric-card">Active DAGs</div>
    <div class="metric-card">Paused DAGs</div>
  </div>
  
  <!-- Run statistics (if available) -->
  <div class="run-metrics">
    <div class="metric-card">Running Runs</div>
    <div class="metric-card">Queued Runs</div>
    <div class="metric-card">Success Runs</div>
    <div class="metric-card">Failed Runs</div>
  </div>
  
  <!-- Health status -->
  <div class="section">
    <h2>Health Status</h2>
    <div class="info-row">Metadatabase: healthy</div>
    <div class="info-row">Scheduler: healthy</div>
  </div>
  
  <!-- Connection details -->
  <div class="section">
    <h2>Connection Details</h2>
    <div class="info-row">Type: Self-hosted</div>
    <div class="info-row">Endpoint: http://localhost:8080</div>
  </div>
  
  <button id="btnRefresh">Refresh</button>
  <button id="btnTest">Test Connection</button>
</div>

<div id="editMode" style="display:none">
  <!-- Edit form -->
  <input id="eName" type="text">
  <input id="eBaseUrl" type="text">
  <button id="btnSave">Save</button>
  <button id="btnCancelEdit">Cancel</button>
</div>
```

#### 5.2.6 Key Features

**Health Status Visualization**:
```typescript
const statusColor = (s: string) => 
  s === 'healthy' ? '#27ae60' : 
  s === 'unhealthy' ? '#c0392b' : '#7f8c8d';

const statusDot = (s: string) => 
  `<span style="display:inline-block;width:10px;height:10px;
   border-radius:50%;background:${statusColor(s)};margin-right:6px"></span>`;
```

**Metric Cards**:
- Color-coded borders
- Large numbers for quick scanning
- Descriptive labels

**Dynamic Forms**:
- Self-hosted vs MWAA fields toggle
- API mode selection
- Password masking

#### 5.2.7 Add Server Flow

```
1. User clicks "Add Server" in tree
2. showAddServerPanel() called
3. ServerDetailsPanel.showNew()
4. serverId = '__new__'
5. getAddServerHtml() returns form
6. User fills form and clicks "Add Server"
7. handleMessage({ command: 'addServer', data: {...} })
8. addServer() creates profile
9. serverManager.addServer()
10. Switch to view mode with new server ID
11. update() shows server details
```

---

### 5.3 DagDetailsPanel (`src/webviews/DagDetailsPanel.ts`)

#### 5.3.1 Purpose
Comprehensive DAG management interface with runs, tasks, logs, and source code viewing.

#### 5.3.2 Views

**Main View**:
- DAG information card
- Tabs: Tasks | DAG Runs
- Action buttons (Trigger, Pause/Unpause, Source, Refresh)

**Inline View** (Overlay):
- Task logs viewer with try selector
- DAG source code viewer
- Back button to return to main view

#### 5.3.3 Tab Structure

```
┌─────────────────────────────────────┐
│ DAG: my_dag_id                      │
│ [Trigger] [Pause] [Source] [Refresh]│
├─────────────────────────────────────┤
│ [Tasks (5)] [DAG Runs]              │ ← Tabs
├─────────────────────────────────────┤
│                                     │
│  Task Structure Table               │
│  - task_id                          │
│  - task_type                        │
│  - downstream_task_ids              │
│                                     │
└─────────────────────────────────────┘
```

#### 5.3.4 Message Commands

**From Webview to Extension**:
```typescript
{ command: 'trigger', conf?: {...} }                    // Trigger DAG
{ command: 'pause' }                                    // Pause DAG
{ command: 'unpause' }                                  // Unpause DAG
{ command: 'refresh' }                                  // Refresh data
{ command: 'loadDagRuns' }                              // Load DAG runs
{ command: 'loadTasks', dagRunId: string }              // Load task instances
{ command: 'viewLogs', dagRunId, taskId, tryNumber }    // View task logs
{ command: 'viewSource' }                               // View DAG source
{ command: 'openInEditor' }                             // Open source in editor
{ command: 'clearTask', dagRunId, taskId }              // Clear task
{ command: 'setTaskState', dagRunId, taskId, state }    // Set task state
{ command: 'setDagRunState', dagRunId, state }          // Set DAG run state
```

**From Extension to Webview**:
```typescript
{ command: 'updateDagRuns', runs: [...] }               // Update runs table
{ command: 'updateTasks', tasks: [...], dagRunId }      // Update tasks table
{ command: 'showLogs', logs, taskId, tryNumber, maxTries } // Display logs
{ command: 'showCode', source, dagId }                  // Display source
{ command: 'updateTaskStructure', tasks: [...] }        // Update task structure
```

#### 5.3.5 Task Structure Display

**From DAG Details API** (Preferred):
```typescript
const tasks = dagDetails.tasks.map(t => ({
  task_id: t.task_id,
  task_type: t.task_type || t.operator_name,
  downstream_task_ids: t.downstream_task_ids
}));
```

**Fallback from First DAG Run**:
```typescript
// If no task structure from details API
if (runs.length > 0) {
  const tasks = await client.listTaskInstances(dagId, runs[0].dagRunId);
  const taskStructure = tasks.map(t => ({
    task_id: t.taskId,
    task_type: 'Task',
    downstream_task_ids: []
  }));
}
```

#### 5.3.6 DAG Runs Table

```html
<table>
  <thead>
    <tr>
      <th>Run ID</th>
      <th>State</th>
      <th>Execution Date</th>
      <th>Duration</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>manual__2024-01-15T10:30:00</td>
      <td><span class="status success">success</span></td>
      <td>1/15/2024, 10:30:00 AM</td>
      <td>45s</td>
      <td>
        <button data-action="load-tasks">📋</button>
        <button data-action="run-success">✓</button>
        <button data-action="run-failed">✗</button>
      </td>
    </tr>
  </tbody>
</table>
```

**Features**:
- Color-coded state badges
- Duration calculation
- Quick actions per run
- Click to load tasks

#### 5.3.7 Task Instances Table

```html
<table>
  <thead>
    <tr>
      <th>Task ID</th>
      <th>State</th>
      <th>Try</th>
      <th>Duration</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>extract_data</td>
      <td><span class="status success">success</span></td>
      <td>1</td>
      <td>12.5s</td>
      <td>
        <button data-action="view-logs">📄</button>
        <button data-action="clear-task">🔄</button>
        <select data-action="set-task-state">
          <option value="">Set...</option>
          <option value="success">✓ Success</option>
          <option value="failed">✗ Failed</option>
          <option value="skipped">⏭ Skipped</option>
        </select>
      </td>
    </tr>
  </tbody>
</table>
```

**Features**:
- State visualization
- Try number (for retries)
- Duration display
- Multiple actions:
  - View logs
  - Clear task (re-run)
  - Manually set state

#### 5.3.8 Log Viewer

**Multi-Try Support**:
```html
<div class="toolbar">
  <h3>Logs: task_id</h3>
  <select id="trySelector">
    <option value="1">Try 1</option>
    <option value="2">Try 2</option>
    <option value="3">Try 3 (latest)</option>
  </select>
  <button id="btnBack">← Back</button>
</div>
<pre id="inlineContent">
[2024-01-15 10:30:00] Task started
[2024-01-15 10:30:05] Processing data...
[2024-01-15 10:30:12] Task completed successfully
</pre>
```

**Features**:
- Try selector dropdown (if multiple tries)
- Scrollable log content
- Monospace font
- Syntax highlighting (future enhancement)

#### 5.3.9 Trigger DAG with Config

```html
<div id="triggerForm" style="display:none">
  <label>Configuration JSON (optional)</label>
  <textarea id="triggerConf" rows="3" placeholder='{"key": "value"}'></textarea>
  <button id="btnTriggerSubmit">▶️ Trigger DAG</button>
  <button id="btnTriggerCancel">Cancel</button>
</div>
```

**Validation**:
```javascript
const confStr = document.getElementById('triggerConf').value.trim();
let conf = undefined;
if (confStr) {
  try {
    conf = JSON.parse(confStr);
  } catch (e) {
    alert('Invalid JSON');
    return;
  }
}
vscode.postMessage({ command: 'trigger', conf: conf });
```

#### 5.3.10 Event Delegation Pattern

```javascript
document.addEventListener('click', function(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  
  const action = btn.dataset.action;
  const runId = btn.dataset.runId;
  const taskId = btn.dataset.taskId;
  
  if (action === 'load-tasks') {
    vscode.postMessage({ command: 'loadTasks', dagRunId: runId });
  } else if (action === 'view-logs') {
    vscode.postMessage({ 
      command: 'viewLogs', 
      dagRunId: runId, 
      taskId: taskId, 
      tryNumber: parseInt(btn.dataset.try) 
    });
  }
  // ... more actions
});
```

**Benefits**:
- Single event listener for all buttons
- Works with dynamically added elements
- Clean and maintainable

---

### 5.4 AdminPanels (`src/webviews/AdminPanels.ts`)

#### 5.4.1 Three Panel Types

1. **VariablesPanel** - Manage Airflow variables
2. **PoolsPanel** - Manage execution pools
3. **ConnectionsPanel** - Manage connections

#### 5.4.2 Common Structure

All three panels share the same HTML structure:

```html
<h2>Title</h2>
<button id="btnCreate">Create</button>
<button id="btnRefresh">🔄 Refresh</button>

<div id="form" style="display:none">
  <h3 id="formTitle">Create</h3>
  <input type="hidden" id="editMode" value="false">
  <!-- Form fields -->
  <button id="btnSave">💾 Save</button>
  <button id="btnCancel">Cancel</button>
</div>

<table>
  <thead><!-- Column headers --></thead>
  <tbody id="tbody"><!-- Data rows --></tbody>
</table>
```

#### 5.4.3 VariablesPanel

**Table Structure**:
```
| Key | Value | Description | Actions |
|-----|-------|-------------|---------|
| my_var | value123 | My variable | [Edit] [Delete] |
```

**Form Fields**:
```html
<label>Key</label>
<input id="fKey" type="text">

<label>Value</label>
<textarea id="fValue" rows="4"></textarea>

<label>Description</label>
<input id="fDesc" type="text">
```

**Message Commands**:
```typescript
{ command: 'create', key, value, description }
{ command: 'edit', key, value, description }
{ command: 'delete', key }
{ command: 'refresh' }
```

**Edit Flow**:
```javascript
window.handleEdit = function(btn) {
  document.getElementById('formTitle').textContent = 'Edit Variable';
  document.getElementById('editMode').value = 'true';
  document.getElementById('fKey').value = btn.dataset.key;
  document.getElementById('fKey').disabled = true;  // Can't change key
  document.getElementById('fValue').value = btn.dataset.value;
  document.getElementById('fDesc').value = btn.dataset.desc;
  document.getElementById('form').style.display = 'block';
};
```

#### 5.4.4 PoolsPanel

**Table Structure**:
```
| Name | Slots | Occupied | Running | Queued | Description | Actions |
|------|-------|----------|---------|--------|-------------|---------|
| default_pool | 128 | 5 | 3 | 2 | Default pool | [Edit] [Delete] |
```

**Form Fields**:
```html
<label>Name</label>
<input id="fName" type="text">

<label>Slots</label>
<input id="fSlots" type="number" min="1" value="1">

<label>Description</label>
<input id="fDesc" type="text">
```

**Message Commands**:
```typescript
{ command: 'create', name, slots, description }
{ command: 'edit', name, slots, description }
{ command: 'delete', name }
{ command: 'refresh' }
```

**Slot Visualization**:
- Total slots: Configurable capacity
- Occupied: Currently in use
- Running: Tasks actively running
- Queued: Tasks waiting for slots

#### 5.4.5 ConnectionsPanel

**Table Structure**:
```
| ID | Type | Host | Schema | Login | Port | Actions |
|----|------|------|--------|-------|------|---------|
| postgres_default | postgres | localhost | airflow | admin | 5432 | [Edit] [Delete] |
```

**Form Fields**:
```html
<label>Connection ID</label>
<input id="fId" type="text">

<label>Type</label>
<input id="fType" type="text" placeholder="e.g. http, postgres">

<label>Host</label>
<input id="fHost" type="text">

<label>Schema</label>
<input id="fSchema" type="text">

<label>Login</label>
<input id="fLogin" type="text">

<label>Port</label>
<input id="fPort" type="number">

<label>Extra (JSON)</label>
<textarea id="fExtra" rows="3"></textarea>
```

**Message Commands**:
```typescript
{ 
  command: 'create', 
  connectionId, connType, host, schema, login, port, extra 
}
{ 
  command: 'edit', 
  connectionId, connType, host, schema, login, port, extra 
}
{ command: 'delete', connectionId }
{ command: 'refresh' }
```

#### 5.4.6 Singleton Pattern

```typescript
export class VariablesPanel {
  private static instance?: VariablesPanel;
  
  static show(serverManager: ServerManager, extensionUri: vscode.Uri) {
    if (VariablesPanel.instance) {
      VariablesPanel.instance.panel.reveal();
      VariablesPanel.instance.update();
      return;
    }
    VariablesPanel.instance = new VariablesPanel(serverManager, extensionUri);
  }
  
  private dispose() {
    VariablesPanel.instance = undefined;
    // ... cleanup
  }
}
```

**Benefits**:
- Only one panel instance per type
- Reuses existing panel if open
- Prevents duplicate panels
- Automatic cleanup on close

#### 5.4.7 CRUD Operations

**Create**:
```typescript
if (msg.command === 'create') {
  await client.upsertVariable(msg.key, msg.value, msg.description);
  vscode.window.showInformationMessage(`Variable "${msg.key}" saved`);
  this.update();
}
```

**Read** (handled in update()):
```typescript
const vars = await client.listVariables();
this.panel.webview.html = this.getHtml(vars);
```

**Update**:
```typescript
if (msg.command === 'edit') {
  await client.upsertVariable(msg.key, msg.value, msg.description);
  vscode.window.showInformationMessage(`Variable "${msg.key}" updated`);
  this.update();
}
```

**Delete**:
```typescript
if (msg.command === 'delete') {
  await client.deleteVariable(msg.key);
  vscode.window.showInformationMessage(`Variable "${msg.key}" deleted`);
  this.update();
}
```

---

### 5.5 Webview Security

#### 5.5.1 Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'none'; 
               style-src 'unsafe-inline'; 
               script-src 'unsafe-inline';">
```

**Current Implementation**: Inline styles and scripts allowed for simplicity

**Production Recommendation**:
- Use nonces for inline scripts
- Load external CSS/JS from extension resources
- Restrict script sources

#### 5.5.2 Input Sanitization

**HTML Escaping**:
```typescript
function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

**Attribute Escaping**:
```typescript
function attr(v: any): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, ' ');
}
```

**Usage**:
```typescript
`<td>${esc(variable.key)}</td>`
`<button data-key="${attr(variable.key)}">Edit</button>`
```

#### 5.5.3 JSON Validation

**Trigger Config**:
```javascript
try {
  conf = JSON.parse(confStr);
} catch (e) {
  alert('Invalid JSON');
  return;
}
```

**Connection Extra**:
```javascript
const extra = document.getElementById('fExtra').value;
// Sent as-is, validated by Airflow API
```

---

### 5.6 Styling and Theming

#### 5.6.1 VS Code Theme Variables

```css
body {
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  font-family: var(--vscode-font-family);
}

button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

button:hover {
  background: var(--vscode-button-hoverBackground);
}

input {
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border);
}
```

**Benefits**:
- Automatic light/dark theme support
- Consistent with VS Code UI
- Respects user preferences

#### 5.6.2 Status Colors

```css
.status.success { background: #27ae60; color: white; }
.status.failed { background: #c0392b; color: white; }
.status.running { background: #2980b9; color: white; }
.status.queued { background: #f39c12; color: black; }
.status.paused { background: #f39c12; color: black; }
```

**Consistent Color Scheme**:
- Green (#27ae60): Success, healthy, active
- Red (#c0392b): Failed, error, danger
- Blue (#2980b9): Running, in progress
- Orange (#f39c12): Queued, paused, warning
- Gray (#7f8c8d): Unknown, neutral

#### 5.6.3 Responsive Layout

```css
.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 768px) {
  .metrics {
    grid-template-columns: 1fr;
  }
}
```

---

## Summary

Part 5 covered:
- **Webview Architecture**: Communication model and common patterns
- **ServerDetailsPanel**: Server management and health monitoring
- **DagDetailsPanel**: Comprehensive DAG operations interface
- **AdminPanels**: Variables, Pools, and Connections management
- **Security**: Input sanitization and validation
- **Styling**: Theme integration and responsive design

**Next Part Preview**: Part 6 will cover API Clients and HTTP communication layer.
