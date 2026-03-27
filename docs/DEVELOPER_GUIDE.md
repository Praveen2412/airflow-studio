# Developer Quick Reference - Optimized Code Patterns

## 🎯 Quick Start

This guide shows you how to use the new utilities and follow best practices in the optimized codebase.

---

## 📦 Available Utilities

### 1. Constants (`src/utils/constants.ts`)

**Import**:
```typescript
import { Constants } from './utils/constants';
```

**Usage**:
```typescript
// Timeouts
setTimeout(() => doSomething(), Constants.WEBVIEW_UPDATE_DELAY);
setInterval(() => healthCheck(), Constants.HEALTH_CHECK_INTERVAL);

// HTTP timeout
axios.create({ timeout: Constants.HTTP_TIMEOUT });

// API limits
const dags = await client.listDags(Constants.DEFAULT_API_LIMIT);
const runs = await client.listDagRuns(dagId, Constants.DEFAULT_DAG_RUN_LIMIT);

// Cache TTL
if (Date.now() - cached.timestamp < Constants.DAG_CACHE_TTL) {
  return cached.data;
}
```

**Available Constants**:
- `HEALTH_CHECK_INTERVAL` - Health check frequency (30s)
- `CLIENT_CACHE_TTL` - API client cache duration (5min)
- `TOKEN_CACHE_TTL` - JWT token cache duration (50min)
- `WEBVIEW_UPDATE_DELAY` - Webview update delay (500ms)
- `DAG_CACHE_TTL` - DAG list cache duration (30s)
- `TASK_REFRESH_DELAY` - Task refresh delay (1s)
- `HTTP_TIMEOUT` - HTTP request timeout (30s)
- `DEFAULT_DAG_RUN_LIMIT` - Default DAG runs to fetch (25)
- `DEFAULT_API_LIMIT` - Default API list limit (100)

---

### 2. Error Handler (`src/utils/errorHandler.ts`)

**Import**:
```typescript
import { ErrorHandler } from './utils/errorHandler';
```

**Pattern 1: Simple Error Handling**
```typescript
try {
  await someOperation();
} catch (error: any) {
  await ErrorHandler.handle(error, 'Operation failed', true);
  // Logs error and shows user message
}
```

**Pattern 2: Wrap Async Operations**
```typescript
const result = await ErrorHandler.wrap(
  () => client.listDags(),
  'Loading DAGs',
  true  // show user message
);

if (!result) {
  // Operation failed, error already handled
  return;
}
```

**Pattern 3: With Result Object**
```typescript
const result = await ErrorHandler.wrapWithResult(
  () => client.triggerDag(dagId),
  'Triggering DAG'
);

if (result.success) {
  console.log('Success:', result.data);
} else {
  console.log('Failed:', result.message);
}
```

**Pattern 4: Silent Error Handling**
```typescript
await ErrorHandler.handle(error, 'Background operation', false);
// Logs error but doesn't show user message
```

---

### 3. Log Parser (`src/utils/logParser.ts`)

**Import**:
```typescript
import { parseLogResponse } from './utils/logParser';
```

**Usage**:
```typescript
async getTaskLogs(dagId: string, taskId: string): Promise<string> {
  const response = await this.http.get(`/api/v1/dags/${dagId}/logs`);
  return parseLogResponse(response);
  // Handles all response formats automatically
}
```

**Handles**:
- String responses
- `{ content: string }` objects
- `{ content: [[timestamp, message], ...] }` arrays
- Array of log entries
- Fallback to JSON.stringify

---

### 4. Status Bar Manager (`src/utils/statusBarManager.ts`)

**Import**:
```typescript
import { StatusBarManager } from './utils/statusBarManager';
```

**Initialization** (in extension.ts):
```typescript
const statusBarManager = new StatusBarManager(context);
```

**Usage**:
```typescript
// Update with server count
statusBarManager.updateServerCount(servers);

// Show loading
statusBarManager.showLoading('Refreshing servers...');

// Show error
statusBarManager.showError('Connection failed');

// Reset to default
statusBarManager.reset();
```

---

## 🚀 Common Patterns

### Pattern: Parallel Operations

**❌ Don't** (Sequential):
```typescript
for (const server of servers) {
  await checkHealth(server);  // Blocks
}
```

**✅ Do** (Parallel):
```typescript
const results = await Promise.allSettled(
  servers.map(server => checkHealth(server))
);

results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    // Success
  } else {
    // Failed
  }
});
```

---

### Pattern: Caching with TTL

**❌ Don't** (No caching):
```typescript
async getDags() {
  return await client.listDags();  // Always hits API
}
```

**✅ Do** (With cache):
```typescript
private cache = new Map<string, { data: any, timestamp: number }>();

async getDags(serverId: string) {
  const cached = this.cache.get(serverId);
  
  if (cached && Date.now() - cached.timestamp < Constants.DAG_CACHE_TTL) {
    return cached.data;  // Return cached
  }
  
  const data = await client.listDags();
  this.cache.set(serverId, { data, timestamp: Date.now() });
  return data;
}
```

---

### Pattern: Configurable Timeouts

**❌ Don't** (Hardcoded):
```typescript
setTimeout(() => refresh(), 1000);
setInterval(() => healthCheck(), 30000);
```

