# Enhanced Logging - Complete Request/Response Tracking

## ✅ What Was Added

### 1. HTTP Request/Response Interceptors
**File:** `src/api/HttpClient.ts`

All HTTP requests and responses are now automatically logged:

**Request Logging:**
```
[DEBUG] HTTP Request {
  "method": "GET",
  "url": "/api/v2/dags",
  "baseURL": "https://your-server.com",
  "auth": "***REDACTED***",
  "dataSize": 0
}
```

**Response Success Logging:**
```
[DEBUG] HTTP Response Success {
  "status": 200,
  "statusText": "OK",
  "url": "/api/v2/dags",
  "dataType": "Array(10)"
}
```

**Response Error Logging:**
```
[ERROR] HTTP Response Error {
  "message": "Request failed with status code 401",
  "stack": "...",
  "name": "AxiosError",
  "code": "ERR_BAD_REQUEST",
  "status": 401,
  "statusText": "Unauthorized"
} {
  "url": "/api/v2/dags",
  "method": "GET",
  "status": 401,
  "statusText": "Unauthorized",
  "responseData": {...}
}
```

### 2. User Action Logging
**File:** `src/extension.ts`

Every user action is now logged with clear markers:

```
[INFO] === USER ACTION: Trigger DAG ===
[DEBUG] triggerDag: Input {"dagId":"example_dag","itemType":"object"}
[INFO] triggerDag: Calling API {"dagId":"example_dag","hasConfig":true}
[INFO] triggerDag: Success {"dagId":"example_dag"}
```

**Actions Tracked:**
- ✅ Trigger DAG
- ✅ Pause DAG
- ✅ Unpause DAG
- ✅ Delete DAG
- ✅ Test Connection
- ✅ Refresh DAGs
- ✅ Add Server
- ✅ Open Server Details
- ✅ Open DAG Details
- ✅ Open Variables/Pools/Connections

### 3. Circular Reference Fix
**File:** `src/utils/logger.ts`

Fixed JSON serialization of error objects:

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

## 📊 What You'll See in Logs Now

### Example: Adding a Server
```
[INFO] === Airflow Extension Activation Started ===
[INFO] addServer: Command invoked
[DEBUG] addServer: Profile created {"id":"1774112148688","name":"local-1"}
[DEBUG] ServerManager.detectApiVersion: Testing v2
[INFO] AirflowV2Client: Initialized
[DEBUG] HTTP Request {"method":"GET","url":"/api/v2/monitor/health",...}
[DEBUG] HTTP Response Success {"status":200,"statusText":"OK",...}
[DEBUG] AirflowV2Client.getHealth: Success
[INFO] ServerManager.addServer: API version detected {"apiMode":"stable-v2"}
[INFO] addServer: Completed successfully
```

### Example: Listing DAGs (401 Error)
```
[INFO] === USER ACTION: Refresh DAGs ===
[DEBUG] DagsTreeProvider.loadDags: Starting
[DEBUG] ServerManager.getClient: Creating client {"type":"self-hosted","apiMode":"stable-v2"}
[INFO] AirflowV2Client: Initialized
[DEBUG] HTTP Request {"method":"GET","url":"/api/v2/dags?limit=100",...}
[ERROR] HTTP Response Error {
  "message": "Request failed with status code 401",
  "status": 401,
  "statusText": "Unauthorized"
} {
  "url": "/api/v2/dags?limit=100",
  "method": "GET",
  "responseData": {"detail":"Unauthorized"}
}
[ERROR] AirflowV2Client.listDags: Failed
[ERROR] DagsTreeProvider.loadDags: Failed
```

### Example: Successful DAG Trigger
```
[INFO] === USER ACTION: Trigger DAG ===
[DEBUG] triggerDag: Input {"dagId":"example_dag"}
[DEBUG] triggerDag: Getting client...
[INFO] triggerDag: Calling API {"dagId":"example_dag","hasConfig":false}
[DEBUG] HTTP Request {"method":"POST","url":"/api/v2/dags/example_dag/dagRuns",...}
[DEBUG] HTTP Response Success {"status":200,"statusText":"OK",...}
[INFO] AirflowV2Client.triggerDagRun: Success {"dagId":"example_dag"}
[INFO] triggerDag: Success {"dagId":"example_dag"}
```

## 🔍 How to Use the Logs

### 1. Open Output Panel
- Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
- Type "Output: Show Output Channels"
- Select "Airflow Extension"

