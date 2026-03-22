# Button Reference Guide

Quick reference for all buttons and their functions in the Airflow VS Code Extension.

## DAG Details Panel

### Main Actions
| Button | Icon | Tooltip | Action |
|--------|------|---------|--------|
| **Trigger** | ▶️ | Trigger DAG with optional configuration | Opens form to trigger DAG with JSON config |
| **Pause/Unpause** | ⏸️/▶️ | Pause/Resume DAG execution | Toggles DAG pause state |
| **Source** | 📄 | View DAG source code | Shows Python source code |
| **Refresh** | 🔄 | Refresh DAG details | Reloads DAG information |

### DAG Runs Tab
| Button | Icon | Tooltip | Action |
|--------|------|---------|--------|
| **Load Runs** | 🔄 | Load recent DAG runs | Fetches last 25 DAG runs |
| **Tasks** | 📋 | View task instances for this run | Shows all tasks in the run |
| **✅** | ✅ | Mark run as success | Sets DAG run state to success |
| **❌** | ❌ | Mark run as failed | Sets DAG run state to failed |

### Task Instances
| Button/Control | Icon | Tooltip | Action |
|----------------|------|---------|--------|
| **Logs** | 📄 | View task logs | Opens log viewer with try selector |
| **Clear** | 🔄 | Clear task instance to re-run | Clears task to re-execute |
| **Set state...** | (dropdown) | Manually set task state | Choose success/failed/skipped |
| **Try Selector** | (dropdown) | - | Switch between retry attempts (in log viewer) |

### Log Viewer
| Button | Icon | Tooltip | Action |
|--------|------|---------|--------|
| **← Back** | ← | Go back to main view | Returns to DAG details |
| **Open in Editor** | 📝 | Open source code in editor | Opens code in new VS Code tab |
| **Try Selector** | (dropdown) | - | View logs from different retry attempts |

## Admin Panels

### Variables Panel
| Button | Icon | Tooltip | Action |
|--------|------|---------|--------|
| **Create** | ➕ | Create new variable | Opens form to add variable |
| **Refresh** | 🔄 | Refresh variables list | Reloads all variables |
| **Edit** | ✏️ | Edit this variable | Opens form with current values |
| **Delete** | 🗑️ | Delete this variable | Removes variable (with confirmation) |

### Pools Panel
| Button | Icon | Tooltip | Action |
|--------|------|---------|--------|
| **Create** | ➕ | Create new pool | Opens form to add pool |
| **Refresh** | 🔄 | Refresh pools list | Reloads all pools |
| **Edit** | ✏️ | Edit this pool | Opens form with current values |
| **Delete** | 🗑️ | Delete this pool | Removes pool (with confirmation) |

### Connections Panel
| Button | Icon | Tooltip | Action |
|--------|------|---------|--------|
| **Create** | ➕ | Create new connection | Opens form to add connection |
| **Refresh** | 🔄 | Refresh connections list | Reloads all connections |
| **Edit** | ✏️ | Edit this connection | Opens form with current values |
| **Delete** | 🗑️ | Delete this connection | Removes connection (with confirmation) |

## Server Details Panel

### Server Actions
| Button | Icon | Tooltip | Action |
|--------|------|---------|--------|
| **Edit** | ✏️ | Edit server configuration | Opens form to modify server settings |
| **Delete** | 🗑️ | Delete this server | Removes server (with confirmation) |
| **Refresh** | 🔄 | Refresh server details | Reloads metrics and health status |
| **Test Connection** | 🔌 | Test server connectivity | Verifies connection to Airflow |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) | Open Command Palette |
| Type "Airflow" | See all available Airflow commands |

## Common Workflows

### Trigger a DAG
1. Click DAG in sidebar → Opens DAG Details
2. Click **Trigger** button
3. (Optional) Enter JSON config: `{"key": "value"}`
4. Click **Trigger DAG**

### View Task Logs
1. Open DAG Details
2. Switch to **DAG Runs** tab
3. Click **Load Runs**
4. Click **Tasks** button on a run
5. Click **Logs** button on a task
6. Use **Try Selector** dropdown to view different retry attempts

### Debug Failed Tasks
1. View task logs (see above)
2. Check error messages
3. Options:
   - **Clear** task to re-run it
   - **Set state** to skip or mark as success
   - Fix DAG code and trigger new run

### Manage Variables
1. Click **Admin** → **Variables** in sidebar
2. Click **Create** to add new
3. Click **Edit** to modify existing
4. Click **Delete** to remove (with confirmation)

### Check Server Health
1. Click server name in sidebar → Opens Server Details
2. View metrics:
   - DAG counts (total/active/paused)
   - Run statistics (running/queued/success/failed)
   - Health status (scheduler/database/triggerer)
   - Airflow version

## Tips

- **Hover over any button** to see what it does
- **All delete operations** require confirmation
- **Forms can be cancelled** without saving
- **Logs auto-scroll** to bottom for running tasks
- **Try selector** only appears when task has multiple attempts
- **Refresh buttons** reload data from Airflow server
- **Status colors**: 
  - 🟢 Green = Success/Active
  - 🔵 Blue = Running
  - 🟡 Yellow = Queued/Paused
  - 🔴 Red = Failed
  - ⚫ Gray = None/Skipped

## Troubleshooting

### Button not working?
1. Check Output panel: `View` → `Output` → "Airflow Extension"
2. Look for error messages
3. Verify server connection is active (status bar)
4. Try refreshing the view

### No tooltips showing?
- Ensure you're hovering directly over the button
- Wait 1-2 seconds for tooltip to appear
- Check VS Code settings for tooltip delays

### Can't see task logs?
1. Ensure task has started (not in "none" state)
2. Check task has completed at least one attempt
3. Verify server connection is working
4. Try refreshing DAG runs

### Try selector not appearing?
- Only shows when task has multiple retry attempts
- Check task's `tryNumber` is > 1
- Verify task has actually retried (not just configured to retry)
