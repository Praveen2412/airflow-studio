# Airflow VS Code Extension

A lightweight VS Code extension for managing Apache Airflow environments directly from your IDE.

## Project Status

✅ **Core Foundation Complete**
- Server management (self-hosted & MWAA)
- API client layer with full Airflow REST API support
- DAG listing and operations (trigger, pause, unpause, delete)
- Variables, Pools, and Connections listing
- Health check monitoring

🟡 **In Progress**
- DAG detail webview
- Task instance operations
- Real-time log viewer
- Full CRUD for Variables, Pools, Connections

## Features

- **Multi-Environment Support**: Connect to self-hosted Airflow and AWS MWAA
- **DAG Management**: Browse, trigger, pause/unpause, and delete DAGs
- **Task Operations**: View task instances, clear tasks, and inspect logs in real-time
- **Admin Tools**: Manage variables, pools, and connections
- **Health Monitoring**: Check environment health status

## Quick Start

### Installation

1. Clone the repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 to launch the extension in debug mode

### First Use

1. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run `Airflow: Add Server`
3. Choose server type:
   - **Self-hosted**: Enter base URL (e.g., http://localhost:8080), username, password
   - **AWS MWAA**: Enter environment name and AWS region
4. Start managing your DAGs!

### Basic Operations

**View DAGs**: Click on "DAGs" in the Airflow sidebar

**Trigger DAG**: Right-click DAG → "Trigger DAG with Config" → Enter JSON (optional)

**Pause/Unpause**: Right-click DAG → "Pause DAG" or "Unpause DAG"

**View Variables**: Click "Admin" → "Variables" or run `Airflow: Open Variables`

**Check Health**: Click "Admin" → "Health Check" or run `Airflow: Open Health Check`

### Troubleshooting

**Can't connect**: Verify URL/credentials, run `Airflow: Test Server Connection`

**DAGs not loading**: Ensure server is active (check status bar), run `Airflow: Refresh DAGs`

**Extension not working**: Check Output panel → "Extension Host", reload window

## Usage

### Connect to Airflow

- **Self-hosted**: Provide base URL and credentials
- **AWS MWAA**: Provide environment name and AWS region

### DAG Operations

- View all DAGs in the sidebar
- Trigger DAGs with JSON configuration
- Pause/unpause DAGs
- Delete DAGs
- View DAG runs and task instances

### Task Logs

- Real-time log streaming for running tasks
- Auto-refresh with manual control
- Search and copy log content

### Admin Management

- Create, edit, and delete variables
- Manage connection pools
- Configure connections with secret masking

## Commands

- `Airflow: Add Server` - Add new Airflow environment
- `Airflow: Edit Server` - Edit server configuration
- `Airflow: Test Server Connection` - Test connectivity
- `Airflow: Refresh DAGs` - Refresh DAG list
- `Airflow: Trigger DAG with Config` - Trigger DAG with JSON config
- `Airflow: View Task Logs` - Open task log viewer
- `Airflow: Open Variables` - Manage variables
- `Airflow: Open Pools` - Manage pools
- `Airflow: Open Connections` - Manage connections
- `Airflow: Open Health Check` - View environment health

## Requirements

- VS Code 1.80.0 or higher
- Access to Airflow REST API (v1 or later)
- For MWAA: AWS credentials configured

## Development

### Setup
1. Install dependencies: `npm install`
2. Compile: `npm run compile`
3. Watch mode: `npm run watch`
4. Debug: Press F5

### Project Structure
```
src/
├── extension.ts              # Entry point
├── api/                      # API clients
│   ├── IAirflowClient.ts
│   ├── AirflowStableClient.ts
│   ├── MwaaClient.ts
│   └── HttpClient.ts
├── models/index.ts           # Data models
├── managers/ServerManager.ts # Business logic
└── providers/                # Tree views
    ├── ServersTreeProvider.ts
    ├── DagsTreeProvider.ts
    └── AdminTreeProvider.ts
```

### Adding Features
1. Add method to `IAirflowClient.ts`
2. Implement in both `AirflowStableClient.ts` and `MwaaClient.ts`
3. Add command in `extension.ts`
4. Update `package.json` contributes section

## Documentation

- [README.md](README.md) - Project overview and usage ✅
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical design and structure ✅
- [TRACKER.md](TRACKER.md) - Implementation progress ✅

## Security

- Credentials stored securely using VS Code Secret Storage
- Secrets masked in UI by default
- No sensitive data in logs or error messages

## License

MIT
