# Architecture

## Overview

The extension follows a provider-based adapter pattern with clear separation between UI, business logic, and API communication layers.

## Core Components

### 1. Extension Entry Point
- `extension.ts` - Activation, command registration, context management

### 2. API Layer

#### Abstraction
- `IAirflowClient` interface - Normalized API contract
- Provider implementations:
  - `AirflowStableClient` - Self-hosted Airflow REST API
  - `MwaaClient` - AWS MWAA adapter

#### Core Methods
```typescript
listDags()
getDag(dagId)
listDagRuns(dagId)
triggerDagRun(dagId, conf)
pauseDag(dagId, paused)
deleteDag(dagId)
listTaskInstances(dagId, dagRunId)
getTaskLogs(dagId, taskId, dagRunId, tryNumber, mapIndex)
clearTaskInstances(...)
listVariables() / upsertVariable() / deleteVariable()
listPools() / upsertPool() / deletePool()
listConnections() / upsertConnection() / deleteConnection()
getHealth()
```

### 3. Data Models

#### ServerProfile
```typescript
{
  id: string
  name: string
  type: 'self-hosted' | 'mwaa'
  baseUrl: string
  awsRegion?: string
  authType: string
  apiMode: 'stable-v1' | 'stable-v2' | 'auto'
  defaultRefreshInterval: number
  headers?: Record<string, string>
  lastHealthStatus: 'unknown' | 'healthy' | 'degraded' | 'down'
}
```

#### DAG Summary
```typescript
{
  dagId: string
  paused: boolean
  schedule: string
  owner: string
  tags: string[]
  lastRunState: 'success' | 'failed' | 'running' | 'queued' | 'unknown'
}
```

#### Task Instance
```typescript
{
  taskId: string
  state: string
  tryNumber: number
  startDate: string
  endDate: string
  duration: number
  mapIndex?: number
}
```

### 4. UI Components

#### Tree Providers (Sidebar)
- `ServersTreeProvider` - Server list and management
- `DagsTreeProvider` - DAG hierarchy
- `AdminTreeProvider` - Variables, pools, connections

#### Webviews (Detail Views)
- DAG detail page
- Trigger DAG form
- Task log viewer
- Variables/Pools/Connections editors
- Health check dashboard

#### Status Bar
- Active server indicator
- Connection state
- Refresh status

### 5. State Management

- `ServerManager` - Server profile CRUD and active server tracking
- `StateManager` - Cache for DAGs, runs, tasks
- VS Code Secret Storage - Credential storage

### 6. Command Handlers

All commands registered in `extension.ts` and delegated to appropriate managers:
- Server commands → ServerManager
- DAG commands → DagManager
- Admin commands → AdminManager

## Data Flow

```
User Action → Command → Manager → API Client → HTTP Request
                                        ↓
UI Update ← State Update ← Response Parser ← HTTP Response
```

## Error Handling

- All API calls wrapped in try-catch
- User-friendly error messages via VS Code notifications
- Debug mode for raw error details
- Retry logic for transient failures
- Rate limiting protection

## Security

- Credentials never logged
- Secret storage via VS Code API
- Secrets masked in UI
- Confirmation for destructive operations
- Read-only mode support

## Performance Optimizations

- Lazy loading for heavy data
- Metadata caching with TTL
- Incremental refresh for large lists
- Debounced polling for logs
- Pagination support where available

## Extension Structure

```
src/
├── extension.ts              # Entry point
├── api/
│   ├── IAirflowClient.ts    # Interface
│   ├── AirflowStableClient.ts
│   ├── MwaaClient.ts
│   └── HttpClient.ts        # Shared request layer
├── models/
│   ├── ServerProfile.ts
│   ├── Dag.ts
│   ├── TaskInstance.ts
│   └── Admin.ts
├── providers/
│   ├── ServersTreeProvider.ts
│   ├── DagsTreeProvider.ts
│   └── AdminTreeProvider.ts
├── managers/
│   ├── ServerManager.ts
│   ├── DagManager.ts
│   └── AdminManager.ts
├── webviews/
│   ├── DagDetailView.ts
│   ├── TriggerDagView.ts
│   ├── LogViewer.ts
│   └── HealthCheckView.ts
└── utils/
    ├── ErrorHandler.ts
    ├── Logger.ts
    └── Validator.ts
```

## Build Order (MVP)

1. ✅ Project setup and base structure
2. ✅ Server profiles and authentication
3. ✅ DAG list view
4. ✅ DAG detail and trigger
5. 🟡 Task instances and log viewer
6. ✅ Pause/unpause/delete operations
7. 🟡 Variables CRUD
8. 🟡 Pools CRUD
9. ✅ Health check
10. 🟡 Connections CRUD

## Technology Stack

- TypeScript
- VS Code Extension API
- Node.js axios for HTTP
- AWS SDK (for MWAA)
- VS Code Webview API for rich UI

## Development Notes

### Code Style
- Use TypeScript strict mode
- Keep functions focused and small
- Add error handling for all API calls
- Use async/await over promises
- Follow existing patterns

### Testing
- Manual testing: Launch extension (F5), add test server, verify operations
- Check Output panel → "Extension Host" for debugging
- Set breakpoints in TypeScript files

### Common Issues
- **Extension not loading**: Run `npm run compile`, check `out/` directory exists
- **API errors**: Verify server URL/credentials, check Airflow API version
- **TypeScript errors**: Run `npm install`, check `tsconfig.json`
