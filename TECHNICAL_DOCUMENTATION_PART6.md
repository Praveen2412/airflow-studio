# Airflow VS Code Extension - Technical Documentation (Part 6)

## Part 6: API Clients and HTTP Communication

### 6.1 API Client Architecture

#### 6.1.1 Interface-Based Design

```typescript
export interface IAirflowClient {
  // DAG operations
  listDags(): Promise<DagSummary[]>;
  getDag(dagId: string): Promise<DagSummary>;
  pauseDag(dagId: string, paused: boolean): Promise<void>;
  deleteDag(dagId: string): Promise<void>;
  
  // DAG Run operations
  listDagRuns(dagId: string, limit?: number): Promise<DagRun[]>;
  triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun>;
  
  // Task operations
  listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]>;
  getTaskLogs(dagId: string, taskId: string, dagRunId: string, tryNumber: number, mapIndex?: number): Promise<string>;
  clearTaskInstances(dagId: string, dagRunId: string, taskIds: string[], options?: ClearTaskOptions): Promise<void>;
  
  // Variables, Pools, Connections
  listVariables(): Promise<Variable[]>;
  upsertVariable(key: string, value: string, description?: string): Promise<void>;
  deleteVariable(key: string): Promise<void>;
  
  // Health and monitoring
  getHealth(): Promise<HealthStatus>;
  getVersion(): Promise<string>;
}
```

**Benefits**:
- Consistent API across all client implementations
- Easy to add new client types
- Testable with mocks
- Type-safe operations

#### 6.1.2 Client Implementations

```
IAirflowClient (Interface)
    ↓
├── AirflowStableClient (Airflow 2.x - API v1)
├── AirflowV2Client (Airflow 3.x - API v2)
└── MwaaClient (AWS MWAA - API v1 with AWS auth)
```

---

### 6.2 HttpClient (`src/api/HttpClient.ts`)

#### 6.2.1 Purpose
Low-level HTTP client wrapper around Axios with logging and authentication.

#### 6.2.2 Class Structure

```typescript
export class HttpClient {
  private client: AxiosInstance;
  private baseURL: string;
  private username?: string;
  private password?: string;
  private token?: string;
}
```

#### 6.2.3 Constructor

```typescript
constructor(baseURL: string, headers?: Record<string, string>)
```

**Initialization**:
```typescript
this.client = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
    ...headers
  },
  timeout: 30000  // 30 seconds
});
```

#### 6.2.4 Authentication Methods

##### Basic Authentication
```typescript
setAuth(username: string, password: string) {
  this.username = username;
  this.password = password;
  this.client.defaults.auth = { username, password };
}
```

**Usage**: Airflow 2.x (API v1)

##### JWT Token Authentication
```typescript
async setTokenAuth(username: string, password: string): Promise<boolean>
```

**Flow**:
```
1. POST /auth/token with username/password (form-urlencoded)
2. Extract access_token from response
3. Set Authorization header: Bearer {token}
4. If fails, fallback to basic auth
5. Return true if JWT obtained, false if fallback
```

**Usage**: Airflow 3.x (API v2)

**Implementation**:
```typescript
const response = await axios.post(`${this.baseURL}/auth/token`, 
  new URLSearchParams({ username, password }),
  { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
);
this.token = response.data.access_token;
this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
```

##### Bearer Token
```typescript
setToken(token: string) {
  this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}
```

**Usage**: AWS MWAA (pre-generated tokens)

#### 6.2.5 HTTP Methods

```typescript
async get<T>(url: string, config?: AxiosRequestConfig): Promise<T>
async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T>
async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T>
```

**Pattern**:
```typescript
async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await this.client.get<T>(url, config);
  return response.data;
}
```

**Benefits**:
- Returns data directly (not full response)
- Type-safe with generics
- Consistent error handling via interceptors

#### 6.2.6 Request Interceptor

```typescript
this.client.interceptors.request.use(
  (config) => {
    Logger.debug('HTTP Request', {
      method: config.method?.toUpperCase(),
      url: config.url,
      baseURL: config.baseURL,
      auth: config.auth ? 'Basic Auth' : 
            (config.headers?.Authorization ? 'Bearer Token' : 'none'),
      dataSize: config.data ? JSON.stringify(config.data).length : 0
    });
    return config;
  },
  (error) => {
    Logger.error('HTTP Request Setup Error', error);
    return Promise.reject(error);
  }
);
```

