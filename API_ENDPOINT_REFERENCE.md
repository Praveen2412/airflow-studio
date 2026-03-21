# API Endpoint Reference - v1 vs v2

## Critical Differences Fixed

### 1. Health Check Endpoint
**v1 (Airflow 2.x):**
```
GET /api/v1/health
```

**v2 (Airflow 3.x):**
```
GET /api/v2/monitor/health  ⚠️ NOTE: /monitor/ prefix!
```

**Response Structure (Both):**
```json
{
  "metadatabase": { "status": "healthy" },
  "scheduler": { "status": "healthy", "latest_scheduler_heartbeat": "..." },
  "triggerer": { "status": "healthy" },
  "dag_processor": { "status": "healthy" }
}
```

### 2. DAG Fields

**v1 Response:**
```json
{
  "dag_id": "example_dag",
  "is_paused": false,
  "schedule_interval": "@daily",
  "timetable_description": "At midnight",
  "owners": ["airflow"],
  "tags": [{"name": "example"}]
}
```

**v2 Response:**
```json
{
  "dag_id": "example_dag",
  "dag_display_name": "Example DAG",
  "is_paused": false,
  "timetable_description": "At midnight",
  "timetable_summary": "@daily",
  "owners": ["airflow"],
  "tags": ["example"]
}
```

**Key Differences:**
- v2 adds `dag_display_name`
- v2 has `timetable_summary` instead of `schedule_interval`
- v2 tags are strings, v1 tags are objects with `name` property

### 3. DAG Runs - Execution Date

**v1:**
```json
{
  "dag_run_id": "manual__2024-01-01",
  "execution_date": "2024-01-01T00:00:00+00:00",
  "logical_date": "2024-01-01T00:00:00+00:00"
}
```

**v2:**
```json
{
  "dag_run_id": "manual__2024-01-01",
  "logical_date": "2024-01-01T00:00:00+00:00",
  "execution_date": "2024-01-01T00:00:00+00:00"
}
```

**Priority:**
- v1: Use `execution_date` (primary)
- v2: Use `logical_date` (primary)

### 4. Task Logs Endpoint

**v1:**
```
GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{task_try_number}
Query params: map_index (optional)
```

**v2:**
```
GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}
Query params: full_content, map_index, token, accept
```

**Key Differences:**
- v2 uses `try_number` instead of `task_try_number` in path
- v2 supports `full_content=true` to get complete logs
- v2 has pagination with `token`

**Response (Both):**
```json
{
  "content": "log content here...",
  "continuation_token": "..."
}
```

### 5. Variables, Pools, Connections

**Endpoints are identical except for prefix:**
- v1: `/api/v1/variables`, `/api/v1/pools`, `/api/v1/connections`
- v2: `/api/v2/variables`, `/api/v2/pools`, `/api/v2/connections`

**Response structures are identical.**

## Complete Endpoint Mapping

### DAG Operations

| Operation | v1 Endpoint | v2 Endpoint | Notes |
|-----------|-------------|-------------|-------|
| List DAGs | `GET /api/v1/dags` | `GET /api/v2/dags` | v2 response has `dag_display_name` |
| Get DAG | `GET /api/v1/dags/{dag_id}` | `GET /api/v2/dags/{dag_id}` | Same |
| Update DAG | `PATCH /api/v1/dags/{dag_id}` | `PATCH /api/v2/dags/{dag_id}` | Same |
| Delete DAG | `DELETE /api/v1/dags/{dag_id}` | `DELETE /api/v2/dags/{dag_id}` | Same |
| Get DAG Details | `GET /api/v1/dags/{dag_id}/details` | `GET /api/v2/dags/{dag_id}/details` | Same |

### DAG Run Operations

| Operation | v1 Endpoint | v2 Endpoint | Notes |
|-----------|-------------|-------------|-------|
| List DAG Runs | `GET /api/v1/dags/{dag_id}/dagRuns` | `GET /api/v2/dags/{dag_id}/dagRuns` | v2 uses `logical_date` |
| Trigger DAG Run | `POST /api/v1/dags/{dag_id}/dagRuns` | `POST /api/v2/dags/{dag_id}/dagRuns` | Same payload |
| Get DAG Run | `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}` | `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}` | Same |
| Delete DAG Run | `DELETE /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}` | `DELETE /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}` | Same |
| Clear DAG Run | `POST /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/clear` | `POST /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/clear` | Same |

### Task Instance Operations

