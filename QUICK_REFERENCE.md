# Quick Reference Guide

## Project Structure at a Glance

```
src/
├── core/                    ← Business Logic (No external dependencies)
│   ├── services/           ← Orchestrate business operations
│   ├── models/             ← Domain entities with behavior
│   └── interfaces/         ← Contracts for dependency inversion
│
├── infrastructure/          ← External Dependencies
│   ├── api/               ← HTTP clients, AWS SDK
│   ├── storage/           ← VSCode state, file system
│   └── logging/           ← Logging implementation
│
├── presentation/            ← UI Layer (VSCode specific)
│   ├── views/             ← Tree view controllers
│   ├── providers/         ← Data providers for trees
│   └── items/             ← Tree item view models
│
└── shared/                  ← Cross-cutting Utilities
    ├── constants/         ← Command IDs, strings
    ├── events/            ← Event bus for pub/sub
    └── utils/             ← Helper functions
```

## Where to Add New Code

### Adding a New DAG Operation
1. Add method to `IAirflowClient` interface
2. Implement in API client (`AirflowApiClient`)
3. Add business logic to `DagService`
4. Call from `DagTreeView`

### Adding a New View
1. Create view in `presentation/views/`
2. Create provider in `presentation/providers/`
3. Create items in `presentation/items/`
4. Register in `extension.ts`

### Adding a New Model
1. Create in `core/models/`
2. Add business methods to model
3. Create service if needed in `core/services/`

### Adding a New Utility
1. Create in `shared/utils/`
2. Export as static methods or functions
3. Import where needed

## Common Patterns

### Service Pattern
```typescript
export class DagService {
  constructor(private client: IAirflowClient) {}
  
  async operation(dag: Dag): Promise<boolean> {
    // 1. Validate
    // 2. Call API
    // 3. Update model
    // 4. Emit event
    // 5. Return result
  }
}
```

### Model Pattern
```typescript
export class Dag {
  constructor(private data: DagData) {}
  
  // Getters for data access
  get id(): string { return this.data.dag_id; }
  
  // Business methods
  isRunning(): boolean { ... }
  matchesFilter(filter: string): boolean { ... }
  
  // State mutations
  updateState(runId: string, state: DagState): void { ... }
}
```

### View Pattern
```typescript
export class DagTreeView {
  constructor(
    private dagService: DagService,
    private stateManager: IStateManager,
    private eventBus: EventBus
  ) {
    this.setupEventListeners();
  }
  
  async handleCommand(item: DagTreeItem): Promise<void> {
    try {
      const dag = item.getDag();
      await this.dagService.operation(dag);
      this.showSuccess();
    } catch (error) {
      this.showError(error);
    }
  }
}
```

### Event Pattern
```typescript
// Emit
eventBus.emit(Events.DAG_TRIGGERED, dagId, runId);

// Listen
eventBus.on(Events.DAG_TRIGGERED, (dagId, runId) => {
  // Handle event
});

// Cleanup
eventBus.off(Events.DAG_TRIGGERED, handler);
```

## Dependency Flow

```
extension.ts
    ↓ creates
StateManager, Logger, EventBus
    ↓ creates
AirflowApiClient (implements IAirflowClient)
    ↓ injects into
DagService
    ↓ injects into
DagTreeView
    ↓ uses
DagTreeDataProvider → DagTreeItem
```

## Key Files

| File | Purpose | Layer |
|------|---------|-------|
| `extension.ts` | Entry point, DI setup | Root |
| `Commands.ts` | All command IDs | Shared |
| `EventBus.ts` | Pub/sub communication | Shared |
| `Logger.ts` | Centralized logging | Infrastructure |
| `StateManager.ts` | State persistence | Infrastructure |
| `IAirflowClient.ts` | API contract | Core |
| `Dag.ts` | DAG domain model | Core |
| `DagService.ts` | DAG business logic | Core |
| `DagTreeView.ts` | DAG UI controller | Presentation |

## Testing

### Unit Test a Service
```typescript
describe('DagService', () => {
  let service: DagService;
  let mockClient: jest.Mocked<IAirflowClient>;
  
  beforeEach(() => {
    mockClient = {
      triggerDag: jest.fn(),
      // ... other methods
    };
    service = new DagService(mockClient);
  });
  
  it('should trigger dag', async () => {
    mockClient.triggerDag.mockResolvedValue({
      success: true,
      data: { dag_run_id: '123', state: 'queued' }
    });
    
    const dag = new Dag(mockDagData);
    const result = await service.triggerDag(dag);
    
    expect(result).toBe(true);
    expect(dag.latestRunId).toBe('123');
  });
});
```

### Unit Test a Model
```typescript
describe('Dag', () => {
  it('should detect running state', () => {
    const dag = new Dag(mockDagData);
    dag.updateState('run-1', 'running');
    
    expect(dag.isRunning()).toBe(true);
  });
  
  it('should match filter', () => {
    const dag = new Dag({ ...mockDagData, dag_id: 'my-dag' });
    
    expect(dag.matchesFilter('my')).toBe(true);
    expect(dag.matchesFilter('other')).toBe(false);
  });
});
```

## Common Tasks

### Add a New Command
1. Add to `Commands.ts`
2. Register in `package.json` contributes.commands
3. Register in `extension.ts`
4. Implement in view

### Add a New Event
1. Add to `Events` in `EventBus.ts`
2. Emit in service
3. Listen in view

### Add Logging
```typescript
import { Logger } from '../infrastructure/logging/Logger';

const logger = Logger.getInstance();
logger.info('Operation started');
logger.error('Operation failed', error);
```

### Save State
```typescript
await stateManager.set('key', value);
const value = stateManager.get<Type>('key');
```

### Show Notification
```typescript
vscode.window.showInformationMessage('Success!');
vscode.window.showErrorMessage('Error!');
vscode.window.showWarningMessage('Warning!');
```

## Anti-Patterns to Avoid

❌ **Static Singletons for Stateful Objects**
```typescript
// Bad
class Session {
  static Current: Session;
}
```

❌ **Mixing Layers**
```typescript
// Bad - UI logic in service
class DagService {
  async trigger() {
    vscode.window.showMessage('Triggered'); // ❌
  }
}
```

❌ **Magic Strings**
```typescript
// Bad
vscode.commands.registerCommand('dagTreeView.trigger', ...); // ❌

// Good
vscode.commands.registerCommand(Commands.DAG.TRIGGER, ...); // ✅
```

❌ **Direct API Calls from Views**
```typescript
// Bad
class DagTreeView {
  async trigger() {
    await fetch('http://airflow/api/...'); // ❌
  }
}
```

## Best Practices

✅ **Dependency Injection**
```typescript
constructor(private service: DagService) {}
```

✅ **Interface Abstractions**
```typescript
constructor(private client: IAirflowClient) {}
```

✅ **Event-Driven Communication**
```typescript
eventBus.emit(Events.DAG_TRIGGERED, dagId);
```

✅ **Centralized Logging**
```typescript
logger.info('Operation completed');
```

✅ **Error Handling at Boundaries**
```typescript
try {
  await service.operation();
} catch (error) {
  logger.error('Failed', error);
  vscode.window.showErrorMessage(error.message);
}
```

## Resources

- **ARCHITECTURE.md**: Detailed architecture documentation
- **MIGRATION.md**: Migration guide and examples
- **README.md**: User-facing documentation
