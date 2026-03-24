# Airflow VS Code Extension - Technical Architecture Documentation
## Part 1: Overview, Architecture & Core Components

---

## Table of Contents (Complete Documentation)
- **Part 1**: Overview, Architecture & Core Components (This Document)
- **Part 2**: API Layer & Client Implementation
- **Part 3**: Managers, Providers & UI Components
- **Part 4**: End-to-End Flows & Integration Patterns

---

## 1. Project Overview

### 1.1 Purpose
The Airflow VS Code Extension provides a comprehensive interface for managing Apache Airflow environments directly from Visual Studio Code. It supports both self-hosted Airflow instances and AWS Managed Workflows for Apache Airflow (MWAA).

### 1.2 Key Features
- **Multi-Environment Support**: Connect to multiple Airflow servers (self-hosted and MWAA)
- **Automatic API Version Detection**: Supports Airflow 2.x (API v1) and Airflow 3.x (API v2)
- **DAG Management**: Browse, trigger, pause/unpause, delete DAGs
- **Task Operations**: View task instances, clear tasks, view logs with multi-try support
- **Admin Tools**: Full CRUD operations for Variables, Pools, and Connections
- **Health Monitoring**: Real-time health status of Airflow components
- **Secure Credential Storage**: Uses VS Code Secret Storage API

### 1.3 Technology Stack
- **Language**: TypeScript
- **Framework**: VS Code Extension API
- **HTTP Client**: Axios
- **AWS SDK**: @aws-sdk/client-mwaa
- **Build Tool**: TypeScript Compiler (tsc)
- **Package Manager**: npm

---

## 2. High-Level Architecture

### 2.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VS Code Extension Host                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    extension.ts (Entry Point)             │  │
│  │  - Extension Activation                                   │  │
│  │  - Command Registration                                   │  │
│  │  - Component Initialization                               │  │
│  └────────────┬─────────────────────────────────────────────┘  │
│               │                                                  │
│  ┌────────────▼──────────────────────────────────────────────┐ │
│  │                    Core Managers Layer                     │ │
│  │  ┌──────────────────────────────────────────────────────┐ │ │
│  │  │           ServerManager (Business Logic)             │ │ │
│  │  │  - Server CRUD operations                            │ │ │
│  │  │  - Active server management                          │ │ │
│  │  │  - API client factory                                │ │ │
│  │  │  - API version detection                             │ │ │
│  │  └──────────────────────────────────────────────────────┘ │ │
│  └────────────┬─────────────────────────────────────────────┘ │
│               │                                                  │
│  ┌────────────▼──────────────────────────────────────────────┐ │
│  │                    API Client Layer                        │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │ │
│  │  │IAirflowClient│  │ HttpClient   │  │  Logger        │  │ │
│  │  │  (Interface) │  │ (Axios wrap) │  │  (Logging)     │  │ │
│  │  └──────┬───────┘  └──────────────┘  └────────────────┘  │ │
│  │         │                                                   │ │
│  │  ┌──────▼───────┐  ┌──────────────┐  ┌────────────────┐  │ │
│  │  │AirflowStable │  │AirflowV2     │  │  MwaaClient    │  │ │
│  │  │Client (v1)   │  │Client (v2)   │  │  (AWS MWAA)    │  │ │
│  │  └──────────────┘  └──────────────┘  └────────────────┘  │ │
│  └────────────┬─────────────────────────────────────────────┘ │
│               │                                                  │
│  ┌────────────▼──────────────────────────────────────────────┐ │
│  │                    UI Layer (Providers)                    │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │ │
│  │  │ServersTree   │  │DagsTree      │  │  AdminTree     │  │ │
│  │  │Provider      │  │Provider      │  │  Provider      │  │ │
│  │  └──────────────┘  └──────────────┘  └────────────────┘  │ │
│  └────────────┬─────────────────────────────────────────────┘ │
│               │                                                  │
│  ┌────────────▼──────────────────────────────────────────────┐ │
│  │                    Webview Panels                          │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │ │
│  │  │ServerDetails │  │DagDetails    │  │  AdminPanels   │  │ │
│  │  │Panel         │  │Panel         │  │  (Var/Pool/Con)│  │ │
│  │  └──────────────┘  └──────────────┘  └────────────────┘  │ │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                   │
└───────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │     External Airflow REST APIs          │
        │  ┌────────────┐  ┌──────────────────┐  │
        │  │Self-hosted │  │  AWS MWAA        │  │
        │  │Airflow     │  │  Environment     │  │
        │  │API v1/v2   │  │  (API v1)        │  │
        │  └────────────┘  └──────────────────┘  │
        └─────────────────────────────────────────┘
