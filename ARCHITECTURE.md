# Project Architecture

## Overview

This project follows **Clean Architecture** principles with clear separation of concerns, dependency inversion, and testability.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                    │
│  (Views, Providers, Tree Items - UI Components)         │
└────────────────────┬────────────────────────────────────┘
                     │ depends on
┌────────────────────▼────────────────────────────────────┐
│                     Core Layer                           │
│  (Services, Models, Interfaces - Business Logic)        │
└────────────────────┬────────────────────────────────────┘
                     │ depends on
┌────────────────────▼────────────────────────────────────┐
│                Infrastructure Layer                      │
│  (API Clients, Storage, Logging - External Concerns)    │
└─────────────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── core/                           # Business logic (no external dependencies)
│   ├── services/                   # Business services
│   │   ├── DagService.ts          # DAG operations
│   │   ├── ConnectionService.ts   # Connection management
│   │   └── AirflowService.ts      # Airflow operations
│   ├── models/                     # Domain models
│   │   ├── Dag.ts                 # DAG entity
│   │   ├── DagRun.ts              # DAG run entity
│   │   └── Server.ts              # Server entity
│   └── interfaces/                 # Contracts (dependency inversion)
│       ├── IAirflowClient.ts      # API client interface
│       └── IStateManager.ts       # State management interface
│
├── infrastructure/                 # External concerns
│   ├── api/                       # API implementations
│   │   ├── AirflowApiClient.ts   # Self-hosted Airflow client
│   │   └── MwaaApiClient.ts      # AWS MWAA client
│   ├── storage/                   # Persistence
│   │   └── StateManager.ts       # VSCode state wrapper
│   └── logging/                   # Logging
│       └── Logger.ts              # Centralized logger
│
├── presentation/                   # UI layer
│   ├── views/                     # Tree views (controllers)
│   │   ├── DagTreeView.ts        # DAG tree controller
│   │   └── AdminTreeView.ts      # Admin tree controller
│   ├── providers/                 # Data providers
│   │   └── DagTreeDataProvider.ts # DAG tree data provider
│   └── items/                     # Tree items (view models)
│       └── DagTreeItem.ts        # DAG tree item
│
├── shared/                        # Shared utilities
│   ├── constants/                # Constants
│   │   └── Commands.ts           # Command IDs
│   ├── utils/                    # Utilities
│   │   └── DateUtils.ts          # Date/JSON utilities
│   └── events/                   # Event system
│       └── EventBus.ts           # Pub/sub event bus
│
└── extension.ts                   # Entry point
```

## Design Principles

### 1. Separation of Concerns
- **Presentation**: UI logic only (views, providers, items)
- **Core**: Business logic only (services, models)
- **Infrastructure**: External dependencies (API, storage, logging)

### 2. Dependency Inversion
- Core layer defines interfaces
- Infrastructure implements interfaces
- Presentation depends on core abstractions, not implementations

### 3. Single Responsibility
- Each class has one reason to change
- Services handle business logic
- Models encapsulate data and behavior
- Views handle UI interactions

### 4. Open/Closed Principle
- Open for extension (interfaces, abstract classes)
- Closed for modification (stable core)

### 5. Dependency Injection
- Dependencies injected via constructors
- No static singletons (except utilities)
- Easy to test and mock

## Key Components

### Core Layer

#### Services
Business logic orchestration:
```typescript
class DagService {
  constructor(private client: IAirflowClient) {}
  
  async triggerDag(dag: Dag, config?: string): Promise<boolean> {
    // Validation
    // Business rules
    // API calls
    // Event emission
  }
}
```

#### Models
Domain entities with encapsulated behavior:
```typescript
class Dag {
  isRunning(): boolean { ... }
  matchesFilter(filter: string): boolean { ... }
  updateState(runId: string, state: DagState): void { ... }
}
```

#### Interfaces
Contracts for dependency inversion:
```typescript
interface IAirflowClient {
  getDags(): Promise<ApiResponse<any[]>>;
  triggerDag(dagId: string): Promise<ApiResponse<any>>;
}
```

### Infrastructure Layer

#### API Clients
External API communication:
```typescript
class AirflowApiClient implements IAirflowClient {
  async getDags(): Promise<ApiResponse<any[]>> {
    // HTTP calls
    // Error handling
    // Response mapping
  }
}
```

#### State Manager
Persistence abstraction:
```typescript
class StateManager implements IStateManager {
  get<T>(key: string): T | undefined { ... }
  async set<T>(key: string, value: T): Promise<void> { ... }
}
```

#### Logger
Centralized logging:
```typescript
class Logger {
  info(message: string, data?: any): void { ... }
  error(message: string, error?: Error): void { ... }
}
```

### Presentation Layer

#### Views
UI controllers:
```typescript
class DagTreeView {
  constructor(
    private dagService: DagService,
    private stateManager: IStateManager
  ) {}
  
