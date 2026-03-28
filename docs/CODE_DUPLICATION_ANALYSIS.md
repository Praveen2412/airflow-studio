# Code Duplication Analysis

## Summary

**Status**: ⚠️ **Minor Duplications Found** (Non-Critical)

The codebase has **minimal code duplication** with most duplicates being **intentional and acceptable** for this type of architecture. However, there are a few areas where refactoring could improve maintainability.

---

## Duplication Analysis

### 1. ✅ **Acceptable Duplications** (By Design)

#### API Client Methods (AirflowStableClient vs AirflowV2Client)
- **Location**: `src/api/AirflowStableClient.ts` vs `src/api/AirflowV2Client.ts`
- **Duplication**: ~30 similar methods implementing `IAirflowClient`
- **Reason**: Different API versions (v1 vs v2) with different endpoints and payloads
- **Status**: ✅ **Acceptable** - This is the Strategy Pattern in action

**Example**:
```typescript
// v1 endpoint
await this.http.get(`/api/v1/dags/${dagId}`)

// v2 endpoint  
await this.http.get(`/api/v2/dags/${dagId}`)
```

**Why Acceptable**:
- Different API contracts
- Different response structures
- Different error handling needs
- Separation allows independent evolution

---

### 2. ⚠️ **Minor Duplications** (Could Be Refactored)

#### A. HTML Escaping Functions (4 instances)
- **Location**: 
  - `webviews/AdminPanels.ts:81`
  - `webviews/DagDetailsPanel.ts:600`
  - `webviews/DagDetailsPanel.ts:614`
  - `webviews/ServerDetailsPanel.ts:495`

**Current Code**:
```typescript
// Duplicated in 4 files
function esc(v: any): string {
  return String(v ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
```

**Impact**: Low (small function, rarely changes)
**Priority**: Low
**Recommendation**: Extract to `src/utils/htmlUtils.ts`

---

#### B. Upsert Pattern (3 instances)
- **Location**: 
  - `AirflowStableClient.upsertVariable()`
  - `AirflowStableClient.upsertPool()`
  - `AirflowStableClient.upsertConnection()`
  - `AirflowV2Client.upsertVariable()`
  - `AirflowV2Client.upsertPool()`
  - `AirflowV2Client.upsertConnection()`

**Current Pattern**:
```typescript
async upsertVariable(key: string, value: string, description?: string): Promise<void> {
  try {
    try {
      await this.http.patch(`/api/v1/variables/${key}`, { key, value, description });
    } catch (patchError: any) {
      if (patchError.status === 404) {
        await this.http.post('/api/v1/variables', { key, value, description });
      } else {
        throw patchError;
      }
    }
    Logger.info('AirflowStableClient.upsertVariable: Success', { key });
  } catch (error: any) {
    Logger.error('AirflowStableClient.upsertVariable: Failed', error, { key });
    throw error;
  }
}
```

**Impact**: Medium (repeated 6 times across 2 files)
**Priority**: Medium
**Recommendation**: Extract to base class or utility method

---

#### C. Error Handling Pattern (Repeated ~60 times)
- **Location**: All API client methods
- **Pattern**:
```typescript
try {
  // operation
  Logger.info('Success', { context });
} catch (error: any) {
  Logger.error('Failed', error, { context });
  throw error;
}
```

**Impact**: Low (standard pattern, consistent)
**Priority**: Low
**Recommendation**: Could use decorator pattern, but current approach is clear

---

#### D. Response Mapping Pattern (8 instances per client)
- **Location**: All list methods in API clients
- **Pattern**:
```typescript
return response.dags.map((dag: any) => ({
  dagId: dag.dag_id,
  paused: dag.is_paused,
  // ... more mappings
}));
```

**Impact**: Low (necessary for type safety)
**Priority**: Low
**Recommendation**: Keep as-is (type transformation is necessary)

---

#### E. Panel Singleton Pattern (6 instances)
- **Location**: All webview panels
- **Pattern**:
```typescript
export class VariablesPanel {
  private static instance?: VariablesPanel;
  
  static show(...) {
    if (VariablesPanel.instance) {
      VariablesPanel.instance.panel.reveal();
      return;
    }
    VariablesPanel.instance = new VariablesPanel(...);
  }
  
  private dispose() {
    VariablesPanel.instance = undefined;
    // cleanup
  }
}
```

**Impact**: Low (standard VS Code pattern)
**Priority**: Low
**Recommendation**: Could extract to base class, but current approach is clear

---

## Duplication Metrics