```

### 2.2 Architectural Layers

#### 2.2.1 Entry Point Layer
- **File**: `extension.ts`
- **Responsibility**: Extension lifecycle management, command registration, component initialization

#### 2.2.2 Business Logic Layer
- **File**: `managers/ServerManager.ts`
- **Responsibility**: Server management, client factory, API version detection

#### 2.2.3 API Client Layer
- **Files**: `api/IAirflowClient.ts`, `api/AirflowStableClient.ts`, `api/AirflowV2Client.ts`, `api/MwaaClient.ts`, `api/HttpClient.ts`
- **Responsibility**: Abstraction over Airflow REST APIs, HTTP communication

#### 2.2.4 UI Provider Layer
- **Files**: `providers/ServersTreeProvider.ts`, `providers/DagsTreeProvider.ts`, `providers/AdminTreeProvider.ts`
- **Responsibility**: Tree view data providers for VS Code sidebar

#### 2.2.5 Webview Layer
- **Files**: `webviews/ServerDetailsPanel.ts`, `webviews/DagDetailsPanel.ts`, `webviews/AdminPanels.ts`
- **Responsibility**: Rich UI panels for detailed views and operations

#### 2.2.6 Utility Layer
- **File**: `utils/logger.ts`
- **Responsibility**: Centralized logging with multiple log levels

---

## 3. Core Components Deep Dive

### 3.1 Extension Entry Point (`extension.ts`)

#### 3.1.1 Activation Flow
```typescript
export function activate(context: vscode.ExtensionContext) {
  // 1. Initialize Logger
  Logger.initialize(context);
  
  // 2. Create Core Managers
  serverManager = new ServerManager(context);
  
  // 3. Create Tree Providers
  serversTreeProvider = new ServersTreeProvider(serverManager);
  dagsTreeProvider = new DagsTreeProvider(serverManager);
  adminTreeProvider = new AdminTreeProvider(serverManager);
  
  // 4. Register Tree Views
  vscode.window.registerTreeDataProvider('airflowServers', serversTreeProvider);
  vscode.window.registerTreeDataProvider('airflowDags', dagsTreeProvider);
  vscode.window.registerTreeDataProvider('airflowAdmin', adminTreeProvider);
  
  // 5. Create Status Bar
  statusBarItem = vscode.window.createStatusBarItem(...);
  
  // 6. Register Commands (25+ commands)
  vscode.commands.registerCommand('airflow.addServer', addServer);
  // ... more commands
  
  // 7. Load Active Server
  loadActiveServer();
}
```

#### 3.1.2 Key Commands Registered
| Command ID | Handler Function | Description |
|------------|------------------|-------------|
| `airflow.addServer` | `addServer()` | Add new Airflow server via input prompts |
| `airflow.addServerPanel` | `addServerPanel()` | Add server via webview panel |
| `airflow.refreshServers` | `refreshServers()` | Refresh server list |
| `airflow.editServer` | `editServer()` | Edit server configuration |
| `airflow.deleteServer` | `deleteServer()` | Delete server |
| `airflow.testConnection` | `testConnection()` | Test server connectivity |
| `airflow.openServerDetails` | `openServerDetails()` | Open server details webview |
| `airflow.refreshDags` | `refreshDags()` | Refresh DAG list |
| `airflow.openDagDetails` | `openDagDetails()` | Open DAG details webview |
| `airflow.triggerDag` | `triggerDag()` | Trigger DAG with optional config |
| `airflow.pauseDag` | `pauseDag()` | Pause DAG execution |
| `airflow.unpauseDag` | `unpauseDag()` | Resume DAG execution |
| `airflow.deleteDag` | `deleteDag()` | Delete DAG |
| `airflow.clearTask` | `clearTask()` | Clear task instance |
| `airflow.viewLogs` | `viewLogs()` | View task logs |
| `airflow.openVariablesPanel` | `openVariablesPanel()` | Open Variables management panel |
| `airflow.openPoolsPanel` | `openPoolsPanel()` | Open Pools management panel |
| `airflow.openConnectionsPanel` | `openConnectionsPanel()` | Open Connections management panel |
| `airflow.openHealthCheck` | `openHealthCheck()` | View health status |

#### 3.1.3 Command Implementation Pattern
```typescript
async function triggerDag(item: any) {
  Logger.info('=== USER ACTION: Trigger DAG ===');
  const dagId = item?.dag?.dagId;
  
  // 1. Validate input
  if (!dagId) {
    Logger.warn('triggerDag: No dagId provided');
    return;
  }
  
  // 2. Get user input (optional config)
  const confInput = await vscode.window.showInputBox({
    prompt: 'Configuration JSON (optional)',
    validateInput: (value) => {
      if (!value) return null;
      try {
        JSON.parse(value);
        return null;
      } catch {
        return 'Invalid JSON';
      }
    }
  });
  
  // 3. Get API client
  const client = await serverManager.getClient();
  if (!client) {
    vscode.window.showErrorMessage('No active server');
    return;
  }
  
  // 4. Execute API call
  const conf = confInput ? JSON.parse(confInput) : undefined;
  await client.triggerDagRun(dagId, conf);
  
  // 5. Show success message
  vscode.window.showInformationMessage(`✓ DAG ${dagId} triggered`);
  
  // 6. Refresh UI
  refreshDags();
}
```

---

### 3.2 Data Models (`models/index.ts`)

#### 3.2.1 ServerProfile
```typescript
interface ServerProfile {
  id: string;                    // Unique identifier (timestamp-based)
  name: string;                  // User-friendly name
  type: 'self-hosted' | 'mwaa';  // Server type
  baseUrl: string;               // API endpoint or MWAA env name
  awsRegion?: string;            // AWS region (MWAA only)
  authType: 'basic' | 'token' | 'aws';  // Authentication method
  username?: string;             // Username (self-hosted)
  apiMode: 'stable-v1' | 'stable-v2' | 'auto';  // API version
  defaultRefreshInterval: number;  // Refresh interval in seconds
  headers?: Record<string, string>;  // Custom headers
  lastHealthStatus: 'unknown' | 'healthy' | 'degraded' | 'down';
  lastSyncedTimestamp?: number;  // Last sync time
}
```

**Storage**: 
- Profile data: `context.globalState` (VS Code persistent storage)
- Passwords: `context.secrets` (VS Code Secret Storage API - encrypted)

#### 3.2.2 DagSummary
```typescript
interface DagSummary {
  dagId: string;                 // DAG identifier
  paused: boolean;               // Pause state
  schedule: string | null;       // Schedule interval or timetable
  owner: string;                 // DAG owner
  tags: string[];                // DAG tags
  lastRunState?: 'success' | 'failed' | 'running' | 'queued' | 'unknown';
  lastRunTime?: string;          // ISO timestamp
  nextRunTime?: string;          // ISO timestamp
}
```

#### 3.2.3 DagRun
```typescript
interface DagRun {
  dagRunId: string;              // Run identifier
  dagId: string;                 // Parent DAG ID
  state: string;                 // Run state (success, failed, running, etc.)
  executionDate: string;         // Logical date (ISO timestamp)
  startDate?: string;            // Actual start time
  endDate?: string;              // Actual end time
  conf?: any;                    // Configuration JSON
}
```

#### 3.2.4 TaskInstance
```typescript
interface TaskInstance {
  taskId: string;                // Task identifier
  dagId: string;                 // Parent DAG ID
  dagRunId: string;              // Parent run ID
  state: 'success' | 'failed' | 'running' | 'queued' | 'skipped' | 
         'upstream_failed' | 'up_for_retry';
  tryNumber: number;             // Current attempt number
  startDate?: string;            // Start time
  endDate?: string;              // End time
  duration?: number;             // Duration in seconds
  mapIndex?: number;             // For mapped tasks
}
```

#### 3.2.5 Variable
```typescript
interface Variable {
  key: string;                   // Variable key
  value: string;                 // Variable value
  description?: string;          // Optional description
}
```

#### 3.2.6 Pool
```typescript
interface Pool {
  name: string;                  // Pool name
  slots: number;                 // Total slots
  occupiedSlots: number;         // Currently occupied
  runningSlots: number;          // Running tasks
  queuedSlots: number;           // Queued tasks
  description?: string;          // Optional description
}
```

#### 3.2.7 Connection
```typescript
interface Connection {
  connectionId: string;          // Connection identifier
  connType: string;              // Connection type (http, postgres, etc.)
  host?: string;                 // Host address
  schema?: string;               // Database schema
  login?: string;                // Login username
  port?: number;                 // Port number
  extra?: string;                // Extra configuration (JSON string)
}
```

#### 3.2.8 HealthStatus
```typescript
interface HealthStatus {
  metadatabase: { status: string };
  scheduler: { 
    status: string; 
    latestHeartbeat?: string;    // ISO timestamp
  };
  triggerer?: { status: string };      // Optional (Airflow 2.2+)
  dagProcessor?: { status: string };   // Optional (Airflow 2.3+)
}
```

---

### 3.3 Logger Utility (`utils/logger.ts`)

#### 3.3.1 Logger Architecture
```typescript
class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug';
  
  static initialize(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Airflow Extension');
    context.subscriptions.push(this.outputChannel);
  }
  
  static debug(message: string, ...args: any[]) { /* ... */ }
  static info(message: string, ...args: any[]) { /* ... */ }
  static warn(message: string, ...args: any[]) { /* ... */ }
  static error(message: string, error?: any, ...args: any[]) { /* ... */ }
  static show() { this.outputChannel?.show(); }
}
```

#### 3.3.2 Log Format
```
[2024-01-15T10:30:45.123Z] [INFO] ServerManager.addServer: API version detected {"apiMode":"stable-v2"}
[2024-01-15T10:30:45.456Z] [DEBUG] HTTP Request {"method":"GET","url":"/api/v2/dags","auth":"Basic Auth"}
[2024-01-15T10:30:45.789Z] [ERROR] DagDetailsPanel.handleMessage: Failed {"message":"Network error","stack":"..."}
```

#### 3.3.3 Usage Pattern
```typescript
// Info logging
Logger.info('User action initiated', { action: 'triggerDag', dagId: 'example_dag' });

