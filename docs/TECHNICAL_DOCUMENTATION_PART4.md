# Airflow VS Code Extension - Technical Documentation (Part 4)

## Part 4: Tree Providers and UI Components

### 4.1 Tree Provider Architecture

Tree providers implement VS Code's `TreeDataProvider` interface to display hierarchical data in the sidebar.

#### 4.1.1 Common Pattern

All tree providers follow this structure:

```typescript
export class XxxTreeProvider implements vscode.TreeDataProvider<TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  
  constructor(private serverManager: ServerManager) {}
  
  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }
  
  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }
  
  async getChildren(element?: TreeItem): Promise<TreeItem[]> {
    // Return root items or children
  }
}
```

**Key Components**:
- `_onDidChangeTreeData`: EventEmitter for triggering UI updates
- `onDidChangeTreeData`: Public event that VS Code listens to
- `refresh()`: Triggers tree rebuild
- `getTreeItem()`: Returns the tree item itself
- `getChildren()`: Returns child items (or root items if element is undefined)

---

### 4.2 ServersTreeProvider (`src/providers/ServersTreeProvider.ts`)

#### 4.2.1 Purpose
Displays the list of configured Airflow servers with an "Add Server" button.

#### 4.2.2 Tree Structure

```
Servers View
├─ ➕ Add Server (AddServerTreeItem)
├─ Server 1 (ServerTreeItem)
├─ Server 2 (ServerTreeItem)
└─ Server 3 (ServerTreeItem)
```

#### 4.2.3 Implementation Details

##### getChildren()
```typescript
async getChildren(element?: ServerTreeItem | AddServerTreeItem): Promise<(ServerTreeItem | AddServerTreeItem)[]>
```

**Logic**:
```
if (!element) {
  // Root level
  1. Load servers from ServerManager
  2. Create ServerTreeItem for each server
  3. Add AddServerTreeItem at the beginning
  4. Return array
} else {
  // No children for server items
  return []
}
```

##### AddServerTreeItem

```typescript
class AddServerTreeItem extends vscode.TreeItem {
  constructor() {
    super('➕ Add Server', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'addServer';
    this.command = {
      command: 'airflow.addServerPanel',
      title: 'Add Server'
    };
    this.iconPath = new vscode.ThemeIcon('add');
  }
}
```

**Features**:
- Always appears at the top
- Clicking opens the Add Server panel
- Uses VS Code's built-in 'add' icon
- Non-collapsible

##### ServerTreeItem

```typescript
class ServerTreeItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile) {
    super(server.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'server';
    this.description = server.type === 'mwaa' ? 'MWAA' : 'Self-hosted';
    this.tooltip = `${server.name}\n${server.baseUrl || server.awsRegion}\nAPI: ${server.apiMode}`;
    
    // Health status icon
    const iconName = server.lastHealthStatus === 'healthy' ? 'pass' : 
                     server.lastHealthStatus === 'degraded' ? 'warning' : 
                     server.lastHealthStatus === 'down' ? 'error' : 'circle-outline';
    this.iconPath = new vscode.ThemeIcon(iconName);
    
    // Click to open details
    this.command = {
      command: 'airflow.openServerDetails',
      title: 'Open Server Details',
      arguments: [this.server]
    };
  }
}
```

**Features**:
- Shows server name as label
- Description shows server type
- Tooltip shows detailed info
- Icon reflects health status:
  - ✓ (pass) - Healthy
  - ⚠ (warning) - Degraded
  - ✗ (error) - Down
  - ○ (circle-outline) - Unknown
- Clicking opens Server Details panel

#### 4.2.4 Context Menu Integration

Defined in `package.json`:
```json
"menus": {
  "view/item/context": [
    {
      "command": "airflow.editServer",
      "when": "view == airflowServers && viewItem == server"
    },
    {
      "command": "airflow.deleteServer",
      "when": "view == airflowServers && viewItem == server"
    },
    {
      "command": "airflow.testConnection",
      "when": "view == airflowServers && viewItem == server"
    }
  ]
}
```

**Context Value Usage**:
- `contextValue = 'server'` enables right-click menu
- Menu items filtered by `viewItem == server`

---

### 4.3 DagsTreeProvider (`src/providers/DagsTreeProvider.ts`)

#### 4.3.1 Purpose
Displays the list of DAGs from the active Airflow server.

#### 4.3.2 Tree Structure

```
DAGs View
├─ dag_1 (DagTreeItem)
├─ dag_2 (DagTreeItem)
└─ dag_3 (DagTreeItem)
```

#### 4.3.3 Implementation Details

##### State Management
```typescript
private dags: DagSummary[] = [];
```
- Caches DAG list in memory
- Updated via `loadDags()` method
- Cleared on refresh