**✅ Do** (Configurable):
```typescript
setTimeout(() => refresh(), Constants.TASK_REFRESH_DELAY);
setInterval(() => healthCheck(), Constants.HEALTH_CHECK_INTERVAL);
```

---

### Pattern: Error Handling in Commands

**❌ Don't** (Inconsistent):
```typescript
async function triggerDag(item: any) {
  try {
    await client.triggerDag(item.dagId);
    vscode.window.showInformationMessage('Success');
  } catch (error: any) {
    vscode.window.showErrorMessage(error.message);
  }
}
```

**✅ Do** (Consistent):
```typescript
async function triggerDag(item: any) {
  const result = await ErrorHandler.wrapWithResult(
    () => client.triggerDag(item.dagId),
    'Triggering DAG'
  );
  
  if (result.success) {
    vscode.window.showInformationMessage('DAG triggered successfully');
  }
}
```

---

### Pattern: Status Bar Updates

**❌ Don't** (Direct manipulation):
```typescript
statusBarItem.text = `$(cloud) ${servers.length} servers`;
statusBarItem.tooltip = 'Some tooltip';
```

**✅ Do** (Use manager):
```typescript
statusBarManager.updateServerCount(servers);
```

---

## 🎨 Code Style Guidelines

### 1. Never Hardcode Values

**❌ Bad**:
```typescript
setTimeout(() => update(), 500);
const dags = await client.listDags(100);
```

**✅ Good**:
```typescript
setTimeout(() => update(), Constants.WEBVIEW_UPDATE_DELAY);
const dags = await client.listDags(Constants.DEFAULT_API_LIMIT);
```

---

### 2. Always Handle Errors Consistently

**❌ Bad**:
```typescript
try {
  await operation();
} catch (e) {
  console.error(e);
}
```

**✅ Good**:
```typescript
await ErrorHandler.wrap(
  () => operation(),
  'Operation description'
);
```

---

### 3. Use Parallel Operations When Possible

**❌ Bad**:
```typescript
for (const item of items) {
  await processItem(item);
}
```

**✅ Good**:
```typescript
await Promise.allSettled(
  items.map(item => processItem(item))
);
```

---

### 4. Cache Expensive Operations

**❌ Bad**:
```typescript
async getChildren() {
  return await client.listDags();  // Every time
}
```

**✅ Good**:
```typescript
async getChildren() {
  if (this.isCacheValid()) {
    return this.cachedDags;
  }
  this.cachedDags = await client.listDags();
  this.cacheTimestamp = Date.now();
  return this.cachedDags;
}
```

---

## 📚 Examples

### Example 1: Adding a New Command

```typescript
import { ErrorHandler } from './utils/errorHandler';
import { Constants } from './utils/constants';

async function myNewCommand(item: any) {
  Logger.info('=== USER ACTION: My New Command ===');
  
  const result = await ErrorHandler.wrapWithResult(
    async () => {
      const client = await serverManager.getClient(item.serverId);
      if (!client) {
        throw new Error('No active server');
      }
      return await client.someOperation();
    },
    'My operation description'
  );
  
  if (result.success) {
    vscode.window.showInformationMessage('Operation successful');
    // Refresh after delay
    setTimeout(() => refresh(), Constants.TASK_REFRESH_DELAY);
  }
}
```

---

### Example 2: Adding a New API Method

```typescript
import { Constants } from '../utils/constants';
import { parseLogResponse } from '../utils/logParser';

async myNewMethod(): Promise<any> {
  try {
    const response = await this.http.get(
      `/api/v1/my-endpoint?limit=${Constants.DEFAULT_API_LIMIT}`
    );
    Logger.debug('MyClient.myNewMethod: Success', { count: response.items?.length });
    return response.items;
  } catch (error: any) {
    Logger.error('MyClient.myNewMethod: Failed', error);
    throw error;
  }
}
```

---

### Example 3: Adding a New Webview Panel

```typescript
import { Constants } from '../utils/constants';

private async update() {
  try {
    const data = await this.loadData();
    this.panel.webview.html = this.getHtml(data);
    
    // Delayed update
    setTimeout(
      () => this.loadAdditionalData(),
      Constants.WEBVIEW_UPDATE_DELAY
    );
  } catch (error: any) {
    await ErrorHandler.handle(error, 'Failed to update panel');
  }
}
```

---

## ⚡ Performance Tips

1. **Use caching** for expensive operations (API calls, computations)
2. **Use parallel operations** with `Promise.allSettled()` when possible
3. **Debounce rapid updates** using configurable delays
4. **Clear caches** on manual refresh to ensure fresh data
5. **Use constants** for all timeouts to allow user tuning

---

## 🔍 Debugging

### Enable Verbose Logging

**Settings** → **Airflow Studio** → **Verbose Logging** → ✅

Or in settings.json:
```json
{
  "airflowStudio.verboseLogging": true
}
```

### View Logs

**View** → **Output** → Select "Airflow Studio"

### Common Debug Patterns

```typescript
Logger.debug('Method: Starting', { param1, param2 });
// ... operation ...
Logger.info('Method: Success', { result });
```

---

## 📖 Further Reading

- **OPTIMIZATIONS.md** - Detailed optimization documentation
- **README.md** - User-facing documentation
- **.amazonq/rules/memory-bank/** - Architecture and guidelines

---

**Last Updated**: March 2024  
**Version**: 0.1.0
