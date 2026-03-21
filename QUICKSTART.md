# Quick Start Guide - New Features

## 🎉 What's New

### 1. Automatic API Version Detection
The extension now automatically detects whether your Airflow server uses API v1 (Airflow 2.x) or API v2 (Airflow 3.x).

### 2. Inline Add Server Button
No need to open command palette! Just click "➕ Add Server" at the top of the Servers tree view.

### 3. Tab-Based Details Views
Click on any server or DAG to open detailed information in an editor tab.

### 4. Full Admin Management
Complete CRUD operations for Variables, Pools, and Connections in dedicated panels.

### 5. Comprehensive Logging
Every operation is logged for easy debugging.

---

## 🚀 Getting Started

### Adding Your First Server

**Option 1: Tree View Button (NEW!)**
1. Open Airflow sidebar
2. Click "➕ Add Server" at top of Servers section
3. Follow prompts

**Option 2: Command Palette**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Airflow: Add Server"
3. Follow prompts

**What Happens:**
- Extension tests both `/api/v2/health` and `/api/v1/health`
- Automatically detects correct API version
- Runs health check
- Shows server in tree with health status icon

---

## 📊 Viewing Server Details

### Click to Open
1. Click any server in the Servers tree
2. Details tab opens showing:
   - Connection info (endpoint, type, API version)
   - Health status (metadatabase, scheduler, triggerer, DAG processor)
   - Test connection button
   - Refresh button

### Health Status Icons
- ✅ Green checkmark = Healthy
- ⚠️ Yellow warning = Degraded
- ❌ Red X = Down
- ⚪ Gray circle = Unknown

---

## 🔄 Managing DAGs

### View DAG Details
1. Click any DAG in the DAGs tree
2. Details tab opens showing:
   - DAG info (status, owner, schedule, tags)
   - Recent runs table
   - Action buttons

### DAG Operations

**Trigger DAG:**
- Click "Trigger DAG" button in details tab
- Enter JSON config (optional)
- Or right-click DAG → "Trigger DAG with Config"

**Pause/Unpause:**
- Click "Pause" or "Unpause" button in details tab
- Or right-click DAG → "Pause DAG" / "Unpause DAG"

**Delete:**
- Right-click DAG → "Delete DAG"
- Confirm deletion

**Refresh:**
- Click "Refresh" button to update DAG runs

---

## ⚙️ Admin Management

### Variables

**Open Variables Panel:**
- Click "Variables" in Admin tree section

**Create Variable:**
1. Click "Create Variable"
2. Enter key, value, description
3. Click "Save"

**Delete Variable:**
- Click "Delete" next to any variable
- Confirm deletion

### Pools

**Open Pools Panel:**
- Click "Pools" in Admin tree section

**Create Pool:**
1. Click "Create Pool"
2. Enter name, slots, description
3. Click "Save"

**View Pool Usage:**
- See occupied/running/queued slots in table

**Delete Pool:**
- Click "Delete" next to any pool
- Confirm deletion

### Connections

**Open Connections Panel:**
- Click "Connections" in Admin tree section

**View Connections:**
- See all connections with type, host, schema, login, port

**Delete Connection:**
- Click "Delete" next to any connection
- Confirm deletion

---

## 🔍 Debugging & Logs

### View Extension Logs
1. Open Output panel: `View` → `Output`
2. Select "Airflow Extension" from dropdown
3. See all operations logged with timestamps

### What's Logged
- API version detection attempts
- Health check results
- All API calls (success/failure)
- Error details with stack traces
- User actions (trigger, pause, delete, etc.)

### Log Levels
- **DEBUG**: Detailed operation info
- **INFO**: Important events (server added, DAG triggered)
- **WARN**: Non-critical issues (health check failed)
- **ERROR**: Failures with full error details

---

## 💡 Tips & Tricks

### Multiple Servers
- Add multiple Airflow servers
- Click to switch between them
- Each server remembers its API version

### Tab Management
- Each DAG opens in its own tab
- Tabs are reused (clicking same DAG updates existing tab)
- Close tabs when done to free memory

### Keyboard Shortcuts
- `Ctrl+Shift+P` → Quick access to all commands
- `Ctrl+R` → Refresh current view
- `Ctrl+W` → Close current tab

### Context Menus
- Right-click servers for: Edit, Delete, Test Connection
- Right-click DAGs for: Trigger, Pause, Unpause, Delete

---

## 🐛 Troubleshooting

### Server Won't Connect
1. Check logs: `View` → `Output` → "Airflow Extension"
2. Look for API detection messages
3. Verify URL is correct (include http:// or https://)
4. Test connection: Right-click server → "Test Server Connection"

### Wrong API Version Detected
- Delete server and re-add
- Extension will re-detect API version
- Check logs for detection attempts

### DAGs Not Loading
1. Ensure server is active (check status bar)
2. Click "Refresh" in DAGs section
3. Check server health in server details tab

### Panel Not Opening
1. Check logs for errors
2. Try closing and reopening VS Code
3. Run "Developer: Reload Window" from command palette

---

## 📚 Command Reference

### Server Commands
- `Airflow: Add Server` - Add new server
- `Airflow: Edit Server` - Edit server config
- `Airflow: Delete Server` - Remove server
- `Airflow: Test Server Connection` - Test connectivity
- `Airflow: Open Server Details` - Open details tab

### DAG Commands
- `Airflow: Refresh DAGs` - Reload DAG list
- `Airflow: Open DAG Details` - Open details tab
- `Airflow: Trigger DAG with Config` - Trigger with JSON
- `Airflow: Pause DAG` - Pause DAG
- `Airflow: Unpause DAG` - Unpause DAG
- `Airflow: Delete DAG` - Delete DAG

### Admin Commands
- `Airflow: Open Variables Panel` - Manage variables
- `Airflow: Open Pools Panel` - Manage pools
- `Airflow: Open Connections Panel` - Manage connections
- `Airflow: Open Health Check` - View health status

---

## 🎯 Next Steps

1. **Add your servers** - Use the new inline button
2. **Explore DAGs** - Click to see details and recent runs
3. **Manage variables** - Create and organize your Airflow variables
4. **Monitor health** - Keep an eye on server status
5. **Check logs** - Use the output panel for debugging

---

## 📖 More Documentation

- [IMPLEMENTATION.md](IMPLEMENTATION.md) - Technical implementation details
- [API_DIFFERENCES.md](API_DIFFERENCES.md) - API v1 vs v2 differences
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture
- [DEBUGGING.md](DEBUGGING.md) - Comprehensive debugging guide
- [README.md](README.md) - Project overview

---

## 🤝 Support

If you encounter issues:
1. Check the logs first
2. Review troubleshooting section
3. Check existing documentation
4. Report issues with log excerpts

Happy Airflow managing! 🚀