| Category | Instances | Severity | Priority | Recommendation |
|----------|-----------|----------|----------|----------------|
| API Client Methods | 30+ | Low | N/A | Keep (by design) |
| HTML Escaping | 4 | Low | Low | Extract to utility |
| Upsert Pattern | 6 | Medium | Medium | Extract to method |
| Error Handling | 60+ | Low | Low | Keep (clear pattern) |
| Response Mapping | 24+ | Low | Low | Keep (necessary) |
| Panel Singleton | 6 | Low | Low | Keep (clear pattern) |

---

## Refactoring Recommendations

### Priority 1: Extract HTML Utilities (Low Effort, Low Impact)

**Create**: `src/utils/htmlUtils.ts`
```typescript
/**
 * HTML escaping utilities for webviews
 */

/**
 * Escape HTML special characters
 */
export function escapeHtml(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escape HTML attribute values
 */
export function escapeAttribute(value: any): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
    .replace(/\n/g, ' ');
}
```

**Update**: All webview files to import and use these functions

---

### Priority 2: Extract Upsert Pattern (Medium Effort, Medium Impact)

**Option A**: Create base HTTP client method
```typescript
// In HttpClient or NativeHttpClient
async upsert<T>(
  getUrl: string,
  patchUrl: string,
  postUrl: string,
  payload: any
): Promise<T> {
  try {
    await this.patch(patchUrl, payload);
  } catch (error: any) {
    if (error.status === 404) {
      return await this.post(postUrl, payload);
    }
    throw error;
  }
}
```

**Option B**: Keep as-is (Recommended)
- Current code is explicit and clear
- Each upsert has slightly different payload structure
- Abstraction might reduce readability

**Recommendation**: **Keep as-is** - The duplication is acceptable given the clarity

---

### Priority 3: Consider Base Panel Class (Low Priority)

**Create**: `src/webviews/BasePanel.ts`
```typescript
export abstract class BasePanel<T> {
  protected static instances = new Map<string, BasePanel<any>>();
  protected panel: vscode.WebviewPanel;
  protected disposables: vscode.Disposable[] = [];
  
  protected constructor(
    protected id: string,
    title: string,
    extensionUri: vscode.Uri
  ) {
    this.panel = vscode.window.createWebviewPanel(
      id, title, vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: false }
    );
    // ... common setup
  }
  
  static show<T extends BasePanel<any>>(
    this: new (...args: any[]) => T,
    id: string,
    ...args: any[]
  ): void {
    const existing = BasePanel.instances.get(id);
    if (existing) {
      existing.panel.reveal();
      return;
    }
    const instance = new this(id, ...args);
    BasePanel.instances.set(id, instance);
  }
  
  protected dispose(): void {
    BasePanel.instances.delete(this.id);
    this.panel.dispose();
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}
```

**Recommendation**: **Low priority** - Current code is clear and explicit

---

## Verdict

### ✅ **Code Duplication: ACCEPTABLE**

The codebase has **minimal problematic duplication**. Most duplications are:

1. **Intentional** (Strategy Pattern for API versions)
2. **Necessary** (Type transformations, error handling)
3. **Clear** (Explicit patterns over abstraction)

### Duplication Score: **8.5/10** (Excellent)

- ✅ No major code duplication issues
- ✅ Most duplication is by design (Strategy Pattern)
- ✅ Patterns are consistent and clear
- ⚠️ Minor opportunities for utility extraction
- ✅ Overall maintainability is high

---

## Recommendations

### Immediate Actions (Optional)
1. ✅ Extract HTML escaping to `htmlUtils.ts` (5 minutes)
2. ✅ Document why API client duplication is intentional (2 minutes)

### Future Considerations (Low Priority)
1. Consider base panel class if adding more panels
2. Consider decorator pattern for error handling if it becomes complex
3. Monitor upsert pattern - refactor if it grows beyond 6 instances

---

## Conclusion

**The code duplication in Airflow Studio is MINIMAL and ACCEPTABLE**. The architecture follows the **Strategy Pattern** correctly, which naturally leads to some duplication between API client implementations. This is a **design choice**, not a code smell.

The few minor duplications (HTML escaping, panel singletons) are **low priority** and don't significantly impact maintainability. The codebase is **well-structured** and **production-ready**.

### Final Assessment: ✅ **NO BLOCKING ISSUES**

The extension can be published as-is. The minor duplications can be addressed in future iterations if needed.

---

*Analysis Date: 2024-03-28*  
*Status: ✅ APPROVED*