// Debug logging
Logger.debug('HTTP Request', { method: 'POST', url: '/api/v1/dags/example_dag/dagRuns' });

// Error logging with error object
Logger.error('Failed to trigger DAG', error, { dagId: 'example_dag' });

// Show output panel
Logger.show();
```

---

## 4. State Management

### 4.1 VS Code Global State
**Storage Location**: `context.globalState`

**Stored Data**:
```typescript
{
  'airflow.servers': ServerProfile[],      // All server configurations
  'airflow.activeServerId': string         // Currently active server ID
}
```

**Operations**:
```typescript
// Read
const servers = context.globalState.get<ServerProfile[]>('airflow.servers', []);

// Write
await context.globalState.update('airflow.servers', servers);

// Delete
await context.globalState.update('airflow.activeServerId', undefined);
```

### 4.2 VS Code Secret Storage
**Storage Location**: `context.secrets` (Encrypted by VS Code)

**Stored Data**:
```typescript
{
  'airflow.password.{serverId}': string    // Password for each server
}
```

**Operations**:
```typescript
// Store
await context.secrets.store(`airflow.password.${serverId}`, password);

// Retrieve
const password = await context.secrets.get(`airflow.password.${serverId}`);

// Delete
await context.secrets.delete(`airflow.password.${serverId}`);
```

### 4.3 In-Memory State
- **Active Server**: Cached in `ServerManager.activeServerId`
- **DAG List**: Cached in `DagsTreeProvider.dags`
- **Webview Panels**: Singleton instances in static Maps

---

## 5. Security Considerations

### 5.1 Credential Storage
- **Passwords**: Stored in VS Code Secret Storage (encrypted at rest)
- **AWS Credentials**: Uses AWS SDK default credential chain (not stored by extension)
- **Tokens**: Generated on-demand for MWAA, not persisted

### 5.2 Data Sanitization
- **Logs**: Sensitive data (passwords, tokens) never logged
- **UI**: Passwords masked in input fields
- **Error Messages**: Generic messages shown to users, detailed errors in logs

### 5.3 Network Security
- **HTTPS**: Recommended for self-hosted Airflow
- **Authentication**: Basic Auth or JWT tokens for self-hosted, AWS SigV4 for MWAA
- **Timeout**: 30-second timeout on all HTTP requests

---

## 6. Extension Configuration

### 6.1 package.json Configuration
```json
{
  "contributes": {
    "views": {
      "airflow": [
        { "id": "airflowServers", "name": "Servers" },
        { "id": "airflowDags", "name": "DAGs" },
        { "id": "airflowAdmin", "name": "Admin" }
      ]
    },
    "commands": [
      {
        "command": "airflow.addServer",
        "title": "Airflow: Add Server",
        "icon": "$(add)"
      }
      // ... 25+ commands
    ],
    "menus": {
      "view/item/context": [
        {
          "command": "airflow.triggerDag",
          "when": "view == airflowDags && viewItem == dag",
          "group": "inline"
        }
        // ... context menu items
      ]
    }
  }
}
```

### 6.2 Activation Events
```json
{
  "activationEvents": [
    "onView:airflowServers",
    "onCommand:airflow.addServer"
  ]
}
```

---

**End of Part 1**

**Next**: Part 2 - API Layer & Client Implementation
