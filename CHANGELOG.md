# Change Log

All notable changes to the "Airflow Studio" extension will be documented in this file.

## [0.1.0] - 2026-03-25

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

