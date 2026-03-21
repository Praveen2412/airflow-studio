# Airflow API v1 vs v2 Differences

## Overview
- **Airflow 2.x** uses `/api/v1/*` endpoints (Stable API)
- **Airflow 3.x** uses `/api/v2/*` endpoints (New API)

## Key Differences Implemented

### 1. Health Check Endpoint
```
v1: GET /api/v1/health
v2: GET /api/v2/health
```
Response structure is similar, both return metadatabase, scheduler, triggerer, dag_processor status.

### 2. DAG Fields
**Schedule Information**:
- v1: `schedule_interval` (string or null)
- v2: `timetable_description` (string) + `schedule_interval` (deprecated)

**Execution Date**:
- v1: `execution_date` (datetime)
- v2: `logical_date` (datetime) - `execution_date` may still exist for compatibility

### 3. DAG Runs
**Trigger DAG Run**:
```
v1: POST /api/v1/dags/{dag_id}/dagRuns
v2: POST /api/v2/dags/{dag_id}/dagRuns
```
Payload differences:
- v1: Uses `logical_date` in payload
- v2: Uses `logical_date` (preferred) or `execution_date` (compatibility)

### 4. Variables
```
v1: /api/v1/variables
v2: /api/v2/variables
```
Structure is identical for basic operations.

### 5. Pools
```
v1: /api/v1/pools
v2: /api/v2/pools
```
Field names:
- v1: `occupied_slots`, `running_slots`, `queued_slots`
- v2: Same field names

### 6. Connections
```
v1: /api/v1/connections
v2: /api/v2/connections
```
Structure is identical.

### 7. Task Instances
```
v1: /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances
v2: /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances
```
Structure is identical.

### 8. Task Logs
```
v1: /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}
v2: /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}
```
Structure is identical.

## Implementation Strategy

### Auto-Detection
The extension automatically detects the API version when adding a server:

1. Try `/api/v2/health` first
2. If fails, try `/api/v1/health`
3. Store result in `ServerProfile.apiMode` as `'stable-v1'` or `'stable-v2'`

### Client Selection
```typescript
if (server.apiMode === 'stable-v2') {
  return new AirflowV2Client(baseUrl, username, password);
} else {
  return new AirflowStableClient(baseUrl, username, password);
}
```

### Field Mapping
Both clients normalize responses to common interface:

```typescript
// In AirflowV2Client
schedule: dag.timetable_description || dag.schedule_interval

// In AirflowStableClient  
schedule: dag.schedule_interval

// Both return DagSummary with 'schedule' field
```

## Compatibility Matrix

| Feature | API v1 | API v2 | Extension Support |
|---------|--------|--------|-------------------|
| List DAGs | ✅ | ✅ | ✅ Both |
| Get DAG | ✅ | ✅ | ✅ Both |
| Pause/Unpause DAG | ✅ | ✅ | ✅ Both |
| Delete DAG | ✅ | ✅ | ✅ Both |
| List DAG Runs | ✅ | ✅ | ✅ Both |
| Trigger DAG Run | ✅ | ✅ | ✅ Both |
| List Task Instances | ✅ | ✅ | ✅ Both |
| Get Task Logs | ✅ | ✅ | ✅ Both |
| Clear Task Instances | ✅ | ✅ | ✅ Both |
| List Variables | ✅ | ✅ | ✅ Both |
| Get/Create/Update/Delete Variable | ✅ | ✅ | ✅ Both |
| List Pools | ✅ | ✅ | ✅ Both |
| Get/Create/Update/Delete Pool | ✅ | ✅ | ✅ Both |
| List Connections | ✅ | ✅ | ✅ Both |
| Get/Create/Update/Delete Connection | ✅ | ✅ | ✅ Both |
| Health Check | ✅ | ✅ | ✅ Both |

## Testing

### Test with Airflow 2.x (API v1)
```bash
# Start Airflow 2.x
docker run -p 8080:8080 apache/airflow:2.7.0 standalone

# Add server in extension
# Extension should detect: apiMode = 'stable-v1'
```

### Test with Airflow 3.x (API v2)
```bash
# Start Airflow 3.x
docker run -p 8080:8080 apache/airflow:3.0.0 standalone

# Add server in extension
# Extension should detect: apiMode = 'stable-v2'
```

## Error Handling

All API calls are wrapped with try-catch and logged:

```typescript
try {
  const response = await this.http.get('/api/v2/dags');
  Logger.debug('AirflowV2Client.listDags: Success', { count: response.dags.length });
  return response.dags;
} catch (error: any) {
  Logger.error('AirflowV2Client.listDags: Failed', error);
  throw error;
}
```

Logs include:
- Operation name
- Success/failure status
- Request parameters
- Error details (message, stack trace)
- Response data (on success)

## Future Considerations

### New v2-only Features
Airflow 3.x API v2 may introduce new features not in v1:
- Assets (new in v2)
- Enhanced DAG serialization
- New authentication methods

These can be added to `AirflowV2Client` without affecting v1 support.

### Deprecation
When Airflow 2.x reaches EOL, `AirflowStableClient` can be marked deprecated but kept for backward compatibility.

## References
- Airflow 2.x API: https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html
- Airflow 3.x API: https://airflow.apache.org/docs/apache-airflow/3.0.0/public-airflow-api.html
- OpenAPI Specs: See `airflow_docs/` directory
