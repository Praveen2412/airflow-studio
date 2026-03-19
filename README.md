# Airflow VSCode Extension

> Control Apache Airflow workflows without leaving your editor. Works with self-hosted Airflow and AWS MWAA.

## Why Use This Extension?

Stop switching between VSCode and the Airflow UI. Trigger DAGs, monitor runs, check logs, and browse source code—all from your sidebar.

**What You Can Do:**
- Connect to multiple Airflow servers simultaneously
- Trigger and control DAG execution with a right-click
- Monitor running workflows with auto-refresh
- Search and filter DAGs by name, owner, tags, or status
- Bookmark your most-used DAGs as favorites
- Read task logs and DAG source code inline
- Full AWS MWAA support via AWS CLI

## Quick Start

**Installation:**
```bash
npm install && npm run package
code --install-extension airflow-vscode-extension-0.1.0.vsix
```

**Connect to Airflow:**

Open the Airflow sidebar → Click "Connect to Airflow"

*Self-Hosted:* Provide your API URL (`http://localhost:8080/api/v1`), username, and password.

*AWS MWAA:* Enter environment name, AWS region, and optionally an AWS profile.

**Start Managing:**

Right-click any DAG to trigger, pause, view logs, or inspect source code. Use the filter icon to narrow down your DAG list.

## Prerequisites

**Self-Hosted Airflow:**
- Airflow 2.x or 3.x with REST API enabled
- Authentication configured (Basic Auth or JWT)

**AWS MWAA:**
- AWS CLI installed (`aws --version`)
- IAM permissions for `airflow:CreateCliToken` and `airflow:CreateWebLoginToken`

## Configuration Options

Adjust settings in VSCode preferences:

- `airflow.requestTimeout` — API timeout in ms (default: 30000)
- `airflow.logLevel` — Logging verbosity (default: info)

**AWS MWAA IAM Policy Example:**
```json
{
  "Effect": "Allow",
  "Action": ["airflow:CreateCliToken", "airflow:CreateWebLoginToken"],
  "Resource": "arn:aws:airflow:*:*:environment/*"
}
```

## Common Issues

**Connection Refused:**
Check that Airflow REST API is enabled and accessible. Verify credentials and network access.

**MWAA Token Errors:**
Run `aws sts get-caller-identity` to confirm AWS credentials. Ensure IAM permissions are correct.

**Empty DAG List:**
Confirm Airflow is running and the API endpoint is correct (v1 vs v2). Check Output panel (View → Output → Airflow) for errors.

## Development

```bash
npm install          # Install dependencies
npm run compile      # Build TypeScript
npm run watch        # Auto-rebuild on changes
npm run package      # Create .vsix package
```

**Architecture:**
```
src/
├── core/              # Business logic (services, models, interfaces)
├── infrastructure/    # External concerns (API, storage, logging)
├── presentation/      # UI layer (views, providers, items)
└── shared/           # Utilities (constants, events, utils)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed design documentation.

## What's Next

- Detailed DAG run history in webview
- Task instance inspection
- Admin panels for Connections, Variables, and Providers
- Server health dashboard
- Advanced log viewer with search

## Contributing

Pull requests welcome. Fork, branch, code, and submit.

## License

MIT