**Logs**:
```
[DEBUG] HTTP Request {
  "method": "GET",
  "url": "/api/v1/dags",
  "baseURL": "http://localhost:8080",
  "auth": "Basic Auth",
  "dataSize": 0
}
```

#### 6.2.7 Response Interceptor

```typescript
this.client.interceptors.response.use(
  (response) => {
    Logger.debug('HTTP Response Success', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      dataType: Array.isArray(response.data) ? 
                `Array(${response.data.length})` : typeof response.data,
      dataPreview: this.getResponsePreview(response.data)
    });
    return response;
  },
  (error) => {
    Logger.error('HTTP Response Error', error, {
      url: error.config?.url,
      method: error.config?.method?.toUpperCase(),
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    });
    return Promise.reject(error);
  }
);
```

**Success Log**:
```
[DEBUG] HTTP Response Success {
  "status": 200,
  "statusText": "OK",
  "url": "/api/v1/dags",
  "dataType": "Array(15)",
  "dataPreview": "First item keys: dag_id, is_paused, schedule_interval, owners"
}
```

**Error Log**:
```
[ERROR] HTTP Response Error {
  "url": "/api/v1/dags/invalid_dag",
  "method": "GET",
  "status": 404,
  "statusText": "Not Found",
  "responseData": { "detail": "DAG not found" }
}
```

#### 6.2.8 Response Preview Helper

```typescript
private getResponsePreview(data: any): any {
  if (!data) return null;
  if (typeof data === 'string') {
    return data.length > 100 ? data.substring(0, 100) + '...' : data;
  }
  if (Array.isArray(data)) {
    return data.length > 0 ? 
      `First item keys: ${Object.keys(data[0] || {}).join(', ')}` : 
      'Empty array';
  }
  if (typeof data === 'object') {
    return `Keys: ${Object.keys(data).slice(0, 10).join(', ')}`;
  }
  return String(data);
}
```

**Purpose**: Provides meaningful log preview without overwhelming output

---

### 6.3 AirflowStableClient (`src/api/AirflowStableClient.ts`)

#### 6.3.1 Purpose
Implements IAirflowClient for Airflow 2.x using REST API v1.

#### 6.3.2 Constructor

```typescript
constructor(baseUrl: string, username?: string, password?: string, headers?: Record<string, string>) {
  this.http = new HttpClient(baseUrl, headers);
  if (username && password) {
    this.http.setAuth(username, password);
  }
  Logger.info('AirflowStableClient: Initialized (API v1)');
}
```

#### 6.3.3 API Endpoints

##### List DAGs
```typescript
async listDags(): Promise<DagSummary[]>
```

**Endpoint**: `GET /api/v1/dags?limit=100`

**Response Mapping**:
```typescript
response.dags.map((dag: any) => ({
  dagId: dag.dag_id,
  paused: dag.is_paused,
  schedule: dag.schedule_interval,
  owner: dag.owners?.[0] || 'unknown',
  tags: dag.tags?.map((t: any) => t.name) || []
}))
```

##### Get DAG
```typescript
async getDag(dagId: string): Promise<DagSummary>
```

**Endpoint**: `GET /api/v1/dags/{dagId}`

##### Pause/Unpause DAG
```typescript
async pauseDag(dagId: string, paused: boolean): Promise<void>
```

**Endpoint**: `PATCH /api/v1/dags/{dagId}`

**Payload**: `{ is_paused: paused }`

##### Delete DAG
```typescript
async deleteDag(dagId: string): Promise<void>
```

**Endpoint**: `DELETE /api/v1/dags/{dagId}`

##### List DAG Runs
```typescript
async listDagRuns(dagId: string, limit: number = 25): Promise<DagRun[]>
```

**Endpoint**: `GET /api/v1/dags/{dagId}/dagRuns?limit={limit}`

**Response Mapping**:
```typescript
response.dag_runs.map((run: any) => ({
  dagRunId: run.dag_run_id,
  dagId: run.dag_id,
  state: run.state,
  executionDate: run.execution_date,
  startDate: run.start_date,
  endDate: run.end_date,
  conf: run.conf
}))
```

##### Trigger DAG Run
```typescript
async triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun>
```

**Endpoint**: `POST /api/v1/dags/{dagId}/dagRuns`

**Payload**:
```typescript
{
  conf?: any,           // Optional configuration
  logical_date?: string // Optional execution date
}
```

**Note**: If no payload provided, Airflow creates run with current timestamp

##### List Task Instances
```typescript
async listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]>
```

**Endpoint**: `GET /api/v1/dags/{dagId}/dagRuns/{dagRunId}/taskInstances`

