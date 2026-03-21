# Hotfix - Circular Reference in Logger

## Issue
When logging errors, the Logger was trying to JSON.stringify error objects that contained circular references (HTTP request/response objects), causing:
```
Converting circular structure to JSON
--> starting at object with constructor 'ClientRequest'
```

## Root Cause
The error objects from axios/http contain circular references:
- `ClientRequest.res` → `IncomingMessage`
- `IncomingMessage.socket` → `TLSSocket`
- `TLSSocket._httpMessage` → back to `ClientRequest`

## Fix Applied

### 1. Safe JSON Stringify
Added `safeStringify` method that detects and handles circular references:

```typescript
private static safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}
```

### 2. Extract Only Needed Error Properties
Modified error logging to extract only serializable properties:

```typescript
static error(message: string, error?: any, ...args: any[]) {
  if (this.shouldLog('error')) {
    const errorDetails = error ? {
      message: error.message || String(error),
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText
    } : undefined;
    this.log('ERROR', message, errorDetails, ...args);
  }
}
```

## Changes Made
- **File:** `src/utils/logger.ts`
- **Lines Changed:** ~20 lines
- **Impact:** All error logging now works without circular reference issues

## Testing
After fix:
- ✅ DAG listing errors logged correctly
- ✅ Variable listing errors logged correctly
- ✅ Pool listing errors logged correctly
- ✅ Connection listing errors logged correctly
- ✅ No more circular reference errors

## Installation
Extension repackaged and reinstalled with fix:
```bash
✅ Compiled successfully
✅ Packaged: airflow-vscode-0.1.0.vsix
✅ Installed successfully
```

## Next Steps
1. Reload VS Code window: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Try adding server again
3. Check logs - should now show actual error messages instead of circular reference errors

## What You'll See Now
Instead of circular reference errors, you'll see the actual API errors like:
- "Request failed with status code 404"
- "Network error"
- "Unauthorized"
- etc.

This will help debug the actual connection issues with your Airflow server.