### 2. Filter by Log Level
- `[DEBUG]` - Detailed operation info
- `[INFO]` - Important events and user actions
- `[WARN]` - Non-critical issues
- `[ERROR]` - Failures with full details

### 3. Search for Specific Operations
- Search for `=== USER ACTION:` to find user interactions
- Search for `HTTP Request` to see all API calls
- Search for `HTTP Response Error` to find failures
- Search for specific DAG IDs or server names

## 🐛 Debugging Common Issues

### Issue: 401 Unauthorized

**What to look for:**
```
[ERROR] HTTP Response Error {
  "status": 401,
  "statusText": "Unauthorized"
}
```

**Possible causes:**
1. Wrong username/password
2. Authentication not configured
3. Token expired (for token-based auth)

**Solution:**
- Delete server and re-add with correct credentials
- Check Airflow server authentication settings

### Issue: 404 Not Found

**What to look for:**
```
[ERROR] HTTP Response Error {
  "status": 404,
  "statusText": "Not Found",
  "url": "/api/v2/monitor/health"
}
```

**Possible causes:**
1. Wrong API version (server uses v1, extension detected v2)
2. Wrong base URL
3. Endpoint doesn't exist

**Solution:**
- Check base URL is correct
- Try deleting and re-adding server
- Check Airflow version (2.x vs 3.x)

### Issue: Network Error

**What to look for:**
```
[ERROR] HTTP Response Error {
  "message": "Network Error",
  "code": "ECONNREFUSED"
}
```

**Possible causes:**
1. Server is down
2. Wrong URL/port
3. Firewall blocking connection

**Solution:**
- Verify server is running
- Check URL and port are correct
- Test connection from browser first

## 📈 Log Analysis Tips

### Track a Complete Operation
1. Find the user action: `=== USER ACTION: Trigger DAG ===`
2. Follow the HTTP requests: `HTTP Request {"method":"POST",...}`
3. Check the response: `HTTP Response Success` or `HTTP Response Error`
4. See the final result: `triggerDag: Success` or `triggerDag: Failed`

### Identify Performance Issues
Look for time gaps between:
- Request sent → Response received
- Multiple sequential requests

### Debug Authentication
1. Check if auth is being sent: `"auth": "***REDACTED***"`
2. Look for 401 errors
3. Verify username is correct in server profile

## 🎯 What Each Log Level Means

### DEBUG
- HTTP requests/responses
- Internal state changes
- Method entry/exit
- Data transformations

### INFO
- User actions (button clicks, commands)
- Successful operations
- API version detection
- Server connections

### WARN
- Non-critical failures
- Fallback behaviors
- Deprecated features

### ERROR
- API failures
- Authentication errors
- Network errors
- Unexpected exceptions

## ✅ Installation Status

```bash
✅ HttpClient updated with interceptors
✅ Extension updated with user action logging
✅ Logger fixed for circular references
✅ Compiled successfully
✅ Packaged: airflow-vscode-0.1.0.vsix
✅ Installed in VS Code
```

## 🚀 Next Steps

1. **Reload VS Code:** `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Open Output Panel:** View → Output → "Airflow Extension"
3. **Try operations:** Add server, list DAGs, trigger DAG
4. **Watch the logs:** See every request, response, and action

## 📝 Example Log Session

```
[2024-03-21T17:00:00.000Z] [INFO] === Airflow Extension Activation Started ===
[2024-03-21T17:00:00.100Z] [INFO] === USER ACTION: Add Server ===
[2024-03-21T17:00:05.200Z] [DEBUG] HTTP Request {"method":"GET","url":"/api/v2/monitor/health"}
[2024-03-21T17:00:05.500Z] [DEBUG] HTTP Response Success {"status":200}
[2024-03-21T17:00:05.501Z] [INFO] ServerManager.addServer: API version detected {"apiMode":"stable-v2"}
[2024-03-21T17:00:10.000Z] [INFO] === USER ACTION: Refresh DAGs ===
[2024-03-21T17:00:10.100Z] [DEBUG] HTTP Request {"method":"GET","url":"/api/v2/dags?limit=100"}
[2024-03-21T17:00:10.400Z] [ERROR] HTTP Response Error {"status":401,"statusText":"Unauthorized"}
[2024-03-21T17:00:10.401Z] [ERROR] AirflowV2Client.listDags: Failed
```

Now you can see exactly what's happening at every step! 🎉