**Response Mapping**:
```typescript
response.task_instances.map((task: any) => ({
  taskId: task.task_id,
  dagId: task.dag_id,
  dagRunId: task.dag_run_id,
  state: task.state,
  tryNumber: task.try_number,
  startDate: task.start_date,
  endDate: task.end_date,
  duration: task.duration,
  mapIndex: task.map_index
}))
```

##### Get Task Logs
```typescript
async getTaskLogs(dagId: string, taskId: string, dagRunId: string, tryNumber: number, mapIndex?: number): Promise<string>
```

**Endpoint**: `GET /api/v1/dags/{dagId}/dagRuns/{dagRunId}/taskInstances/{taskId}/logs/{tryNumber}?map_index={mapIndex}`

**Response Parsing**:
```typescript
function parseLogResponse(response: any): string {
  if (typeof response === 'string') return response;
  if (response.content) {
    if (typeof response.content === 'string') return response.content;
    if (Array.isArray(response.content)) {
      return response.content.map((entry: any) => {
        if (Array.isArray(entry)) return entry.join(' '); // [timestamp, message]
        return entry.message || entry.content || JSON.stringify(entry);
      }).join('\n');
    }
  }
  return JSON.stringify(response, null, 2);
}
```

**Log Format Variations**:
- String: Direct log content
- `{ content: string }`: Wrapped content
- `{ content: [[timestamp, message], ...] }`: Structured logs
- Array: List of log entries

##### Variables Operations
```typescript
async listVariables(): Promise<Variable[]>
async getVariable(key: string): Promise<Variable>
async upsertVariable(key: string, value: string, description?: string): Promise<void>
async deleteVariable(key: string): Promise<void>
```

**Endpoints**:
- List: `GET /api/v1/variables?limit=100`
- Get: `GET /api/v1/variables/{key}`
- Create: `POST /api/v1/variables`
- Update: `PATCH /api/v1/variables/{key}`
- Delete: `DELETE /api/v1/variables/{key}`

**Upsert Logic**:
```typescript
try {
  await this.http.patch(`/api/v1/variables/${key}`, { value, description });
} catch (patchError: any) {
  if (patchError.status === 404) {
    await this.http.post('/api/v1/variables', { key, value, description });
  } else {
    throw patchError;
  }
}
```

##### Pools Operations
```typescript
async listPools(): Promise<Pool[]>
async getPool(name: string): Promise<Pool>
async upsertPool(name: string, slots: number, description?: string): Promise<void>
async deletePool(name: string): Promise<void>
```

**Endpoints**: Similar pattern to Variables with `/api/v1/pools`

##### Connections Operations
```typescript
async listConnections(): Promise<Connection[]>
async getConnection(connectionId: string): Promise<Connection>
async upsertConnection(connection: Connection): Promise<void>
async deleteConnection(connectionId: string): Promise<void>
```

**Endpoints**: Similar pattern with `/api/v1/connections`

##### Health Check
```typescript
async getHealth(): Promise<HealthStatus>
```

**Endpoint**: `GET /api/v1/health`

**Response Mapping**:
```typescript
{
  metadatabase: { status: health.metadatabase?.status || 'unknown' },
  scheduler: { 
    status: health.scheduler?.status || 'unknown',
    latestHeartbeat: health.scheduler?.latest_scheduler_heartbeat
  },
  triggerer: health.triggerer ? { status: health.triggerer.status } : undefined,
  dagProcessor: health.dag_processor ? { status: health.dag_processor.status } : undefined
}
```

##### DAG Source
```typescript
async getDagSource(dagId: string): Promise<string>
```

**Flow**:
```
1. GET /api/v1/dags/{dagId} → Extract file_token
2. GET /api/v1/dagSources/{fileToken} → Get source code
3. Return content string
```

#### 6.3.4 Error Handling Pattern

```typescript
async someMethod(): Promise<ReturnType> {
  try {
    Logger.debug('AirflowStableClient.someMethod: Starting', { param: value });
    const result = await this.http.get<ResponseType>(url);
    Logger.info('AirflowStableClient.someMethod: Success', { resultInfo });
    return transformedResult;
  } catch (error: any) {
    Logger.error('AirflowStableClient.someMethod: Failed', error, { context });
    throw error;
  }
}
```

**Consistent Logging**:
- Debug: Method entry with parameters
- Info: Successful completion with result summary
- Error: Failure with error details and context

---

### 6.4 AirflowV2Client (`src/api/AirflowV2Client.ts`)