| Operation | v1 Endpoint | v2 Endpoint | Notes |
|-----------|-------------|-------------|-------|
| List Task Instances | `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances` | `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances` | Same |
| Get Task Instance | `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | Same |
| Get Task Logs | `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{task_try_number}` | `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}` | v2 has `full_content` param |
| Clear Task Instances | `POST /api/v1/dags/{dag_id}/clearTaskInstances` | `POST /api/v2/dags/{dag_id}/clearTaskInstances` | Same |

### Variable Operations

| Operation | v1 Endpoint | v2 Endpoint | Notes |
|-----------|-------------|-------------|-------|
| List Variables | `GET /api/v1/variables` | `GET /api/v2/variables` | Same |
| Get Variable | `GET /api/v1/variables/{variable_key}` | `GET /api/v2/variables/{variable_key}` | Same |
| Create/Update Variable | `PATCH /api/v1/variables/{variable_key}` | `PATCH /api/v2/variables/{variable_key}` | Same |
| Delete Variable | `DELETE /api/v1/variables/{variable_key}` | `DELETE /api/v2/variables/{variable_key}` | Same |

### Pool Operations

| Operation | v1 Endpoint | v2 Endpoint | Notes |
|-----------|-------------|-------------|-------|
| List Pools | `GET /api/v1/pools` | `GET /api/v2/pools` | Same |
| Get Pool | `GET /api/v1/pools/{pool_name}` | `GET /api/v2/pools/{pool_name}` | Same |
| Create/Update Pool | `PATCH /api/v1/pools/{pool_name}` | `PATCH /api/v2/pools/{pool_name}` | Same |
| Delete Pool | `DELETE /api/v1/pools/{pool_name}` | `DELETE /api/v2/pools/{pool_name}` | Same |

### Connection Operations

| Operation | v1 Endpoint | v2 Endpoint | Notes |
|-----------|-------------|-------------|-------|
| List Connections | `GET /api/v1/connections` | `GET /api/v2/connections` | Same |
| Get Connection | `GET /api/v1/connections/{connection_id}` | `GET /api/v2/connections/{connection_id}` | Same |
| Create/Update Connection | `PATCH /api/v1/connections/{connection_id}` | `PATCH /api/v2/connections/{connection_id}` | Same |
| Delete Connection | `DELETE /api/v1/connections/{connection_id}` | `DELETE /api/v2/connections/{connection_id}` | Same |
| Test Connection | `POST /api/v1/connections/test` | `POST /api/v2/connections/test` | Same |

### Health & Monitoring

| Operation | v1 Endpoint | v2 Endpoint | Notes |
|-----------|-------------|-------------|-------|
| Health Check | `GET /api/v1/health` | `GET /api/v2/monitor/health` | ⚠️ Different path! |

## Implementation in Extension

### AirflowStableClient (v1)
```typescript
// Uses /api/v1/* endpoints
// schedule_interval for schedule
// execution_date for DAG runs
// task_try_number in logs path
```

### AirflowV2Client (v2)
```typescript
// Uses /api/v2/* endpoints
// timetable_description/timetable_summary for schedule
// logical_date for DAG runs
// try_number in logs path
// full_content=true for complete logs
// /monitor/health for health check
```

### Auto-Detection Logic
```typescript
1. Try GET /api/v2/monitor/health
   - Success → Use AirflowV2Client
2. Try GET /api/v1/health
   - Success → Use AirflowStableClient
3. Default → AirflowStableClient
```

## Response Normalization

The extension normalizes responses to a common interface:

```typescript
interface DagSummary {
  dagId: string;
  paused: boolean;
  schedule: string;  // v1: schedule_interval, v2: timetable_description
  owner: string;
  tags: string[];    // v1: [{name: "tag"}], v2: ["tag"]
}

interface DagRun {
  dagRunId: string;
  dagId: string;
  state: string;
  executionDate: string;  // v1: execution_date, v2: logical_date
  conf?: any;
}
```

## Testing Checklist

- [x] Health endpoint: v1 uses `/api/v1/health`, v2 uses `/api/v2/monitor/health`
- [x] DAG schedule: v1 uses `schedule_interval`, v2 uses `timetable_description`
- [x] DAG tags: v1 returns objects, v2 returns strings
- [x] Execution date: v1 prioritizes `execution_date`, v2 prioritizes `logical_date`
- [x] Task logs: v2 uses `full_content=true` parameter
- [x] All endpoints have proper error logging
- [x] Response structures normalized to common interface

## Common Pitfalls

1. **Health endpoint**: Don't forget `/monitor/` prefix in v2
2. **Tags format**: v1 has `{name: "tag"}`, v2 has just `"tag"`
3. **Schedule field**: v2 doesn't have `schedule_interval`, use `timetable_description`
4. **Logs parameter**: v2 needs `full_content=true` for complete logs
5. **Date fields**: Always check both `logical_date` and `execution_date`

## References

- v1 Spec: `airflow_docs/airflow_openapi_v1.yaml`
- v2 Spec: `airflow_docs/airflow_openapi_v2.json`
- Airflow 2.x Docs: https://airflow.apache.org/docs/apache-airflow/stable/
- Airflow 3.x Docs: https://airflow.apache.org/docs/apache-airflow/3.0.0/
