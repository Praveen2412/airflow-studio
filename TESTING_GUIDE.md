# Testing Guide - Debug Buttons and Logging

## How to See Logs

### 1. VS Code Output Panel (Extension Logs)
- Open: `View` → `Output` (or `Ctrl+Shift+U`)
- Select: **"Airflow Extension"** from dropdown
- Shows: Backend TypeScript logs from `Logger.info()`, `Logger.error()`, etc.

### 2. Browser DevTools (Webview Logs)
- Open: `Help` → `Toggle Developer Tools` (or `Ctrl+Shift+I`)
- Go to: **Console** tab
- Filter: Type `[Airflow]` in the filter box
- Shows: Frontend JavaScript logs from `console.log('[Airflow] ...')`

## What to Test

### Test 1: Delete Variable Button
1. Open Variables panel: `Ctrl+Shift+P` → "Airflow: Open Variables"
2. Click **Delete** button on any variable
3. **Expected logs in DevTools Console**:
   ```
   [Airflow] Click event on button with action: delete
   [Airflow] Button clicked: delete {action: "delete", key: "my_var"}
   [Airflow] Deleting variable: my_var
   [Airflow] Sending delete message for variable
   ```
4. **Expected logs in Output Panel**:
   ```
   [INFO] VariablesPanel.handleMessage { command: 'delete', key: 'my_var' }
   [INFO] VariablesPanel: Deleting variable { key: 'my_var' }
   [INFO] AirflowStableClient.deleteVariable: Success { key: 'my_var' }
   [INFO] VariablesPanel: Variable deleted { key: 'my_var' }
   ```
5. **Expected UI**: Variable should disappear from list

### Test 2: Delete Pool Button
1. Open Pools panel: `Ctrl+Shift+P` → "Airflow: Open Pools"
2. Click **Delete** button on any pool
3. **Expected logs in DevTools Console**:
   ```
   [Airflow] Click event on button with action: delete
   [Airflow] Button clicked: delete {action: "delete", name: "my_pool"}
   [Airflow] Deleting pool: my_pool
   [Airflow] Sending delete message for pool
   ```
4. **Expected logs in Output Panel**:
   ```
   [INFO] PoolsPanel.handleMessage { command: 'delete', name: 'my_pool' }
   [INFO] PoolsPanel: Deleting pool { name: 'my_pool' }
   [INFO] AirflowStableClient.deletePool: Success { name: 'my_pool' }
   [INFO] PoolsPanel: Pool deleted { name: 'my_pool' }
   ```

### Test 3: Delete Connection Button
1. Open Connections panel: `Ctrl+Shift+P` → "Airflow: Open Connections"
2. Click **Delete** button on any connection
3. **Expected logs in DevTools Console**:
   ```
   [Airflow] Click event on button with action: delete
   [Airflow] Button clicked: delete {action: "delete", id: "my_conn"}
   [Airflow] Deleting connection: my_conn
   [Airflow] Sending delete message for connection
   ```
4. **Expected logs in Output Panel**:
   ```
   [INFO] ConnectionsPanel.handleMessage { command: 'delete', connectionId: 'my_conn' }
   [INFO] ConnectionsPanel: Deleting connection { connectionId: 'my_conn' }
   [INFO] AirflowStableClient.deleteConnection: Success { connectionId: 'my_conn' }
   [INFO] ConnectionsPanel: Connection deleted { connectionId: 'my_conn' }
   ```

### Test 4: Set DAG Run State
1. Open DAG Details: Click on any DAG in tree view
2. Go to **DAG Runs** tab
3. Click **Load** button to load runs
4. Click **✓** (success) or **✗** (failed) button on any run
5. **Expected logs in DevTools Console**:
   ```
   [Airflow] DAG Details button clicked: run-success {action: "run-success", runId: "manual__2024-01-01"}
   [Airflow] Setting DAG run to success: manual__2024-01-01
   [Airflow] Sending setDagRunState message
   ```
6. **Expected logs in Output Panel**:
   ```
   [INFO] DagDetailsPanel.handleMessage { command: 'setDagRunState', dagId: 'my_dag' }
   [INFO] DagDetailsPanel: Setting DAG run state { dagId: 'my_dag', dagRunId: 'manual__2024-01-01', state: 'success' }
   [INFO] AirflowStableClient.setDagRunState: Success { dagId: 'my_dag', dagRunId: 'manual__2024-01-01', state: 'success' }
   [INFO] DagDetailsPanel: DAG run state set successfully { dagId: 'my_dag', dagRunId: 'manual__2024-01-01', state: 'success' }
   ```