#### 6.4.1 Purpose
Implements IAirflowClient for Airflow 3.x using REST API v2 with JWT authentication.

#### 6.4.2 Factory Pattern

```typescript
export class AirflowV2Client implements IAirflowClient {
  private constructor(baseUrl: string, headers?: Record<string, string>) {
    this.http = new HttpClient(baseUrl, headers);
  }

  static async create(baseUrl: string, username?: string, password?: string, headers?: Record<string, string>): Promise<AirflowV2Client> {
    const client = new AirflowV2Client(baseUrl, headers);
    if (username && password) {
      await client.http.setTokenAuth(username, password);
    }
    return client;
  }
}
```

**Reason**: JWT token acquisition is async, so constructor can't be async

#### 6.4.3 API Differences from v1

##### Endpoint Changes

| Operation | API v1 | API v2 |
|-----------|--------|--------|
| Health | `/api/v1/health` | `/api/v2/monitor/health` |
| DAG Stats | Computed from list | `/api/v2/dagStats` |
| Trigger DAG | Optional payload | Requires `logical_date` |
| Task Logs | `/logs/{tryNumber}` | `/logs/{tryNumber}?full_content=true` |

##### List DAGs Response

**v1**:
```json
{
  "dag_id": "my_dag",
  "schedule_interval": "0 0 * * *"
}
```

**v2**:
```json
{
  "dag_id": "my_dag",
  "timetable_description": "At 00:00",
  "timetable_summary": "Daily"
}
```

**Mapping**:
```typescript
schedule: dag.timetable_description || dag.timetable_summary || 'None'
```

##### Trigger DAG Run

**v1** (Optional payload):
```typescript
POST /api/v1/dags/{dagId}/dagRuns
{ conf?: {...} }
```

**v2** (Requires logical_date):
```typescript
POST /api/v2/dags/{dagId}/dagRuns
{
  logical_date: logicalDate || new Date().toISOString(),
  conf?: {...}
}
```

##### DAG Stats

**v1**: Computed from DAG list
```typescript
const dags = response.dags || [];
return {
  total: dags.length,
  active: dags.filter(d => !d.is_paused).length,
  paused: dags.filter(d => d.is_paused).length
};
```

**v2**: Dedicated endpoint
```typescript
GET /api/v2/dagStats
// Returns aggregated statistics across all DAGs
```

#### 6.4.4 Upsert Pattern Difference

**v1**: Try PATCH, fallback to POST on 404
```typescript
try {
  await this.http.patch(url, data);
} catch (patchError: any) {
  if (patchError.status === 404) {
    await this.http.post(url, data);
  } else {
    throw patchError;
  }
}
```

**v2**: Check existence first
```typescript
try {
  await this.http.get(url);  // Check if exists
  await this.http.patch(url, data);  // Update
} catch (getError: any) {
  if (getError.status === 404) {
    await this.http.post(url, data);  // Create
  } else {
    throw getError;
  }
}
```

**Reason**: v2 API may have different error handling for PATCH on non-existent resources

---

### 6.5 MwaaClient (`src/api/MwaaClient.ts`)

#### 6.5.1 Purpose
Implements IAirflowClient for AWS Managed Workflows for Apache Airflow (MWAA).

#### 6.5.2 AWS SDK Integration

```typescript
import { MWAAClient, CreateCliTokenCommand } from '@aws-sdk/client-mwaa';

export class MwaaClient implements IAirflowClient {
  private mwaaClient: MWAAClient;
  private environmentName: string;
  private http?: HttpClient;
  private webserverUrl?: string;

  constructor(environmentName: string, region: string) {
    this.environmentName = environmentName;
    this.mwaaClient = new MWAAClient({ region });
  }
}
```

#### 6.5.3 Token-Based Authentication