##### loadDags()
```typescript
async loadDags(): Promise<void>
```

**Flow**:
```
1. Get client from ServerManager
2. If no client → log warning and return
3. Call client.listDags()
4. Store result in this.dags
5. Call refresh() to update UI
6. On error → show error message and log
```

**Trigger Points**:
- Extension activation (if active server exists)
- Server selection change
- Manual refresh command
- After DAG operations (trigger, pause, delete)

##### DagTreeItem

```typescript
class DagTreeItem extends vscode.TreeItem {
  constructor(public readonly dag: DagSummary) {
    super(dag.dagId, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'dag';
    this.description = dag.paused ? '⏸️ Paused' : '▶️ Active';
    this.tooltip = `${dag.dagId}\nOwner: ${dag.owner}\nSchedule: ${dag.schedule || 'None'}`;
    
    // Status icon
    const iconName = dag.paused ? 'debug-pause' : 
                     dag.lastRunState === 'success' ? 'pass' :
                     dag.lastRunState === 'failed' ? 'error' :
                     dag.lastRunState === 'running' ? 'sync~spin' : 'circle-outline';
    this.iconPath = new vscode.ThemeIcon(iconName);
    
    // Click to open DAG details
    this.command = {
      command: 'airflow.openDagDetails',
      title: 'Open DAG Details',
      arguments: [this.dag]
    };
  }
}
```

**Features**:
- Shows DAG ID as label
- Description shows pause status
- Tooltip shows owner and schedule
- Icon reflects state:
  - ⏸ (debug-pause) - Paused
  - ✓ (pass) - Last run success
  - ✗ (error) - Last run failed
  - ⟳ (sync~spin) - Currently running
  - ○ (circle-outline) - Unknown/no runs
- Clicking opens DAG Details panel

#### 4.3.4 Context Menu

Commands available on right-click:
- Trigger DAG with Config
- Pause DAG
- Unpause DAG
- Delete DAG
- Open DAG Details

---

### 4.4 AdminTreeProvider (`src/providers/AdminTreeProvider.ts`)

#### 4.4.1 Purpose
Displays admin management options (Variables, Pools, Connections, Health Check).

#### 4.4.2 Tree Structure

```
Admin View
├─ Variables (AdminTreeItem)
├─ Pools (AdminTreeItem)
├─ Connections (AdminTreeItem)
└─ Health Check (AdminTreeItem)
```

#### 4.4.3 Implementation Details

##### getChildren()
```typescript
async getChildren(element?: AdminTreeItem): Promise<AdminTreeItem[]> {
  if (!element) {
    return [
      new AdminTreeItem('Variables', 'variables', 'symbol-variable'),
      new AdminTreeItem('Pools', 'pools', 'database'),
      new AdminTreeItem('Connections', 'connections', 'plug'),
      new AdminTreeItem('Health Check', 'health', 'pulse', 'airflow.openHealthCheck')
    ];
  }
  return [];
}
```

**Static Structure**:
- Always shows same 4 items
- No dynamic loading required
- No children for any item

##### AdminTreeItem

```typescript
class AdminTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: string,
    iconName: string,
    commandId?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = type;
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.command = {
      command: commandId ?? `airflow.open${label.replace(' ', '')}Panel`,
      title: `Open ${label}`,
      arguments: []
    };
  }
}
```

**Features**:
- Label: Display name
- Type: Context value for menus
- Icon: VS Code theme icon
- Command: Opens corresponding panel
  - Variables → `airflow.openVariablesPanel`
  - Pools → `airflow.openPoolsPanel`
  - Connections → `airflow.openConnectionsPanel`
  - Health Check → `airflow.openHealthCheck`

#### 4.4.4 Icon Mapping

| Item | Icon | Theme Icon Name |
|------|------|-----------------|
| Variables | 🔤 | symbol-variable |
| Pools | 🗄️ | database |
| Connections | 🔌 | plug |
| Health Check | 💓 | pulse |

---

### 4.5 Tree View Registration

#### 4.5.1 Registration in extension.ts

```typescript
// Create providers
serversTreeProvider = new ServersTreeProvider(serverManager);
dagsTreeProvider = new DagsTreeProvider(serverManager);
adminTreeProvider = new AdminTreeProvider(serverManager);

// Register with VS Code
const serversDisposable = vscode.window.registerTreeDataProvider('airflowServers', serversTreeProvider);
const dagsDisposable = vscode.window.registerTreeDataProvider('airflowDags', dagsTreeProvider);
const adminDisposable = vscode.window.registerTreeDataProvider('airflowAdmin', adminTreeProvider);

// Add to subscriptions for cleanup
context.subscriptions.push(serversDisposable, dagsDisposable, adminDisposable);
```