  async triggerDag(item: DagTreeItem): Promise<void> {
    // Get model from item
    // Call service
    // Update UI
  }
}
```

#### Providers
Data providers for tree views:
```typescript
class DagTreeDataProvider implements vscode.TreeDataProvider<DagTreeItem> {
  getChildren(element?: DagTreeItem): Thenable<DagTreeItem[]> { ... }
  getTreeItem(element: DagTreeItem): vscode.TreeItem { ... }
}
```

#### Items
View models:
```typescript
class DagTreeItem extends vscode.TreeItem {
  constructor(private dag: Dag) {
    super(dag.id);
    this.updateUI();
  }
}
```

### Shared Layer

#### Event Bus
Decoupled communication:
```typescript
eventBus.emit(Events.DAG_TRIGGERED, dagId, runId);
eventBus.on(Events.DAG_TRIGGERED, (dagId, runId) => { ... });
```

#### Constants
Eliminate magic strings:
```typescript
export const Commands = {
  DAG: {
    TRIGGER: 'dagTreeView.triggerDag',
    PAUSE: 'dagTreeView.pauseDAG',
  }
} as const;
```

## Benefits

### Testability
- Easy to mock dependencies
- Unit test services without UI
- Integration test with fake implementations

### Maintainability
- Clear boundaries between layers
- Easy to locate and modify code
- Changes isolated to specific layers

### Scalability
- Add new features without modifying existing code
- Swap implementations (e.g., different API clients)
- Extend functionality through interfaces

### Readability
- Self-documenting structure
- Clear naming conventions
- Consistent patterns

## Migration Path

### Phase 1: Infrastructure (Current)
- ✅ Create new directory structure
- ✅ Implement Logger
- ✅ Implement StateManager
- ✅ Implement EventBus
- ✅ Create constants

### Phase 2: Core
- ✅ Create domain models (Dag, Server)
- ✅ Create interfaces
- ✅ Implement DagService
- ⏳ Implement ConnectionService
- ⏳ Refactor API client to implement interface

### Phase 3: Presentation
- ⏳ Refactor DagTreeView to use services
- ⏳ Refactor DagTreeItem to use models
- ⏳ Update providers to use new structure

### Phase 4: Cleanup
- ⏳ Remove old files
- ⏳ Update imports
- ⏳ Add tests
- ⏳ Update documentation

## Best Practices

### DO
- ✅ Inject dependencies via constructor
- ✅ Use interfaces for abstractions
- ✅ Keep models immutable where possible
- ✅ Use events for cross-cutting concerns
- ✅ Log at appropriate levels
- ✅ Handle errors at boundaries
- ✅ Use constants for magic strings

### DON'T
- ❌ Use static singletons for stateful objects
- ❌ Mix UI logic with business logic
- ❌ Directly access VSCode APIs in core layer
- ❌ Use magic strings
- ❌ Swallow errors silently
- ❌ Create circular dependencies
- ❌ Expose internal implementation details

## Testing Strategy

### Unit Tests
- Test services with mocked dependencies
- Test models in isolation
- Test utilities with various inputs

### Integration Tests
- Test API clients with mock server
- Test state manager with mock context
- Test event bus communication

### E2E Tests
- Test complete workflows
- Test UI interactions
- Test error scenarios

## Performance Considerations

- Lazy load DAGs
- Cache API responses
- Debounce UI updates
- Use pagination for large lists
- Dispose resources properly

## Security Considerations

- Never log credentials
- Sanitize user inputs
- Validate API responses
- Use secure storage for sensitive data
- Follow principle of least privilege
