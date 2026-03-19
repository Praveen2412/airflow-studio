# Airflow VSCode Extension - Complete Implementation Guide

## Based on Production Reference: airflow-vscode-extension v1.9.9

This document provides a complete, spec-driven implementation guide based on analyzing the production reference implementation.

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Key Learnings from Reference](#key-learnings)
3. [Architecture Decisions](#architecture-decisions)
4. [Implementation Roadmap](#implementation-roadmap)
5. [File Structure](#file-structure)
6. [Dependencies](#dependencies)
7. [Build & Deploy](#build--deploy)

---

## 1. Project Overview

### What We're Building
A VSCode extension that provides complete Airflow management capabilities without leaving the IDE:
- **DAG Management**: List, trigger, pause/unpause, view source
- **Run Monitoring**: Real-time status, history, logs
- **Admin Tools**: Connections, variables, providers, health checks
- **AI Assistant**: 24 language model tools for intelligent DAG management
- **Multi-Server**: Support multiple Airflow instances with quick switching

### Success Metrics (Proven)
- ✅ 1.9.9 releases with 27 versions
- ✅ Supports Airflow 2.x and 3.x
- ✅ 100+ DAGs with pagination
- ✅ Real-time DAG run monitoring
- ✅ AI-powered troubleshooting

---

## 2. Key Learnings from Reference

### 2.1 Architecture Patterns

**Singleton Pattern for Global State:**
```typescript
// Session.ts - Single source of truth
export class Session {
  public static Current: Session;
  public Api: AirflowApi | undefined;
  public Server: ServerConfig | undefined;
  public ServerList: ServerConfig[] = [];
  public Context: vscode.ExtensionContext;
}

// Usage everywhere:
Session.Current.Api.getDagList();
Session.Current.Context.globalState.update('key', value);
```

**Result Wrapper Pattern:**
```typescript
// MethodResult.ts - Consistent error handling
export class MethodResult<T> {
  public isSuccessful: boolean = false;
  public result: T | undefined;
  public error: Error | undefined;
}

// Every API call returns this
const result = await api.getDagList();
if (result.isSuccessful) {
  // Use result.result
} else {
  // Handle result.error
}
```

**Event Bus Pattern:**
```typescript
// MessageHub.ts - Cross-component communication
export function DagTriggered(source: any, dagId: string, dagRunId: string) {
  if (!(source instanceof DagView) && DagView.Current) {
    DagView.Current.goToDagRun(dagId, dagRunId);
  }
  if (!(source instanceof DagTreeView) && DagTreeView.Current) {
    DagTreeView.Current.notifyDagStateWithDagId(dagId, dagRunId, "queued");
  }
}
```

### 2.2 Version Detection Strategy

**Simple URL-Based Detection (Proven Better Than Probing):**
```typescript
private get version(): 'v1' | 'v2' | 'unknown' {
  if (this.config.apiUrl.includes('v1')) { return 'v1'; }
  if (this.config.apiUrl.includes('v2')) { return 'v2'; }
  return 'unknown';
}
```

**Why This Works:**
- Users know their Airflow version
- No extra API calls needed
- Immediate version awareness
- User provides: `http://localhost:8080/api/v1` or `/api/v2`

### 2.3 Authentication Approach

**Airflow v1 (Basic Auth):**
```typescript
headers['Authorization'] = 'Basic ' + encode(`${username}:${password}`);
```

**Airflow v2 (JWT Token):**
```typescript
// POST /auth/token (outside /api/v2 path!)
const response = await fetch(baseUrl + '/auth/token', {
  method: 'POST',
  body: JSON.stringify({ username, password })
});
const token = response.json().access_token;
headers['Authorization'] = 'Bearer ' + token;
```

**Storage:**
- Reference uses GlobalState (simple but less secure)
- **Recommendation**: Use SecretStorage for production

### 2.4 Pagination Strategy

**Fetch All DAGs in Batches:**
```typescript
const allDags: any[] = [];
let offset = 0;
const limit = 100;

while (true) {
  const response = await fetch(`/dags?limit=${limit}&offset=${offset}`);
  const data = await response.json();
  allDags.push(...data.dags);
  
  if (data.dags.length < limit) {
    break; // Last page
  }
  offset += limit;
}
```

**Why This Works:**
- Handles 100+ DAGs seamlessly
- Single loading indicator
- No "Load More" button needed
- User sees complete list immediately

### 2.5 Real-Time Updates

**Polling Pattern for Running DAGs:**
```typescript
// Start polling when DAG is triggered
private startCheckingDagRunStatus() {
  this.dagStatusInterval = setInterval(() => {
    this.refreshRunningDagState();
  }, 10 * 1000); // 10 seconds
}

// Stop when all DAGs complete
if (noDagIsRunning && this.dagStatusInterval) {
  clearInterval(this.dagStatusInterval);
  this.dagStatusInterval = undefined;
}
```

### 2.6 Webview Architecture

**HTML + @vscode-elements (Not React/Vue):**
```typescript
// DagView.ts - Pure HTML with VSCode Web Components
private _getWebviewContent(webview: vscode.Webview): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="module" src="${toolkitUri}"></script>
        <link rel="stylesheet" href="${styleUri}">
      </head>
      <body>
        <vscode-tabs>
          <vscode-tab-header>RUN</vscode-tab-header>
          <vscode-tab-panel>
            <vscode-button id="trigger-dag">Trigger</vscode-button>
          </vscode-tab-panel>
        </vscode-tabs>
      </body>
    </html>
  `;
}
```

**Message Passing:**
```typescript
// Extension → Webview
webview.postMessage({ command: 'update', data: dagRun });

// Webview → Extension
webview.onDidReceiveMessage(message => {
  switch (message.command) {
    case 'trigger-dag':
      this.triggerDag(message.config);
      break;
  }
});
```

### 2.7 AI Integration

**Chat Participant + Language Model Tools:**
```typescript
// Register chat participant
const participant = vscode.chat.createChatParticipant(
  'airflow-ext.participant', 
  this.aIHandler
);

// Register 24 tools
vscode.lm.registerTool('trigger_dag_run', new TriggerDagRunTool());
vscode.lm.registerTool('get_failed_runs', new GetFailedRunsTool());
// ... 22 more tools

// Tool execution
const result = await vscode.lm.invokeTool(toolName, { input }, token);
```

**Tool Categories:**
1. **Control** (5 tools): trigger, pause, unpause, cancel
2. **Monitoring** (7 tools): list active/paused, get runs, failed runs
3. **Analysis** (4 tools): analyze latest run, get details, source code
4. **Navigation** (8 tools): open views, go to logs, connections, etc.

---

## 3. Architecture Decisions

### 3.1 Why Singleton Pattern?

**Problem**: Multiple components need access to API client and state
**Solution**: Single Session instance accessible via `Session.Current`

**Benefits:**
- No prop drilling
- Consistent state across extension
- Easy to test (mock Session.Current)
- Matches VSCode extension lifecycle

### 3.2 Why GlobalState Over SecretStorage?

**Reference Choice**: GlobalState for simplicity
**Production Recommendation**: SecretStorage

**Migration Path:**
```typescript
// Phase 1: Keep GlobalState for non-sensitive data
context.globalState.update('serverList', servers);

// Phase 2: Move passwords to SecretStorage
await context.secrets.store('airflow.password', password);
```

### 3.3 Why No React/Vue for Webviews?

**Reference Choice**: Plain HTML + @vscode-elements

**Reasons:**
- Smaller bundle size
- Faster load times
- Native VSCode theming
- No build complexity
- Direct VSCode API integration

**When to Use React:**
- Complex state management needed
- Reusable component library
- Team familiar with React

### 3.4 Why Polling Over WebSockets?

**Reference Choice**: 10-second polling for running DAGs

**Reasons:**
- Airflow doesn't provide WebSocket API
- Polling is simpler to implement
- 10s interval is acceptable for DAG monitoring
- Automatic cleanup when DAGs complete

---

## 4. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal**: Basic extension with DAG list and trigger

**Tasks:**
1. Project setup (TypeScript, webpack, package.json)
2. Session singleton with GlobalState
3. AirflowApi class with version detection
4. Basic auth (v1) and JWT (v2)
5. DagTreeView with DAG list
6. Trigger DAG command
7. Connection wizard

**Deliverables:**
- Extension activates
- User can add Airflow server
- DAG list displays
- Trigger DAG works

### Phase 2: Core Features (Week 3-4)

**Goal**: Complete DAG management

**Tasks:**
1. Pause/Unpause DAG
2. DAG run history
3. Task instances list
4. Task logs viewer
5. Source code viewer
6. Real-time status updates (polling)
7. Filtering (name, owner, tags, favorites)

**Deliverables:**
- Full DAG lifecycle management
- Real-time monitoring
- Log viewing

### Phase 3: Webviews (Week 5-6)

**Goal**: Rich UI for DAG details

**Tasks:**
1. DagView with 4 tabs (Run, Tasks, Info, History)
2. DagLogView with streaming logs
3. Admin views (Connections, Variables, etc.)
4. Report views (Daily runs, History)
5. Webview message passing
6. State synchronization

**Deliverables:**
- Complete webview UI
- Admin panel
- Reports

### Phase 4: AI Integration (Week 7-8)

**Goal**: AI-powered DAG management

**Tasks:**
1. Chat participant registration
2. 24 language model tools
3. Context injection (code, logs, metadata)
4. Tool result streaming
5. Skills installation
6. Error handling

**Deliverables:**
- Working AI assistant
- All 24 tools functional
- Context-aware responses

### Phase 5: Polish & Release (Week 9-10)

**Goal**: Production-ready extension

**Tasks:**
1. Error handling improvements
2. Telemetry (opt-in)
3. Documentation
4. Testing (unit, integration)
5. CI/CD pipeline
6. Marketplace listing

**Deliverables:**
- Published extension
- Complete documentation
- Test coverage >70%

---

## 5. File Structure

```
airflow-vscode-extension/
├── src/
│   ├── extension.ts                 # Entry point
│   ├── common/
│   │   ├── Api.ts                   # AirflowApi class
│   │   ├── Session.ts               # Singleton state manager
│   │   ├── MethodResult.ts          # Result wrapper
│   │   ├── MessageHub.ts            # Event bus
│   │   ├── Types.ts                 # TypeScript interfaces
│   │   ├── UI.ts                    # UI utilities
│   │   ├── Telemetry.ts             # Analytics
│   │   └── Skills.ts                # AI skills installer
│   ├── dag/
│   │   ├── DagTreeView.ts           # Main DAG explorer
│   │   ├── DagTreeItem.ts           # TreeView item
│   │   ├── DagTreeDataProvider.ts   # Data provider
│   │   └── DagView.ts               # DAG detail webview
│   ├── report/
│   │   ├── ReportTreeView.ts        # Reports sidebar
│   │   ├── DagLogView.ts            # Log viewer webview
│   │   ├── DagRunView.ts            # Run history webview
│   │   └── DailyDagRunView.ts       # Daily runs webview
│   ├── admin/
│   │   ├── AdminTreeView.ts         # Admin sidebar
│   │   ├── ConnectionsView.ts       # Connections webview
│   │   ├── VariablesView.ts         # Variables webview
│   │   ├── ProvidersView.ts         # Providers webview
│   │   ├── ConfigsView.ts           # Config webview
│   │   ├── PluginsView.ts           # Plugins webview
│   │   └── ServerHealthView.ts      # Health webview
│   ├── language_tools/
│   │   ├── AIHandler.ts             # Chat participant
│   │   ├── AirflowClientAdapter.ts  # API adapter for tools
│   │   ├── TriggerDagRunTool.ts     # Tool implementation
│   │   ├── GetFailedRunsTool.ts     # Tool implementation
│   │   └── ... (22 more tools)
│   └── test/
│       ├── suite/
│       └── runTest.ts
├── media/
│   ├── main.js                      # Webview JavaScript
│   ├── style.css                    # Webview styles
│   └── *.png                        # Icons
├── skills/
│   └── airflow/
│       └── SKILL.md                 # AI skill definitions
├── package.json                     # Extension manifest
├── tsconfig.json                    # TypeScript config
├── webpack.config.js                # Webpack config
├── .vscodeignore                    # Package exclusions
└── README.md                        # User documentation
```

---

## 6. Dependencies

### Production Dependencies
```json
{
  "@vscode-elements/elements": "^2.3.1",  // Webview components
  "@vscode/codicons": "^0.0.43",          // Icons
  "@vscode/extension-telemetry": "^1.2.0", // Analytics
  "ajv": "^8.17.1",                       // JSON validation
  "base-64": "^1.0.0",                    // Basic auth encoding
  "node-fetch": "^3.3.2",                 // HTTP client (ESM)
  "tmp": "^0.2.5"                         // Temp file creation
}
```

### Dev Dependencies
```json
{
  "@types/base-64": "^1.0.2",
  "@types/node": "24.x",
  "@types/vscode": "^1.104.0",
  "@typescript-eslint/eslint-plugin": "^8.48.0",
  "@typescript-eslint/parser": "^8.48.0",
  "eslint": "^9.39.1",
  "ts-loader": "^9.5.4",
  "typescript": "^5.9.3",
  "webpack": "^5.103.0",
  "webpack-cli": "^6.0.1"
}
```

---

## 7. Build & Deploy

### Development
```bash
# Install dependencies
npm install

# Watch mode (auto-rebuild on changes)
npm run watch

# Run extension
# Press F5 in VSCode to launch Extension Development Host
```

### Testing
```bash
# Unit tests
npm test

# Lint
npm run lint

# Format
npm run format
```

### Production Build
```bash
# Build optimized bundle
npm run package

# Create VSIX
vsce package

# Publish to marketplace
vsce publish
```

### CI/CD (GitHub Actions)
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run package
```

---

## 8. Next Steps

1. **Review Updated Specs**: Read TECHNICAL_SPEC_PART_1_UPDATED.md
2. **Set Up Project**: Initialize with package.json and tsconfig.json
3. **Implement Phase 1**: Session + AirflowApi + DagTreeView
4. **Test Incrementally**: Test each feature as you build
5. **Iterate**: Use reference code as guide, adapt as needed

---

## 9. Key Takeaways

### What Makes This Extension Successful

1. **Simple Architecture**: Singleton pattern, no over-engineering
2. **Version Awareness**: URL-based detection, no probing
3. **Pagination**: Fetch all DAGs upfront, no "Load More"
4. **Real-Time Updates**: Polling for running DAGs only
5. **Webview Simplicity**: HTML + VSCode elements, no framework
6. **AI Integration**: 24 focused tools, context-aware
7. **Multi-Server**: Easy switching between Airflow instances
8. **Error Handling**: MethodResult pattern, user-friendly messages

### What to Avoid

1. ❌ Complex state management libraries
2. ❌ Over-abstraction (keep it simple)
3. ❌ Probing for version detection
4. ❌ WebSockets (Airflow doesn't support it)
5. ❌ Heavy frameworks for webviews
6. ❌ Storing passwords in settings.json

### What to Improve from Reference

1. ✅ Use SecretStorage instead of GlobalState for passwords
2. ✅ Add unit tests (reference has minimal tests)
3. ✅ Add integration tests with Docker Airflow
4. ✅ Improve error messages with remediation steps
5. ✅ Add retry logic with exponential backoff
6. ✅ Add request timeout handling

---

**Ready to build? Start with Phase 1 and follow the roadmap!**
