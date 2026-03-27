# Airflow API v1 Endpoint Verification

This document verifies that all endpoints used in `AirflowStableClient.ts` match the official Airflow OpenAPI v1 specification.

## Verification Status: ✅ ALL ENDPOINTS VALID

### DAG Endpoints

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/dags?limit=100` | `/dags` | ✅ | Matches spec with limit parameter |
| GET | `/api/v1/dags/{dag_id}` | `/dags/{dag_id}` | ✅ | Exact match |
| PATCH | `/api/v1/dags/{dag_id}` | `/dags/{dag_id}` | ✅ | With `is_paused` field |
| DELETE | `/api/v1/dags/{dag_id}` | `/dags/{dag_id}` | ✅ | Exact match |
| GET | `/api/v1/dags/{dag_id}/details` | `/dags/{dag_id}/details` | ✅ | Exact match |

### DAG Run Endpoints

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/dags/{dag_id}/dagRuns?limit={limit}` | `/dags/{dag_id}/dagRuns` | ✅ | With limit parameter |
| POST | `/api/v1/dags/{dag_id}/dagRuns` | `/dags/{dag_id}/dagRuns` | ✅ | With conf, logical_date |
| GET | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}` | `/dags/{dag_id}/dagRuns/{dag_run_id}` | ✅ | Exact match |
| PATCH | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}` | `/dags/{dag_id}/dagRuns/{dag_run_id}` | ✅ | With state field |

### Task Instance Endpoints

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances` | `/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances` | ✅ | Exact match |
| GET | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | `/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | ✅ | Exact match |
| PATCH | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | `/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | ✅ | With state field (v2.5.0+) |
| PATCH | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/{map_index}` | `/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/{map_index}` | ✅ | For mapped tasks |
| POST | `/api/v1/dags/{dag_id}/clearTaskInstances` | `/dags/{dag_id}/clearTaskInstances` | ✅ | With all clear options |

### Task Logs Endpoint

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}` | `/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{task_try_number}` | ✅ | With map_index query param |

### Variable Endpoints

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/variables?limit=100` | `/variables` | ✅ | With limit parameter |
| GET | `/api/v1/variables/{key}` | `/variables/{variable_key}` | ✅ | Exact match |
| POST | `/api/v1/variables` | `/variables` | ✅ | With key, value, description |
| PATCH | `/api/v1/variables/{key}` | `/variables/{variable_key}` | ✅ | With value, description |
| DELETE | `/api/v1/variables/{key}` | `/variables/{variable_key}` | ✅ | Exact match |

### Pool Endpoints

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/pools?limit=100` | `/pools` | ✅ | With limit parameter |
| GET | `/api/v1/pools/{name}` | `/pools/{pool_name}` | ✅ | Exact match |
| POST | `/api/v1/pools` | `/pools` | ✅ | With name, slots, description |
| PATCH | `/api/v1/pools/{name}` | `/pools/{pool_name}` | ✅ | With slots, description |
| DELETE | `/api/v1/pools/{name}` | `/pools/{pool_name}` | ✅ | Exact match |

### Connection Endpoints

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/connections?limit=100` | `/connections` | ✅ | With limit parameter |
| GET | `/api/v1/connections/{connection_id}` | `/connections/{connection_id}` | ✅ | Exact match |
| POST | `/api/v1/connections` | `/connections` | ✅ | With all connection fields |
| PATCH | `/api/v1/connections/{connection_id}` | `/connections/{connection_id}` | ✅ | With all connection fields |
| DELETE | `/api/v1/connections/{connection_id}` | `/connections/{connection_id}` | ✅ | Exact match |

