# Airflow Studio

**Manage Apache Airflow environments directly from Visual Studio Code**

Airflow Studio is a comprehensive VS Code extension that brings the power of Apache Airflow management into your IDE. Connect to self-hosted Airflow instances or AWS MWAA environments, manage DAGs, monitor task execution, and configure admin resources—all without leaving your development environment.

![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

---

## ✨ Features

### 🌐 Multi-Environment Support
- **Self-Hosted Airflow**: Connect to any Airflow 2.x or 3.x instance
- **AWS MWAA**: Native integration with Amazon Managed Workflows for Apache Airflow
- **Automatic API Detection**: Seamlessly supports both Airflow API v1 (2.x) and v2 (3.x)
- **Multiple Servers**: Manage multiple environments simultaneously with easy switching

### 📊 DAG Management
- **Browse DAGs**: View all DAGs with status indicators (active/paused)
- **Trigger Runs**: Execute DAGs with optional JSON configuration and custom logical dates
- **Pause/Unpause**: Control DAG scheduling with one click
- **Delete DAGs**: Remove unwanted DAGs from your environment
- **View Details**: Inspect DAG runs, task instances, and execution history
- **Source Code Viewer**: View DAG Python source code directly in VS Code
- **Favorites System**: Mark favorite DAGs with ❤️ for quick access and filtering

### 🔧 Task Operations
- **Task Instances**: View all tasks for any DAG run with state visualization
- **Clear Tasks**: Re-run failed or completed tasks with upstream/downstream options
- **Change State**: Manually set task states (success, failed, skipped)
- **Multi-Try Logs**: View logs from different retry attempts
- **Real-Time Logs**: Stream logs for running tasks with auto-refresh
- **Rendered Templates**: View rendered Jinja2 templates for task parameters (Airflow 3.x)

### ⚙️ Admin Tools
- **Variables**: Create, edit, and delete Airflow variables with descriptions
- **Pools**: Manage task execution pools with slot monitoring
- **Connections**: Configure connections with automatic secret masking
- **Configuration**: View Airflow configuration (if enabled by admin)
- **Plugins**: List installed Airflow plugins
- **Providers**: View provider packages and versions
- **Health Check**: Monitor scheduler, metadata database, triggerer, and DAG processor status

### 🎯 User Experience
- **Hierarchical Tree View**: Servers → DAGs/Admin → Resources
- **Health Status Indicators**: Visual icons (✓ healthy, ✗ down, ⚠ degraded, ○ unknown)
- **Favorites & Filtering**: Star servers ⭐ and heart DAGs ❤️ for quick filtering
- **Hide/Show Folders**: Collapse server sections to reduce clutter
- **Automatic Health Checks**: Background monitoring every 30 seconds
- **Inline Actions**: Quick access buttons in tree view
- **Tooltips**: Hover guidance on all buttons and actions
- **Comprehensive Logging**: Debug mode for troubleshooting (configurable)

---

## 🚀 Getting Started

### Installation

1. **From VS Code Marketplace** (coming soon)
   - Search for "Airflow Studio" in Extensions
   - Click Install

2. **From VSIX File**
   ```bash
   code --install-extension airflow-studio-0.1.0.vsix
   ```

### Prerequisites

- **VS Code**: Version 1.80.0 or higher
- **Airflow Access**: REST API enabled on your Airflow instance
- **For MWAA**: AWS credentials configured (AWS CLI, environment variables, or IAM role)

### First-Time Setup

1. **Open Airflow Studio**
   - Click the Airflow icon in the Activity Bar (left sidebar)
   - Or open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search "Airflow"

2. **Add Your First Server**
   - Click the **+** button in the tree view
   - Or run command: `Airflow Studio: Add Server`

3. **Configure Server**

   **For Self-Hosted Airflow:**
   - **Name**: Friendly name (e.g., "Production", "Local Dev")
   - **Base URL**: Full URL including protocol (e.g., `http://localhost:8080`)
   - **Username**: Airflow web UI username
   - **Password**: Airflow web UI password
   - **API Mode**: Auto-detect (recommended) or manually select v1/v2

   **For AWS MWAA:**
   - **Name**: Friendly name (e.g., "MWAA Production")
   - **Environment Name**: MWAA environment name from AWS Console
   - **AWS Region**: Region where MWAA is deployed (e.g., `us-east-1`)
   - **API Mode**: Auto-detect (recommended)

4. **Start Managing**
   - Expand your server in the tree view
   - Browse DAGs and Admin resources
   - Click any item to view details

---

## 📖 Usage Guide

### Managing Servers

**Add Server**: Click **+** button or run `Airflow Studio: Add Server`

**Edit Server**: Right-click server → "Edit Server" or click pencil icon

**Delete Server**: Right-click server → "Delete Server"

**Test Connection**: Right-click server → "Test Connection"

**Mark as Favorite**: Click star icon next to server name

**Filter Favorites**: Click filter icon in tree view to show only favorite servers

**Hide/Show**: Click eye icon to collapse/expand server sections

### Working with DAGs

**View DAG Details**: Click on any DAG name to open details panel

**Trigger DAG**: 
- Right-click DAG → "Trigger DAG with Config"
- Enter JSON configuration (optional)
- Specify logical date (optional)

**Pause/Unpause DAG**: Right-click DAG → "Pause DAG" or "Unpause DAG"

**Delete DAG**: Right-click DAG → "Delete DAG" (requires confirmation)

**View Source Code**: In DAG details panel, click "View Source"

**Mark as Favorite**: Click heart icon next to DAG name

**Filter Favorite DAGs**: Click filter icon next to DAGs folder to show only favorites

### Monitoring DAG Runs

**View Recent Runs**: Open DAG details panel to see recent executions

**Adjust Run Limit**: Use dropdown to show 25, 100, or 365 recent runs

**View Task Instances**: Click on any DAG run to expand and see all tasks

**Task States**: Color-coded indicators (success, failed, running, queued, etc.)

**View Task Logs**: Click on task instance → "View Logs"

**Change Log Try**: Use dropdown to view logs from different retry attempts

**Clear Tasks**: Right-click task → "Clear Task" to re-run

**Change Task State**: Right-click task → "Set State" → Select new state

**View Rendered Templates**: Click "View Rendered" to see Jinja2 template output (Airflow 3.x only)

### Managing Variables

**Open Variables Panel**: Click Admin → Variables

**Create Variable**: Click "Create" button, enter key/value/description

**Edit Variable**: Click "Edit" button next to variable

**Delete Variable**: Click "Delete" button (requires confirmation)

**Refresh**: Click 🔄 button to reload variables

### Managing Pools

**Open Pools Panel**: Click Admin → Pools

**Create Pool**: Click "Create" button, enter name/slots/description

**Edit Pool**: Click "Edit" button next to pool

**Monitor Usage**: View occupied, running, and queued slots in real-time

**Delete Pool**: Click "Delete" button (requires confirmation)

### Managing Connections

**Open Connections Panel**: Click Admin → Connections

**Create Connection**: Click "Create" button, fill in connection details

**Edit Connection**: Click "Edit" button next to connection

**Delete Connection**: Click "Delete" button (requires confirmation)

**Connection Types**: Supports all Airflow connection types (HTTP, Postgres, S3, etc.)

### Viewing System Information

**Configuration**: Click Admin → Config to view Airflow configuration (if enabled)

**Plugins**: Click Admin → Plugins to see installed plugins

**Providers**: Click Admin → Providers to view provider packages and versions

**Health Check**: Click Admin → Health Check to monitor system components

---

## 🎮 Commands

Access all commands via Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

### Server Commands
- `Airflow Studio: Add Server` - Add new Airflow environment
- `Airflow Studio: Edit Server` - Modify server configuration
- `Airflow Studio: Delete Server` - Remove server
- `Airflow Studio: Test Server Connection` - Verify connectivity
- `Airflow Studio: Toggle Favorite Server` - Mark/unmark server as favorite
- `Airflow Studio: Toggle Show Only Favorite Servers` - Filter server list

### DAG Commands
- `Airflow Studio: Refresh DAGs` - Reload DAG list
- `Airflow Studio: Trigger DAG with Config` - Execute DAG with optional config
- `Airflow Studio: Pause DAG` - Pause DAG scheduling
- `Airflow Studio: Unpause DAG` - Resume DAG scheduling
- `Airflow Studio: Delete DAG` - Remove DAG
- `Airflow Studio: Toggle Favorite DAG` - Mark/unmark DAG as favorite
- `Airflow Studio: Toggle Show Only Favorite DAGs` - Filter DAG list per server

### Task Commands
- `Airflow Studio: View Task Logs` - Open log viewer for task
- `Airflow Studio: Clear Task` - Re-run task instance
- `Airflow Studio: Set Task State` - Manually change task state

### Admin Commands
- `Airflow Studio: Open Variables` - Manage Airflow variables
- `Airflow Studio: Open Pools` - Manage connection pools
- `Airflow Studio: Open Connections` - Manage connections
- `Airflow Studio: Open Config` - View Airflow configuration
- `Airflow Studio: Open Plugins` - List installed plugins
- `Airflow Studio: Open Providers` - View provider packages
- `Airflow Studio: Open Health Check` - Monitor system health

---

## ⚙️ Configuration

### Extension Settings

Access via `File` → `Preferences` → `Settings` → Search "Airflow Studio"

**`airflowStudio.verboseLogging`** (boolean, default: `false`)
- Enable debug-level logging in Output panel
- Useful for troubleshooting connection or API issues
- When enabled, logs all HTTP requests and responses

### Stored Data

**Server Profiles**: Stored in VS Code Global State (persists across workspaces)

**Credentials**: Encrypted in VS Code Secret Storage (secure, isolated per workspace)

**Favorites**: Saved with server profiles (syncs with VS Code Settings Sync if enabled)

---

## 🔒 Security

### Credential Storage
- All passwords and tokens stored using **VS Code Secret Storage API**
- Encrypted at rest using OS-level keychain (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux)
- Never stored in plain text or logged to output

### API Communication
- **HTTPS enforced** for production servers
- **Basic Authentication** over TLS for Airflow 2.x
- **JWT Token Authentication** for Airflow 3.x with automatic refresh
- **AWS SigV4** for MWAA with temporary tokens (60-minute validity)

### Data Privacy
- Sensitive data (passwords, connection extras) masked in UI
- No credentials or tokens logged to output channel
- Error messages sanitized before display

---

## 🐛 Troubleshooting

### Connection Issues

**Problem**: "Failed to connect to server"
- Verify base URL is correct and includes protocol (`http://` or `https://`)
- Check username and password are correct
- Ensure Airflow REST API is enabled
- Run `Airflow Studio: Test Server Connection` for detailed error

**Problem**: "401 Unauthorized"
- Verify credentials are correct
- For Airflow 3.x, ensure JWT authentication is enabled
- For MWAA, check AWS credentials are configured

**Problem**: "CORS errors"
- Add CORS headers to Airflow configuration
- For local development, use `--cors-allow-all` flag

### DAG Issues

**Problem**: "DAGs not loading"
- Check server health status (icon next to server name)
- Verify DAGs are parsed and visible in Airflow web UI
- Click refresh button (🔄) to reload
- Check Output panel (`View` → `Output` → "Airflow Studio") for errors

**Problem**: "Trigger DAG fails"
- Ensure DAG is not paused
- Validate JSON configuration syntax
- Check DAG accepts the provided configuration parameters

### MWAA-Specific Issues

**Problem**: "Failed to get MWAA token"
- Verify AWS credentials are configured (`aws configure` or environment variables)
- Check IAM permissions include `airflow:CreateWebLoginToken`
- Ensure environment name and region are correct
- Verify MWAA environment is in "Available" state

**Problem**: "Token expired"
- Tokens automatically refresh every 50 minutes
- If issues persist, delete and re-add the server

### Performance Issues

**Problem**: "Extension is slow"
- Enable client caching (enabled by default, 5-minute cache)
- Reduce DAG run limit in details panel (use 25 instead of 365)
- Disable verbose logging if enabled

### Getting Help

1. **Check Logs**: `View` → `Output` → Select "Airflow Studio"
2. **Enable Verbose Logging**: Settings → `airflowStudio.verboseLogging` → Enable
3. **Reload Window**: `Ctrl+Shift+P` → "Developer: Reload Window"
4. **Report Issues**: Include logs and steps to reproduce

---

## 📋 Changelog

### v0.1.0 (Current Release)

#### 🎉 Major Features
- **Unified Tree View**: Hierarchical structure with servers containing DAGs and Admin sections
- **Favorites System**: Mark favorite servers (⭐) and DAGs (❤️) with filtering options
- **Health Monitoring**: Automatic health checks every 30 seconds with visual status indicators
- **Add/Edit Server Panel**: Rich webview interface for server configuration
- **Hide/Show Functionality**: Collapse server and DAG sections to reduce clutter
- **DAG Details Panel**: Comprehensive view of DAG runs, tasks, and operations
- **Admin Panels**: Full CRUD for Variables, Pools, Connections, plus Config/Plugins/Providers viewers

#### 🔧 API & Performance
- **Automatic API Version Detection**: Detects and uses correct API (v1 or v2) for all server types
- **JWT Token Caching**: 50-minute cache for Airflow 3.x tokens with automatic refresh
- **API Client Caching**: 5-minute cache to reduce redundant API calls
- **MWAA Token Authentication**: Proper CreateWebLoginToken implementation with v1/v2 support
- **Error Handling**: Graceful handling of 401 (token refresh) and 403 (disabled endpoints)

#### 🎨 UI/UX Improvements
- **DAG Run Sorting**: Descending order (newest first)
- **Run Limit Selector**: Choose 25, 100, or 365 recent runs
- **Logical Date Input**: Specify custom execution dates when triggering
- **Rendered Template Viewer**: View Jinja2 template output (Airflow 3.x)
- **Dynamic Task Count**: Real-time task count updates
- **Confirmation Dialogs**: Moved from webview to extension for better UX
- **Button Tooltips**: Hover guidance on all interactive elements

#### 🐛 Bug Fixes
- Fixed clear task API to include `dry_run: false` and `reset_dag_runs: true`
- Fixed set task state to use `new_state` field for Airflow v2 API
- Fixed pool edit to include `include_deferred` field
- Fixed delete button parameter mismatch in admin panels
- Fixed config panel 403 error handling when endpoint is disabled
- Fixed DAG favorite icon from star to heart for consistency

#### 🔐 Security
- Credentials stored in VS Code Secret Storage (encrypted)
- Secrets masked in UI by default
- No sensitive data in logs or error messages
- HTTPS enforced for production environments

#### 📦 Package Optimization
- Reduced package size from 5.26MB to 4.02MB
- Changed activation event from `*` to `onView:airflowServers`
- Added LICENSE file
- Excluded unnecessary files from package

#### 🛠️ Developer Experience
- Verbose logging configuration option
- Comprehensive debug logging for all operations
- Output channel renamed to "Airflow Studio"
- Structured logging with context objects

---

## 🔧 Requirements

- **VS Code**: 1.80.0 or higher
- **Airflow**: 2.0+ (API v1) or 3.0+ (API v2)
- **For MWAA**: AWS credentials with `airflow:CreateWebLoginToken` permission

---

## 📚 Support

### Documentation
- **README.md**: This file - user guide and feature overview
- **Output Logs**: `View` → `Output` → "Airflow Studio"
- **Verbose Logging**: Enable in Settings for detailed debugging

### Common Questions

**Q: Can I connect to multiple Airflow environments?**  
A: Yes! Add multiple servers and switch between them easily.

**Q: Does this work with Airflow 3.x?**  
A: Yes! Automatic API version detection supports both 2.x and 3.x.

**Q: Is my password stored securely?**  
A: Yes! All credentials are encrypted using VS Code Secret Storage API.

**Q: Can I use this with AWS MWAA?**  
A: Yes! Native MWAA support with automatic AWS authentication.

**Q: Why can't I see the Config panel?**  
A: Some Airflow admins disable the config endpoint for security. This is normal.

**Q: How do I enable debug logging?**  
A: Settings → Search "Airflow Studio" → Enable "Verbose Logging"

---

## 🤝 Contributing

Contributions are welcome! This is an open-source project.

---

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

---

## 🙏 Acknowledgments

Built with ❤️ for the Apache Airflow community

- **Apache Airflow**: The platform that powers data orchestration
- **VS Code**: The extensible IDE that makes this possible
- **AWS MWAA**: Managed Airflow service integration

---

**Made with ❤️ for Data Engineers**
