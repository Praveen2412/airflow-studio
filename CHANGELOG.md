# Change Log

All notable changes to the "Airflow Studio" extension will be documented in this file.

## [0.2.0] - 2026-04-07

### Added
- **Code Management**: New "Code" section under each server in the tree view
  - Browse DAG files (all file types) directly in VS Code
  - Pull files from source to local workspace
  - Push local changes back to source
  - Upload individual files to source
  - Download individual files from source
  - Create new files (opens empty file in editor)
  - Rename files in workspace
  - Delete files from workspace, source, or both
- **MWAA S3 Sync**: Pull/push DAG files via `aws s3 sync` CLI
  - Configure S3 bucket and prefix per server
  - Uses existing AWS profile/region from server config
- **Self-hosted Local Sync**: Direct file copy from/to local DAGs path
- **Self-hosted Remote Sync**: rsync/scp over SSH for remote Airflow servers
  - Configure remote host, port, user, DAGs path, and optional SSH key
  - SSH password support (stored securely in VS Code secrets)
  - Default SSH port: 22
- **Code Configuration**: Optional code settings in Add/Edit Server panel
  - MWAA: S3 bucket + prefix
  - Self-hosted local: local DAGs path
  - Self-hosted remote: SSH host, port, user, path, key, password
  - Custom local workspace path override
  - Immediate UI updates when switching between local/remote/S3
- **Clear Task Options Dialog**: Enhanced task clearing with full control
  - Only clear failed tasks (default: checked)
  - Include upstream tasks
  - Include downstream tasks
  - Include future task instances
  - Only clear running tasks
  - Reset DAG runs to RUNNING state (default: checked)
  - Modal dialog with checkboxes for all options
- If code not configured, tree shows "Configure code settings" prompt


## [0.1.0] - 2026-03-15

### Added
- Initial release of Airflow Studio
- Multi-environment support for self-hosted Airflow and AWS MWAA
- Automatic API version detection (v1 for Airflow 2.x, v2 for Airflow 3.x)
- Server management with add, edit, delete, and test connection
- Favorites system for servers (⭐) and DAGs (❤️)
- Health monitoring with automatic checks every 30 seconds
- DAG management: browse, trigger, pause/unpause, delete
- DAG details panel with runs, tasks, and source code viewer
- Task operations: view logs, clear tasks, change state
- Admin panels: Variables, Pools, Connections with full CRUD
- Configuration, Plugins, Providers viewers
- Health check panel for system monitoring
- Tree view with hierarchical structure
- Status bar integration
- Comprehensive logging with debug mode

### Features
- **Server Management**
  - Add/edit/delete servers
  - Test connection with health check validation
  - Mark servers as favorites
  - Filter to show only favorite servers
  - Hide/show server sections
  - Support for multiple servers simultaneously

- **DAG Management**
  - Browse all DAGs with status indicators
  - Trigger DAGs with optional JSON configuration
  - Pause/unpause DAGs
  - Delete DAGs
  - View DAG source code
  - Mark DAGs as favorites
  - Filter to show only favorite DAGs per server

- **Task Operations**
  - View task instances for DAG runs
  - View task logs with multi-try support
  - Clear tasks with upstream/downstream options
  - Change task state manually

- **Admin Tools**
  - Variables: Create, edit, delete with descriptions
  - Pools: Manage with slot monitoring
  - Connections: Configure with secret masking
  - Config: View Airflow configuration
  - Plugins: List installed plugins
  - Providers: View provider packages
  - Health Check: Monitor system components

- **User Experience**
  - Hierarchical tree view
  - Health status indicators (✓ ✗ ⚠ ○)
  - Inline actions and tooltips
  - Confirmation dialogs for destructive actions
  - Progress indicators for long operations

### Security
- Credentials stored in VS Code Secret Storage (encrypted)
- Secrets masked in UI
- HTTPS enforced for production
- JWT token caching for Airflow 3.x
- AWS SigV4 for MWAA

### Technical
- TypeScript with strict mode
- Comprehensive error handling
- API client caching (5 minutes)
- JWT token caching (50 minutes)
- Verbose logging option