### Test 5: Set Task State
1. Open DAG Details: Click on any DAG
2. Go to **DAG Runs** tab, click **Load**
3. Click **📋** button on a run to load tasks
4. Use the **Set...** dropdown on any task
5. Select **✓ Success**, **✗ Failed**, or **⏭ Skipped**
6. **Expected logs in DevTools Console**:
   ```
   [Airflow] Task state dropdown changed: success {action: "set-task-state", runId: "manual__2024-01-01", taskId: "my_task"}
   [Airflow] Sending setTaskState message
   ```
7. **Expected logs in Output Panel**:
   ```
   [INFO] DagDetailsPanel.handleMessage { command: 'setTaskState', dagId: 'my_dag' }
   [INFO] DagDetailsPanel: Setting task state { dagId: 'my_dag', dagRunId: 'manual__2024-01-01', taskId: 'my_task', state: 'success' }
   [INFO] AirflowStableClient.setTaskInstanceState: Success { dagId: 'my_dag', taskId: 'my_task', state: 'success' }
   [INFO] DagDetailsPanel: Task state set successfully { dagId: 'my_dag', taskId: 'my_task', state: 'success' }
   ```

### Test 6: Task Count Display
1. Open DAG Details: Click on any DAG
2. Look at the **Tasks** tab label
3. **Expected**: Should show "📋 Tasks (N)" where N is the number of tasks
4. **Expected logs in DevTools Console**:
   ```
   [Airflow] DAG Details Panel initialized { dagId: 'my_dag', taskCount: 5 }
   [Airflow] Task structure rendered: 5 tasks
   ```
5. If task count is 0:
   - Switch to **DAG Runs** tab
   - Click **Load** button
   - The extension will auto-load task structure from first run
   - **Expected logs**:
     ```
     [Airflow] Message received from extension: updateTaskStructure {...}
     [Airflow] Updating task structure: 5 tasks
     [Airflow] Task structure updated successfully
     ```

## Troubleshooting

### If NO logs appear in DevTools Console:
1. Make sure DevTools is open: `Help` → `Toggle Developer Tools`
2. Make sure you're on the **Console** tab
3. Try typing `[Airflow]` in the filter box
4. Try clicking the button again

### If NO logs appear in Output Panel:
1. Make sure Output panel is open: `View` → `Output`
2. Make sure **"Airflow Extension"** is selected in dropdown
3. Try: `Ctrl+Shift+P` → "Developer: Reload Window"
4. Check if extension is activated: Look for "Airflow Extension Activated Successfully" message

### If Delete button does NOTHING:
1. Open DevTools Console
2. Click the Delete button
3. Look for JavaScript errors (red text)
4. Check if you see `[Airflow] Click event on button with action: delete`
5. If you see the click event but no message sent:
   - The confirm dialog might be blocked
   - Check browser console for errors

### If Task count shows 0 but tasks exist:
1. Check DevTools Console for: `[Airflow] DAG Details Panel initialized`
2. Look at the `taskCount` value
3. If it's 0, switch to DAG Runs tab and click Load
4. The extension will fetch task structure from first run
5. Check for: `[Airflow] Updating task structure: N tasks`

## Common Issues

### Issue: "No logs in Output Panel"
**Cause**: Logger not initialized or wrong output channel selected
**Fix**: 
1. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Check Output dropdown is set to "Airflow Extension"

### Issue: "Delete button click not detected"
**Cause**: Event listener not attached or button not properly rendered
**Fix**:
1. Check DevTools Console for JavaScript errors
2. Inspect the button element: Right-click → Inspect
3. Verify it has `data-action="delete"` attribute
4. Verify it has `data-key` or `data-name` or `data-id` attribute

### Issue: "Message sent but not received by extension"
**Cause**: Webview message handler not registered
**Fix**:
1. Check Output Panel for extension activation logs
2. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
3. Check for errors in DevTools Console

### Issue: "Task list disappearing"
**Cause**: HTML being regenerated, losing dynamic content
**Fix**: This is expected behavior when switching tabs or refreshing. The task list is only shown after clicking "Load" button on a DAG run.

## Summary of Logging Points

| Action | DevTools Console | Output Panel |
|--------|------------------|--------------|
| Button Click | ✅ `[Airflow] Click event` | ❌ |
| Message Sent | ✅ `[Airflow] Sending ... message` | ❌ |
| Message Received | ❌ | ✅ `[INFO] Panel.handleMessage` |
| API Call Start | ❌ | ✅ `[INFO] Panel: Starting operation` |
| API Call Success | ❌ | ✅ `[INFO] Client.method: Success` |
| API Call Failure | ❌ | ✅ `[ERROR] Client.method: Failed` |
| Operation Complete | ❌ | ✅ `[INFO] Panel: Operation completed` |

**Both logs are needed to trace the full flow from button click to API call completion.**
