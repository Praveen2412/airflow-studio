# Airflow REST API Endpoints Reference

## DAG Endpoints

### List DAGs
- **v1**: `GET /api/v1/dags`
- **v2**: `GET /api/v2/dags`
- **Description**: Get a list of all DAGs
- **Query Params**: `limit`, `offset`, `tags`, `only_active`, `paused`, `dag_id_pattern`

### Get DAG
- **v1**: `GET /api/v1/dags/{dag_id}`
- **v2**: `GET /api/v2/dags/{dag_id}`
- **Description**: Get details of a specific DAG

### Get DAG Details
- **v1**: `GET /api/v1/dags/{dag_id}/details`
- **v2**: `GET /api/v2/dags/{dag_id}/details`
- **Description**: Get detailed information including task structure

### Update DAG
- **v1**: `PATCH /api/v1/dags/{dag_id}`
- **v2**: `PATCH /api/v2/dags/{dag_id}`
- **Description**: Update DAG (pause/unpause)
- **Body**: `{ "is_paused": true/false }`

### Delete DAG
- **v1**: `DELETE /api/v1/dags/{dag_id}`
- **v2**: `DELETE /api/v2/dags/{dag_id}`
- **Description**: Delete a DAG

### Get DAG Source
- **v1**: `GET /api/v1/dagSources/{dag_id}`
- **v2**: `GET /api/v2/dagSources/{dag_id}`
- **Description**: Get DAG source code
- **Response**: `{ "content": "source code string" }`

## DAG Run Endpoints

### List DAG Runs
- **v1**: `GET /api/v1/dags/{dag_id}/dagRuns`
- **v2**: `GET /api/v2/dags/{dag_id}/dagRuns`
- **Description**: Get list of DAG runs
- **Query Params**: `limit`, `offset`, `execution_date_gte`, `execution_date_lte`, `state`

### Get DAG Run
- **v1**: `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}`
- **v2**: `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}`
- **Description**: Get details of a specific DAG run

### Trigger DAG Run
- **v1**: `POST /api/v1/dags/{dag_id}/dagRuns`
- **v2**: `POST /api/v2/dags/{dag_id}/dagRuns`
- **Description**: Trigger a new DAG run
- **Body**: `{ "conf": {}, "logical_date": "2024-01-01T00:00:00Z" }`

### Update DAG Run State
- **v1**: `PATCH /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}`
- **v2**: `PATCH /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}`
- **Description**: Update DAG run state
- **Body**: `{ "state": "success" | "failed" }`

### Delete DAG Run
- **v1**: `DELETE /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}`
- **v2**: `DELETE /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}`
- **Description**: Delete a DAG run

### Clear DAG Run
- **v1**: `POST /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/clear`
- **v2**: `POST /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/clear`
- **Description**: Clear a DAG run

## Task Instance Endpoints

### List Task Instances
- **v1**: `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances`
- **v2**: `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances`
- **Description**: Get list of task instances for a DAG run

### Get Task Instance
- **v1**: `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}`
- **v2**: `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}`
- **Description**: Get details of a specific task instance

### Update Task Instance State
- **v1**: `PATCH /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}`
- **v2**: `PATCH /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}`
- **Description**: Update task instance state
- **Body**: `{ "state": "success" | "failed" }`

### Get Task Logs
- **v1**: `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}`
- **v2**: `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}`
- **Description**: Get task logs
- **Query Params (v2)**: `full_content=true`, `map_index`, `token`
- **Response**: `{ "content": "log text", "continuation_token": "..." }`

### Clear Task Instances
- **v1**: `POST /api/v1/dags/{dag_id}/clearTaskInstances`
- **v2**: `POST /api/v2/dags/{dag_id}/clearTaskInstances`
- **Description**: Clear task instances
- **Body**: `{ "dag_run_id": "...", "task_ids": ["task1"], "include_upstream": false, "include_downstream": false }`

## Variable Endpoints

### List Variables
- **v1**: `GET /api/v1/variables`
- **v2**: `GET /api/v2/variables`
- **Description**: Get list of variables
- **Query Params**: `limit`, `offset`

### Get Variable
- **v1**: `GET /api/v1/variables/{variable_key}`
- **v2**: `GET /api/v2/variables/{variable_key}`
- **Description**: Get a specific variable

### Create Variable
- **v1**: `POST /api/v1/variables`
- **v2**: `POST /api/v2/variables`
- **Description**: Create a new variable
- **Body**: `{ "key": "my_var", "value": "value", "description": "desc" }`

### Update Variable
- **v1**: `PATCH /api/v1/variables/{variable_key}`
- **v2**: `PATCH /api/v2/variables/{variable_key}`
- **Description**: Update a variable
- **Body**: `{ "key": "my_var", "value": "new_value", "description": "desc" }`

### Delete Variable
- **v1**: `DELETE /api/v1/variables/{variable_key}`
- **v2**: `DELETE /api/v2/variables/{variable_key}`
- **Description**: Delete a variable

## Pool Endpoints