#### 4.5.2 View Configuration in package.json

```json
"views": {
  "airflow": [
    {
      "id": "airflowServers",
      "name": "Servers"
    },
    {
      "id": "airflowDags",
      "name": "DAGs"
    },
    {
      "id": "airflowAdmin",
      "name": "Admin"
    }
  ]
}
```

#### 4.5.3 View Container

```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "airflow",
      "title": "Airflow",
      "icon": "resources/airflow-icon.svg"
    }
  ]
}
```

---

### 4.6 Refresh Mechanisms

#### 4.6.1 Manual Refresh

**User Actions**:
- Click refresh button in view title
- Execute refresh command from command palette
- Right-click → Refresh

**Implementation**:
```typescript
async function refreshServers() {
  serversTreeProvider.refresh();
  vscode.window.showInformationMessage('Servers refreshed');
}

async function refreshDags() {
  await dagsTreeProvider.loadDags();
}

async function refreshAdmin() {
  adminTreeProvider.refresh();
  vscode.window.showInformationMessage('Admin view refreshed');
}
```

#### 4.6.2 Automatic Refresh

**Triggers**:
- After adding/editing/deleting server
- After DAG operations (trigger, pause, unpause, delete)
- After switching active server
- After successful connection test

**Pattern**:
```typescript
async function someOperation() {
  // Perform operation
  await serverManager.addServer(profile);
  
  // Refresh affected views
  serversTreeProvider.refresh();
  await dagsTreeProvider.loadDags();
}
```

#### 4.6.3 Refresh Flow

```
User Action / Event
    ↓
Command Handler
    ↓
Business Logic (ServerManager)
    ↓
Tree Provider refresh()
    ↓
Fire onDidChangeTreeData event
    ↓
VS Code calls getChildren()
    ↓
UI Updates
```

---

### 4.7 Status Bar Integration

#### 4.7.1 Status Bar Item

```typescript
statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
statusBarItem.text = '$(cloud) Airflow';
statusBarItem.show();
```

#### 4.7.2 Dynamic Updates

**On Active Server Change**:
```typescript
async function loadActiveServer() {
  const server = await serverManager.getActiveServer();
  if (server) {
    statusBarItem.text = `$(cloud) ${server.name}`;
    await dagsTreeProvider.loadDags();
  } else {
    statusBarItem.text = '$(cloud) Airflow';
  }
}
```

**Display Format**:
- No server: `☁ Airflow`
- With server: `☁ My Server Name`

---

### 4.8 Error Handling in Tree Providers

#### 4.8.1 Empty State Handling

**No Servers**:
```typescript
// ServersTreeProvider returns only AddServerTreeItem
if (servers.length === 0) {
  return [new AddServerTreeItem()];
}
```

**No DAGs**:
```typescript
// DagsTreeProvider returns empty array
if (this.dags.length === 0) {
  return [];
}
```

**VS Code shows**: "No DAGs available" message

#### 4.8.2 Error Display

**Load Errors**:
```typescript
try {
  this.dags = await client.listDags();
} catch (error: any) {
  Logger.error('Failed to load DAGs', error);
  vscode.window.showErrorMessage(`Failed to load DAGs: ${error.message}`);
}
```

**User Experience**:
- Error logged to output channel
- Toast notification shown
- Tree view shows last successful state or empty

---

### 4.9 Performance Considerations

#### 4.9.1 Caching Strategy

**DAGs List**:
- Cached in `DagsTreeProvider.dags`
- Only reloaded on explicit refresh or operations
- Reduces API calls

**Servers List**:
- Loaded fresh on each `getChildren()` call
- Minimal performance impact (local storage)
- Ensures consistency

#### 4.9.2 Lazy Loading

**Current Implementation**:
- All items loaded at once
- No pagination
- Suitable for typical DAG counts (<1000)

**Future Enhancement Opportunity**:
- Implement virtual scrolling for large DAG lists
- Paginated loading
- Search/filter capabilities

#### 4.9.3 Refresh Throttling

**Current Behavior**:
- No throttling implemented
- Each operation triggers immediate refresh

**Best Practice**:
- Batch multiple operations
- Debounce rapid refresh calls
- Use progress indicators for long operations

---

## Summary

Part 4 covered:
- **Tree Provider Architecture**: Common patterns and structure
- **ServersTreeProvider**: Server list with add button
- **DagsTreeProvider**: DAG list with status indicators
- **AdminTreeProvider**: Static admin menu
- **Registration**: How providers connect to VS Code
- **Refresh Mechanisms**: Manual and automatic updates
- **Status Bar**: Active server display
- **Error Handling**: Empty states and error display
- **Performance**: Caching and loading strategies

**Next Part Preview**: Part 5 will cover Webview Panels and interactive UI components.
