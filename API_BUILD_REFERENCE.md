# Airflow API Endpoints — Feature Build Reference

Useful endpoints from v1 (stable) and v2 (Airflow 3.x) specs, grouped by feature area.

---

## Already Implemented

| Feature | v1 | v2 |
|---|---|---|
| List DAGs | `GET /api/v1/dags` | `GET /api/v2/dags` |
| Get DAG | `GET /api/v1/dags/{dag_id}` | `GET /api/v2/dags/{dag_id}` |
| Pause/Unpause DAG | `PATCH /api/v1/dags/{dag_id}` | `PATCH /api/v2/dags/{dag_id}` |
| Delete DAG | `DELETE /api/v1/dags/{dag_id}` | `DELETE /api/v2/dags/{dag_id}` |
| DAG Details | `GET /api/v1/dags/{dag_id}/details` | `GET /api/v2/dags/{dag_id}/details` |
| DAG Source | `GET /api/v1/dagSources/{file_token}` | `GET /api/v2/dagSources/{dag_id}` |
| List DAG Runs | `GET /api/v1/dags/{dag_id}/dagRuns` | `GET /api/v2/dags/{dag_id}/dagRuns` |
| Trigger DAG Run | `POST /api/v1/dags/{dag_id}/dagRuns` | `POST /api/v2/dags/{dag_id}/dagRuns` |
| Set DAG Run State | `PATCH /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}` | `PATCH /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}` |
| List Task Instances | `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances` | `GET /api/v2/...` |
| Get Task Logs | `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}` | same path with v2 |
| Clear Task Instances | `POST /api/v1/dags/{dag_id}/clearTaskInstances` | `POST /api/v2/dags/{dag_id}/clearTaskInstances` |
| Set Task State | `PATCH /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | same with v2 |
| Variables CRUD | `GET/POST/PATCH/DELETE /api/v1/variables` | same with v2 |
| Pools CRUD | `GET/POST/PATCH/DELETE /api/v1/pools` | same with v2 |
| Connections CRUD | `GET/POST/PATCH/DELETE /api/v1/connections` | same with v2 |
| Health | `GET /api/v1/health` | `GET /api/v2/monitor/health` |
| Version | `GET /api/v1/version` | `GET /api/v2/version` |
| DAG Stats | computed from DAG list | `GET /api/v2/dagStats` |

---

## High Priority — Next to Build

### DAG Run Management
- `DELETE /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}` — Delete a DAG run
- `POST /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/clear` — Clear (re-run) entire DAG run
- `POST /api/v1/dags/~/dagRuns/list` — Batch query runs across all DAGs (for dashboard)
- `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/wait` — Wait for run to complete

### Task Instance Management
- `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/xcomEntries` — View XCom values
- `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/links` — Extra links (logs, etc.)
- `POST /api/v1/dags/{dag_id}/updateTaskInstancesState` — Bulk update task states
- `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/tries` — All try details

### DAG Tasks Structure
- `GET /api/v1/dags/{dag_id}/tasks` — Full task list with dependencies (better than /details)
- `GET /api/v1/dags/{dag_id}/tasks/{task_id}` — Single task details

### Import Errors & Warnings
- `GET /api/v1/importErrors` — Show DAGs that failed to parse
- `GET /api/v2/dagWarnings` — DAG warnings (deprecations, etc.)

### Event Logs (Audit)
- `GET /api/v1/eventLogs` — Audit log of all actions (trigger, pause, delete, etc.)
  - Params: `dag_id`, `task_id`, `event`, `limit`, `offset`

---

## Medium Priority — Dashboard & Monitoring

### Cross-DAG Run Stats (v2 only)
- `GET /api/v2/dagStats` — Per-DAG run state counts (running/queued/success/failed)
  - Response: `{ dags: [{ dag_id, stats: [{ state, count }] }] }`

### Jobs (Scheduler/Worker health)
- `GET /api/v2/jobs` — Active scheduler/worker jobs
  - Params: `job_type` (SchedulerJob, LocalTaskJob), `is_alive`

### Providers
- `GET /api/v1/providers` — Installed provider packages and versions

### Config
- `GET /api/v1/config` — Airflow configuration (read-only)
- `GET /api/v1/config/section/{section}/option/{option}` — Single config value

---

## Lower Priority — Advanced Features

### Backfills (v2 only)
- `GET /api/v2/backfills` — List backfills
- `POST /api/v2/backfills` — Create backfill for a date range
- `PUT /api/v2/backfills/{backfill_id}/pause` — Pause backfill
- `PUT /api/v2/backfills/{backfill_id}/cancel` — Cancel backfill

### DAG Versioning (v2 only)
- `GET /api/v2/dags/{dag_id}/dagVersions` — List all versions of a DAG
- `GET /api/v2/dags/{dag_id}/dagVersions/{version_number}` — Specific version

### DAG Tags (v2 only)
- `GET /api/v2/dagTags` — All tags across all DAGs (for filtering)

### Assets / Datasets (v2 only)
- `GET /api/v2/assets` — List all assets (formerly datasets)
- `GET /api/v2/assets/events` — Asset trigger events
- `POST /api/v2/assets/events` — Manually trigger an asset event

### Reparse DAG
- `PUT /api/v2/parseDagFile/{file_token}` — Force re-parse a DAG file

### Connection Test
- `POST /api/v1/connections/test` — Test a connection config before saving
- `POST /api/v2/connections/test` — Same for v2

### Users & Roles (v1 only)
- `GET /api/v1/users` — List users
- `GET /api/v1/roles` — List roles
- `GET /api/v1/permissions` — List permissions

---

## Log Response Format Notes

**v1**: `GET .../logs/{try_number}` returns:
```json
{ "content": [[timestamp, "log line"], [timestamp, "log line"]] }
```
Parse as: `entry[1]` for the message, `entry[0]` for timestamp.

**v2**: Returns plain string or `{ "content": "string" }`.

---

## DAG Stats Response (v2)
```json
{
  "dags": [
    {
      "dag_id": "my_dag",
      "stats": [
        { "state": "running", "count": 1 },
        { "state": "success", "count": 42 },
        { "state": "failed", "count": 3 }
      ]
    }
  ]
}
```