```typescript
private async getWebserverUrl(): Promise<string> {
  if (this.webserverUrl) return this.webserverUrl;
  
  // Get CLI token from AWS
  const command = new CreateCliTokenCommand({ Name: this.environmentName });
  const response = await this.mwaaClient.send(command);
  
  this.webserverUrl = response.WebServerHostname || '';
  const token = response.CliToken || '';
  
  // Create HTTP client with Bearer token
  this.http = new HttpClient(`https://${this.webserverUrl}`, {
    'Authorization': `Bearer ${token}`
  });
  
  return this.webserverUrl;
}
```

**Token Lifecycle**:
1. Request token from AWS MWAA API
2. Token valid for limited time (typically 60 seconds)
3. Token used for subsequent Airflow API calls
4. Token refresh handled automatically by AWS SDK

#### 6.5.4 Lazy Client Initialization

```typescript
private async ensureClient(): Promise<HttpClient> {
  if (!this.http) {
    await this.getWebserverUrl();
  }
  return this.http!;
}
```

**Usage in Methods**:
```typescript
async listDags(): Promise<DagSummary[]> {
  const http = await this.ensureClient();
  const response = await http.get<any>('/api/v1/dags?limit=100');
  // ... mapping
}
```

**Benefits**:
- Token only requested when needed
- Cached for subsequent calls
- Automatic refresh on expiration

#### 6.5.5 API Version

MWAA uses Airflow 2.x, so endpoints are API v1:
- `/api/v1/dags`
- `/api/v1/health`
- etc.

#### 6.5.6 AWS Credentials

**Credential Chain**:
1. Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
2. AWS credentials file (`~/.aws/credentials`)
3. IAM role (if running on EC2/ECS)
4. AWS SSO

**Extension Behavior**:
- Uses default AWS SDK credential provider chain
- No explicit credential handling in code
- User must configure AWS credentials externally

---

### 6.6 API Response Transformation

#### 6.6.1 Snake Case to Camel Case

**Airflow API** (snake_case):
```json
{
  "dag_id": "my_dag",
  "is_paused": false,
  "schedule_interval": "0 0 * * *",
  "dag_run_id": "manual__2024-01-15"
}
```

**Extension Models** (camelCase):
```typescript
{
  dagId: "my_dag",
  paused: false,
  schedule: "0 0 * * *",
  dagRunId: "manual__2024-01-15"
}
```

**Transformation**:
```typescript
{
  dagId: dag.dag_id,
  paused: dag.is_paused,
  schedule: dag.schedule_interval,
  dagRunId: run.dag_run_id
}
```

#### 6.6.2 Null/Undefined Handling

```typescript
owner: dag.owners?.[0] || 'unknown'
tags: dag.tags?.map((t: any) => t.name) || []
description: v.description || ''
```

**Pattern**: Use optional chaining and default values

#### 6.6.3 Date Formatting

**API Response**: ISO 8601 strings
```json
{
  "start_date": "2024-01-15T10:30:00+00:00",
  "end_date": "2024-01-15T10:35:00+00:00"
}
```

**Extension**: Keep as strings, format in UI
```typescript
startDate: run.start_date,
endDate: run.end_date
```

**UI Formatting**:
```javascript
new Date(run.executionDate).toLocaleString()
```

---

### 6.7 Error Handling and Retry Logic

#### 6.7.1 HTTP Error Types

**4xx Client Errors**:
- 400 Bad Request: Invalid parameters
- 401 Unauthorized: Authentication failed
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Resource doesn't exist
- 409 Conflict: Resource conflict

**5xx Server Errors**:
- 500 Internal Server Error: Airflow error
- 502 Bad Gateway: Proxy error
- 503 Service Unavailable: Airflow down
- 504 Gateway Timeout: Request timeout

#### 6.7.2 Error Propagation

```
HttpClient (Axios)
    ↓ (throws error)
AirflowClient method
    ↓ (logs and re-throws)
ServerManager method
    ↓ (catches and returns result)
Command handler
    ↓ (shows error message)
User
```

#### 6.7.3 Timeout Configuration

```typescript
axios.create({
  timeout: 30000  // 30 seconds
})
```

**Considerations**:
- DAG list: Fast (< 5s)
- Task logs: Can be slow (10-30s)
- Health check: Fast (< 2s)
- Trigger DAG: Fast (< 5s)

#### 6.7.4 No Automatic Retry

**Current Implementation**: No retry logic

**Rationale**:
- User-initiated actions should fail fast
- Retry could mask underlying issues
- User can manually retry

**Future Enhancement**:
- Exponential backoff for transient errors
- Retry on 503 Service Unavailable
- Configurable retry policy

---

## Summary

Part 6 covered:
- **API Client Architecture**: Interface-based design with multiple implementations
- **HttpClient**: Low-level HTTP wrapper with logging and authentication
- **AirflowStableClient**: Airflow 2.x (API v1) implementation
- **AirflowV2Client**: Airflow 3.x (API v2) with JWT authentication
- **MwaaClient**: AWS MWAA with token-based authentication
- **Response Transformation**: API response mapping to extension models
- **Error Handling**: Error types and propagation strategy

**Next Part Preview**: Part 7 will cover Extension Lifecycle, Commands, and Integration Points.