### System Endpoints

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/health` | `/health` | ✅ | Returns HealthInfo schema |
| GET | `/api/v1/version` | `/version` | ✅ | Returns VersionInfo schema |
| GET | `/api/v1/config` | `/config` | ✅ | Returns Config schema |
| GET | `/api/v1/plugins` | `/plugins` | ✅ | Returns PluginCollection |

### DAG Source Endpoint

| Method | Endpoint | Spec Path | Status | Notes |
|--------|----------|-----------|--------|-------|
| GET | `/api/v1/dagSources/{file_token}` | `/dagSources/{file_token}` | ✅ | Returns source code |

## Response Schema Verification

### Health Response
```typescript
{
  metadatabase: { status: 'healthy' | 'unhealthy' | null },
  scheduler: { 
    status: 'healthy' | 'unhealthy' | null,
    latest_scheduler_heartbeat?: string 
  },
  triggerer?: { status: 'healthy' | 'unhealthy' | null },
  dag_processor?: { status: 'healthy' | 'unhealthy' | null }
}
```
✅ Matches OpenAPI HealthInfo schema

### DAG Response
```typescript
{
  dag_id: string,
  is_paused: boolean,
  schedule_interval: ScheduleInterval,
  owners: string[],
  tags: Tag[],
  file_token: string
}
```
✅ Matches OpenAPI DAG schema

### DAG Run Response
```typescript
{
  dag_run_id: string,
  dag_id: string,
  state: DagState,
  execution_date: string,
  start_date: string,
  end_date: string,
  conf: object
}
```
✅ Matches OpenAPI DAGRun schema

### Task Instance Response
```typescript
{
  task_id: string,
  dag_id: string,
  dag_run_id: string,
  state: TaskState,
  try_number: number,
  start_date: string,
  end_date: string,
  duration: number,
  map_index: number
}
```
✅ Matches OpenAPI TaskInstance schema

### Variable Response
```typescript
{
  key: string,
  value: string,
  description?: string
}
```
✅ Matches OpenAPI Variable schema

### Pool Response
```typescript
{
  name: string,
  slots: number,
  occupied_slots: number,
  running_slots: number,
  queued_slots: number,
  description?: string
}
```
✅ Matches OpenAPI Pool schema

### Connection Response
```typescript
{
  connection_id: string,
  conn_type: string,
  host?: string,
  schema?: string,
  login?: string,
  port?: number,
  extra?: string
}
```
✅ Matches OpenAPI Connection schema

## Field Mapping Verification

All snake_case fields from API are correctly transformed to camelCase:

| API Field | Client Field | Status |
|-----------|--------------|--------|
| dag_id | dagId | ✅ |
| is_paused | paused | ✅ |
| dag_run_id | dagRunId | ✅ |
| execution_date | executionDate | ✅ |
| start_date | startDate | ✅ |
| end_date | endDate | ✅ |
| task_id | taskId | ✅ |
| try_number | tryNumber | ✅ |
| map_index | mapIndex | ✅ |
| occupied_slots | occupiedSlots | ✅ |
| running_slots | runningSlots | ✅ |
| queued_slots | queuedSlots | ✅ |
| connection_id | connectionId | ✅ |
| conn_type | connType | ✅ |
| file_token | fileToken | ✅ |

## Upsert Pattern Verification

The upsert pattern (try PATCH, if 404 then POST) is valid for:
- ✅ Variables: PATCH `/api/v1/variables/{key}` → POST `/api/v1/variables`
- ✅ Pools: PATCH `/api/v1/pools/{name}` → POST `/api/v1/pools`
- ✅ Connections: PATCH `/api/v1/connections/{id}` → POST `/api/v1/connections`

All follow the standard REST pattern documented in the OpenAPI spec.

## Clear Task Instances Payload

```typescript
{
  dag_run_id: string,
  task_ids: string[],
  dry_run: false,
  include_upstream: boolean,
  include_downstream: boolean,
  include_future: boolean,
  only_failed: boolean
}
```
✅ Matches OpenAPI ClearTaskInstances schema

## Conclusion

All endpoints, request payloads, and response schemas in `AirflowStableClient.ts` are **100% compliant** with the Airflow OpenAPI v1 specification (version 2.8.1).

The implementation correctly:
1. Uses proper HTTP methods (GET, POST, PATCH, DELETE)
2. Constructs valid endpoint paths
3. Sends correct request payloads
4. Handles response schemas appropriately
5. Transforms snake_case to camelCase consistently
6. Implements upsert pattern correctly
7. Handles optional parameters (limit, map_index, etc.)

**No changes required for API v1 compatibility.**