### List Pools
- **v1**: `GET /api/v1/pools`
- **v2**: `GET /api/v2/pools`
- **Description**: Get list of pools

### Get Pool
- **v1**: `GET /api/v1/pools/{pool_name}`
- **v2**: `GET /api/v2/pools/{pool_name}`
- **Description**: Get a specific pool

### Create Pool
- **v1**: `POST /api/v1/pools`
- **v2**: `POST /api/v2/pools`
- **Description**: Create a new pool
- **Body**: `{ "name": "my_pool", "slots": 10, "description": "desc" }`

### Update Pool
- **v1**: `PATCH /api/v1/pools/{pool_name}`
- **v2**: `PATCH /api/v2/pools/{pool_name}`
- **Description**: Update a pool
- **Body**: `{ "name": "my_pool", "slots": 20, "description": "desc" }`

### Delete Pool
- **v1**: `DELETE /api/v1/pools/{pool_name}`
- **v2**: `DELETE /api/v2/pools/{pool_name}`
- **Description**: Delete a pool

## Connection Endpoints

### List Connections
- **v1**: `GET /api/v1/connections`
- **v2**: `GET /api/v2/connections`
- **Description**: Get list of connections

### Get Connection
- **v1**: `GET /api/v1/connections/{connection_id}`
- **v2**: `GET /api/v2/connections/{connection_id}`
- **Description**: Get a specific connection

### Create Connection
- **v1**: `POST /api/v1/connections`
- **v2**: `POST /api/v2/connections`
- **Description**: Create a new connection
- **Body**: `{ "connection_id": "my_conn", "conn_type": "http", "host": "localhost", ... }`

### Update Connection
- **v1**: `PATCH /api/v1/connections/{connection_id}`
- **v2**: `PATCH /api/v2/connections/{connection_id}`
- **Description**: Update a connection
- **Body**: `{ "connection_id": "my_conn", "conn_type": "http", ... }`

### Delete Connection
- **v1**: `DELETE /api/v1/connections/{connection_id}`
- **v2**: `DELETE /api/v2/connections/{connection_id}`
- **Description**: Delete a connection

### Test Connection
- **v1**: `POST /api/v1/connections/test`
- **v2**: `POST /api/v2/connections/test`
- **Description**: Test a connection
- **Body**: Connection object

## Health & Monitoring

### Health Check
- **v1**: `GET /api/v1/health`
- **v2**: `GET /api/v2/monitor/health`
- **Description**: Get health status of Airflow components
- **Response**: `{ "metadatabase": { "status": "healthy" }, "scheduler": { "status": "healthy" } }`

### Version
- **v1**: `GET /api/v1/version`
- **v2**: `GET /api/v2/version`
- **Description**: Get Airflow version

## Import Errors

### List Import Errors
- **v1**: `GET /api/v1/importErrors`
- **v2**: `GET /api/v2/importErrors`
- **Description**: Get list of DAG import errors

## XCom Endpoints

### List XComs
- **v1**: `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/xcomEntries`
- **v2**: `GET /api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/xcomEntries`
- **Description**: Get XCom entries for a task instance

## Event Log Endpoints

### List Event Logs
- **v1**: `GET /api/v1/eventLogs`
- **v2**: `GET /api/v2/eventLogs`
- **Description**: Get event logs

## Config Endpoints

### Get Config
- **v1**: `GET /api/v1/config`
- **v2**: `GET /api/v2/config`
- **Description**: Get Airflow configuration

## Plugin Endpoints

### List Plugins
- **v1**: `GET /api/v1/plugins`
- **v2**: `GET /api/v2/plugins`
- **Description**: Get list of installed plugins

## Provider Endpoints

### List Providers
- **v1**: `GET /api/v1/providers`
- **v2**: `GET /api/v2/providers`
- **Description**: Get list of installed providers

## Dataset Endpoints (v2 only)

### List Datasets
- **v2**: `GET /api/v2/datasets`
- **Description**: Get list of datasets

### Get Dataset
- **v2**: `GET /api/v2/datasets/{uri}`
- **Description**: Get a specific dataset

### List Dataset Events
- **v2**: `GET /api/v2/datasets/events`
- **Description**: Get dataset events

## Key Differences Between v1 and v2

1. **Health Endpoint**: v2 uses `/api/v2/monitor/health` instead of `/api/v1/health`
2. **DAG Fields**: v2 uses `timetable_description` instead of `schedule_interval`
3. **Date Fields**: v2 prioritizes `logical_date` over `execution_date`
4. **Tags**: v2 returns tags as strings, v1 as objects with `name` property
5. **Logs**: v2 supports `full_content=true` parameter for complete logs
6. **Datasets**: v2 introduces dataset endpoints (not in v1)

## Common Query Parameters

- `limit`: Maximum number of results (default: 100)
- `offset`: Number of results to skip
- `order_by`: Field to order by
- `tags`: Filter by tags
- `state`: Filter by state

## Common Response Codes

- `200`: Success
- `201`: Created
- `204`: No Content (successful delete)
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `422`: Unprocessable Entity (validation error)
- `500`: Internal Server Error
