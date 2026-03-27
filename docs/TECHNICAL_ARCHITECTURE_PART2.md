# Airflow VS Code Extension - Technical Architecture Documentation
## Part 2: API Layer & Client Implementation

---

## Table of Contents
- Part 1: Overview, Architecture & Core Components
- **Part 2**: API Layer & Client Implementation (This Document)
- Part 3: Managers, Providers & UI Components
- Part 4: End-to-End Flows & Integration Patterns

---

## 1. API Client Architecture

### 1.1 Client Hierarchy

```
                    IAirflowClient (Interface)
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
AirflowStableClient   AirflowV2Client    MwaaClient
   (API v1)              (API v2)         (AWS MWAA)
        │                   │                   │
        └───────────────────┴───────────────────┘
                            │
                            ▼
                      HttpClient
                     (Axios Wrapper)
```

### 1.2 Design Pattern
- **Strategy Pattern**: Different client implementations for different API versions
- **Factory Pattern**: ServerManager creates appropriate client based on server type
- **Adapter Pattern**: HttpClient wraps Axios for consistent interface

---

## 2. IAirflowClient Interface

### 2.1 Interface Definition
```typescript
interface IAirflowClient {
  // DAG Operations
  listDags(): Promise<DagSummary[]>;
  getDag(dagId: string): Promise<DagSummary>;
  pauseDag(dagId: string, paused: boolean): Promise<void>;
  deleteDag(dagId: string): Promise<void>;
  getDagDetails(dagId: string): Promise<any>;
  setDagRunState(dagId: string, dagRunId: string, state: string): Promise<void>;
  
  // DAG Run Operations
  listDagRuns(dagId: string, limit?: number): Promise<DagRun[]>;
  triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun>;
  
  // Task Operations
  listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]>;
  getTaskLogs(dagId: string, taskId: string, dagRunId: string, 
              tryNumber: number, mapIndex?: number): Promise<string>;
  clearTaskInstances(dagId: string, dagRunId: string, taskIds: string[], 
                     options?: ClearTaskOptions): Promise<void>;
  setTaskInstanceState(dagId: string, dagRunId: string, taskId: string, 
                       state: string, mapIndex?: number): Promise<void>;
  
  // Variables
  listVariables(): Promise<Variable[]>;
  getVariable(key: string): Promise<Variable>;
  upsertVariable(key: string, value: string, description?: string): Promise<void>;
  deleteVariable(key: string): Promise<void>;
  
  // Pools
  listPools(): Promise<Pool[]>;
  getPool(name: string): Promise<Pool>;
  upsertPool(name: string, slots: number, description?: string): Promise<void>;
  deletePool(name: string): Promise<void>;
  
  // Connections
  listConnections(): Promise<Connection[]>;
  getConnection(connectionId: string): Promise<Connection>;
  upsertConnection(connection: Connection): Promise<void>;
  deleteConnection(connectionId: string): Promise<void>;
  
  // Health & Metadata
  getHealth(): Promise<HealthStatus>;
  getDagStats(): Promise<any>;
  getVersion(): Promise<string>;
  getDagSource(dagId: string): Promise<string>;
}
```

### 2.2 Method Categories

| Category | Methods | Purpose |
|----------|---------|---------|
| **DAG Management** | listDags, getDag, pauseDag, deleteDag, getDagDetails, setDagRunState | Core DAG operations |
| **DAG Runs** | listDagRuns, triggerDagRun | DAG execution management |
| **Task Management** | listTaskInstances, getTaskLogs, clearTaskInstances, setTaskInstanceState | Task-level operations |
| **Variables** | listVariables, getVariable, upsertVariable, deleteVariable | Airflow Variables CRUD |
| **Pools** | listPools, getPool, upsertPool, deletePool | Pool management |
| **Connections** | listConnections, getConnection, upsertConnection, deleteConnection | Connection management |
| **Monitoring** | getHealth, getDagStats, getVersion, getDagSource | Health and metadata |

---

## 3. HttpClient Implementation

### 3.1 Class Structure
```typescript
class HttpClient {
  private client: AxiosInstance;
  private baseURL: string;
  private username?: string;
  private password?: string;
  private token?: string;
  
  constructor(baseURL: string, headers?: Record<string, string>) {
    this.client = axios.create({
      baseURL,
      headers: { 'Content-Type': 'application/json', ...headers },
      timeout: 30000
    });
    
    // Setup interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();
  }
}
```

### 3.2 Authentication Methods

#### 3.2.1 Basic Authentication
```typescript
setAuth(username: string, password: string) {
  this.username = username;
  this.password = password;
  this.client.defaults.auth = { username, password };
  Logger.debug('HttpClient: Basic auth configured');
}
```

**HTTP Header**: `Authorization: Basic base64(username:password)`

#### 3.2.2 JWT Token Authentication (Airflow 3.x)
```typescript
async setTokenAuth(username: string, password: string) {
  try {
    // Request JWT token
    const response = await axios.post(`${this.baseURL}/auth/token`, 
      new URLSearchParams({ username, password }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    this.token = response.data.access_token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    Logger.info('HttpClient: JWT token obtained successfully');
    return true;
  } catch (error) {
    // Fallback to basic auth
    this.client.defaults.auth = { username, password };
    return false;
  }
}
```

**HTTP Header**: `Authorization: Bearer {jwt_token}`

#### 3.2.3 Bearer Token (MWAA)
```typescript
setToken(token: string) {
  this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}
```

### 3.3 Request Interceptor
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

### 3.4 Response Interceptor
```typescript
this.client.interceptors.response.use(
  (response) => {
    Logger.debug('HTTP Response Success', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      dataType: Array.isArray(response.data) ? 
                `Array(${response.data.length})` : typeof response.data
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

### 3.5 HTTP Methods
```typescript
async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await this.client.get<T>(url, config);
  return response.data;
}

async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const response = await this.client.post<T>(url, data, config);
  return response.data;
}

async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const response = await this.client.patch<T>(url, data, config);
  return response.data;
}

async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const response = await this.client.delete<T>(url, config);
  return response.data;
}
```

---

## 4. AirflowStableClient (API v1)

### 4.1 Overview
- **Target**: Airflow 2.x (API v1)
- **Base Path**: `/api/v1/`
- **Authentication**: Basic Auth or fallback from JWT

### 4.2 Key Implementation Details

#### 4.2.1 Constructor
```typescript
constructor(baseUrl: string, username?: string, password?: string, 
            headers?: Record<string, string>) {
  this.http = new HttpClient(baseUrl, headers);
  if (username && password) {
    this.http.setAuth(username, password);
  }
  Logger.info('AirflowStableClient: Initialized (API v1)');
}
```

#### 4.2.2 List DAGs
```typescript
async listDags(): Promise<DagSummary[]> {
  const response = await this.http.get<any>('/api/v1/dags?limit=100');
  return response.dags.map((dag: any) => ({
    dagId: dag.dag_id,
    paused: dag.is_paused,
    schedule: dag.schedule_interval,
    owner: dag.owners?.[0] || 'unknown',
    tags: dag.tags?.map((t: any) => t.name) || []
  }));
}
```

**API Endpoint**: `GET /api/v1/dags?limit=100`

**Response Mapping**:
| API Field | Model Field | Transformation |
|-----------|-------------|----------------|
| `dag_id` | `dagId` | Direct mapping |
| `is_paused` | `paused` | Direct mapping |
| `schedule_interval` | `schedule` | Direct mapping |
| `owners[0]` | `owner` | First owner or 'unknown' |
| `tags[].name` | `tags` | Extract name from tag objects |

#### 4.2.3 Trigger DAG Run
```typescript
async triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun> {
  const payload: any = {};
  if (conf) payload.conf = conf;
  if (logicalDate) payload.logical_date = logicalDate;
  
  const run = await this.http.post<any>(`/api/v1/dags/${dagId}/dagRuns`, payload);
  
  return {
    dagRunId: run.dag_run_id,
    dagId: run.dag_id,
    state: run.state,
    executionDate: run.execution_date,
    conf: run.conf
  };
}
```

**API Endpoint**: `POST /api/v1/dags/{dag_id}/dagRuns`

**Request Body**:
```json
{
  "conf": { "key": "value" },
  "logical_date": "2024-01-15T10:00:00Z"
}
```

#### 4.2.4 Get Task Logs
```typescript
async getTaskLogs(dagId: string, taskId: string, dagRunId: string, 
                  tryNumber: number, mapIndex?: number): Promise<string> {
  let url = `/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${tryNumber}`;
  if (mapIndex !== undefined) url += `?map_index=${mapIndex}`;
  
  const response = await this.http.get<any>(url);
  return parseLogResponse(response);
}
```

**API Endpoint**: `GET /api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}`

**Log Response Parser**:
```typescript
function parseLogResponse(response: any): string {
  if (typeof response === 'string') return response;
  
  // v1 API returns { content: [[timestamp, message], ...] }
  if (response.content) {
    if (typeof response.content === 'string') return response.content;
    if (Array.isArray(response.content)) {
      return response.content.map((entry: any) => {
        if (Array.isArray(entry)) return entry.join(' ');
        return entry.message || JSON.stringify(entry);
      }).join('\n');
    }
  }
  
  return JSON.stringify(response, null, 2);
}
```

#### 4.2.5 Upsert Variable (Create or Update)
```typescript
async upsertVariable(key: string, value: string, description?: string): Promise<void> {
  try {
    // Try to update existing variable
    await this.http.patch(`/api/v1/variables/${key}`, { value, description });
  } catch (patchError: any) {
    if (patchError.status === 404) {
      // Variable doesn't exist, create new
      await this.http.post('/api/v1/variables', { key, value, description });
    } else {
      throw patchError;
    }
  }
}
```

**Pattern**: Try PATCH first, fallback to POST on 404

#### 4.2.6 Get Health Status
```typescript
async getHealth(): Promise<HealthStatus> {
  const health = await this.http.get<any>('/api/v1/health');
  
  return {
    metadatabase: { status: health.metadatabase?.status || 'unknown' },
    scheduler: { 
      status: health.scheduler?.status || 'unknown',
      latestHeartbeat: health.scheduler?.latest_scheduler_heartbeat
    },
    triggerer: health.triggerer ? { status: health.triggerer.status } : undefined,
    dagProcessor: health.dag_processor ? { status: health.dag_processor.status } : undefined
  };
}
```

**API Endpoint**: `GET /api/v1/health`

---

## 5. AirflowV2Client (API v2)

### 5.1 Overview
- **Target**: Airflow 3.x (API v2)
- **Base Path**: `/api/v2/`
- **Authentication**: JWT Token (preferred) or Basic Auth fallback

### 5.2 Key Differences from v1

| Feature | API v1 | API v2 |
|---------|--------|--------|
| **Authentication** | Basic Auth | JWT Token + Basic Auth fallback |
| **Schedule Field** | `schedule_interval` | `timetable_description` / `timetable_summary` |
| **Execution Date** | `execution_date` | `logical_date` |
| **Health Endpoint** | `/api/v1/health` | `/api/v2/monitor/health` |
| **DAG Source** | Requires `file_token` | Direct access via `dagId` |
| **Tags Format** | Object with `name` | Can be string or object |

### 5.3 Key Implementation Details

#### 5.3.1 Factory Method (Async Constructor)
```typescript
static async create(baseUrl: string, username?: string, password?: string, 
                    headers?: Record<string, string>): Promise<AirflowV2Client> {
  const client = new AirflowV2Client(baseUrl, headers);
  if (username && password) {
    await client.http.setTokenAuth(username, password);
  }
  return client;
}

private constructor(baseUrl: string, headers?: Record<string, string>) {
  this.http = new HttpClient(baseUrl, headers);
  Logger.info('AirflowV2Client: Initialized');
}
```

**Why Async Factory?** JWT token acquisition is asynchronous

#### 5.3.2 List DAGs (v2 Differences)
```typescript
async listDags(): Promise<DagSummary[]> {
  const response = await this.http.get<any>('/api/v2/dags?limit=100');
  
  return response.dags.map((dag: any) => ({
    dagId: dag.dag_id,
    paused: dag.is_paused,
    schedule: dag.timetable_description || dag.timetable_summary || 'None',  // v2 change
    owner: dag.owners?.[0] || 'unknown',
    tags: dag.tags?.map((t: any) => typeof t === 'string' ? t : t.name) || [],  // v2 change
    lastRunState: dag.last_run_state || undefined  // v2 addition
  }));
}
```

#### 5.3.3 Trigger DAG Run (v2 Differences)
```typescript
async triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun> {
  const payload: any = {
    logical_date: logicalDate || new Date().toISOString()  // v2 requires logical_date
  };
  if (conf) payload.conf = conf;
  
  const run = await this.http.post<any>(`/api/v2/dags/${dagId}/dagRuns`, payload);
  
  return {
    dagRunId: run.dag_run_id,
    dagId: run.dag_id,
    state: run.state,
    executionDate: run.logical_date || run.execution_date,  // v2 uses logical_date
    conf: run.conf
  };
}
```

#### 5.3.4 Get Task Logs (v2 Differences)
```typescript
async getTaskLogs(dagId: string, taskId: string, dagRunId: string, 
                  tryNumber: number, mapIndex?: number): Promise<string> {
  let url = `/api/v2/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${tryNumber}?full_content=true`;
  if (mapIndex !== undefined) url += `&map_index=${mapIndex}`;
  
  const response = await this.http.get<any>(url);
  return parseLogResponse(response);
}
```

**v2 Addition**: `?full_content=true` query parameter

#### 5.3.5 Get Health (v2 Endpoint Change)
```typescript
async getHealth(): Promise<HealthStatus> {
  const health = await this.http.get<any>('/api/v2/monitor/health');  // v2 path
  
  return {
    metadatabase: { status: health.metadatabase?.status || 'unknown' },
    scheduler: { 
      status: health.scheduler?.status || 'unknown',
      latestHeartbeat: health.scheduler?.latest_scheduler_heartbeat
    },
    triggerer: health.triggerer ? { status: health.triggerer.status } : undefined,
    dagProcessor: health.dag_processor ? { status: health.dag_processor.status } : undefined
  };
}
```

#### 5.3.6 Get DAG Source (v2 Simplification)
```typescript
async getDagSource(dagId: string): Promise<string> {
  const response = await this.http.get<any>(`/api/v2/dagSources/${dagId}`);
  return response.content || '';
}
```

**v1 vs v2**:
- **v1**: Requires getting `file_token` from DAG details first
- **v2**: Direct access via `dagId`

#### 5.3.7 Upsert Variable (v2 Pattern)
```typescript
async upsertVariable(key: string, value: string, description?: string): Promise<void> {
  try {
    // Check if exists
    await this.http.get(`/api/v2/variables/${key}`);
    // Exists, update with PATCH
    await this.http.patch(`/api/v2/variables/${key}`, { key, value, description: description || '' });
  } catch (getError: any) {
    if (getError.status === 404) {
      // Doesn't exist, create with POST
      await this.http.post('/api/v2/variables', { key, value, description: description || '' });
    } else {
      throw getError;
    }
  }
}
```

**Pattern**: GET to check existence, then PATCH or POST

---

## 6. MwaaClient (AWS MWAA)

### 6.1 Overview
- **Target**: AWS Managed Workflows for Apache Airflow
- **API Version**: v1 (Airflow 2.x)
- **Authentication**: AWS SigV4 via CLI token

### 6.2 Architecture
```typescript
class MwaaClient implements IAirflowClient {
  private mwaaClient: MWAAClient;           // AWS SDK client
  private environmentName: string;
  private http?: HttpClient;                // Lazy-initialized
  private webserverUrl?: string;            // Cached URL
  
  constructor(environmentName: string, region: string) {
    this.environmentName = environmentName;
    this.mwaaClient = new MWAAClient({ region });
  }
}
```

### 6.3 Token-Based Authentication

#### 6.3.1 Get Webserver URL and Token
```typescript
private async getWebserverUrl(): Promise<string> {
  if (this.webserverUrl) return this.webserverUrl;
  
  // Get CLI token from AWS MWAA
  const command = new CreateCliTokenCommand({ Name: this.environmentName });
  const response = await this.mwaaClient.send(command);
  
  this.webserverUrl = response.WebServerHostname || '';
  const token = response.CliToken || '';
  
  // Initialize HTTP client with Bearer token
  this.http = new HttpClient(`https://${this.webserverUrl}`, {
    'Authorization': `Bearer ${token}`
  });
  
  return this.webserverUrl;
}
```

**AWS API**: `CreateCliToken` returns:
- `WebServerHostname`: MWAA webserver URL
- `CliToken`: Short-lived bearer token (valid for 60 seconds)

#### 6.3.2 Ensure Client Initialized
```typescript
private async ensureClient(): Promise<HttpClient> {
  if (!this.http) {
    await this.getWebserverUrl();
  }
  return this.http!;
}
```

**Pattern**: Lazy initialization on first API call

### 6.4 API Method Implementation
```typescript
async listDags(): Promise<DagSummary[]> {
  const http = await this.ensureClient();  // Ensure token obtained
  const response = await http.get<any>('/api/v1/dags?limit=100');
  
  return response.dags.map((dag: any) => ({
    dagId: dag.dag_id,
    paused: dag.is_paused,
    schedule: dag.schedule_interval,
    owner: dag.owners?.[0] || 'unknown',
    tags: dag.tags?.map((t: any) => t.name) || []
  }));
}
```

**All methods follow same pattern**:
1. Call `ensureClient()` to get authenticated HTTP client
2. Make API call using v1 endpoints
3. Transform response to model format

### 6.5 Token Refresh Strategy
- **Current**: Token obtained once per session
- **Limitation**: Token expires after 60 seconds
- **Future Enhancement**: Implement automatic token refresh on 401 errors

---

## 7. API Endpoint Reference

### 7.1 DAG Endpoints

| Operation | v1 Endpoint | v2 Endpoint | Method |
|-----------|-------------|-------------|--------|
| List DAGs | `/api/v1/dags` | `/api/v2/dags` | GET |
| Get DAG | `/api/v1/dags/{dag_id}` | `/api/v2/dags/{dag_id}` | GET |
| Pause/Unpause | `/api/v1/dags/{dag_id}` | `/api/v2/dags/{dag_id}` | PATCH |
| Delete DAG | `/api/v1/dags/{dag_id}` | `/api/v2/dags/{dag_id}` | DELETE |
| Get Details | `/api/v1/dags/{dag_id}/details` | `/api/v2/dags/{dag_id}/details` | GET |
| Get Source | `/api/v1/dagSources/{file_token}` | `/api/v2/dagSources/{dag_id}` | GET |

### 7.2 DAG Run Endpoints

| Operation | v1 Endpoint | v2 Endpoint | Method |
|-----------|-------------|-------------|--------|
| List Runs | `/api/v1/dags/{dag_id}/dagRuns` | `/api/v2/dags/{dag_id}/dagRuns` | GET |
| Trigger Run | `/api/v1/dags/{dag_id}/dagRuns` | `/api/v2/dags/{dag_id}/dagRuns` | POST |
| Set State | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}` | `/api/v2/dags/{dag_id}/dagRuns/{dag_run_id}` | PATCH |

### 7.3 Task Endpoints

| Operation | v1 Endpoint | v2 Endpoint | Method |
|-----------|-------------|-------------|--------|
| List Tasks | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances` | `/api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances` | GET |
| Get Logs | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}` | `/api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}/logs/{try_number}` | GET |
| Clear Tasks | `/api/v1/dags/{dag_id}/clearTaskInstances` | `/api/v2/dags/{dag_id}/clearTaskInstances` | POST |
| Set State | `/api/v1/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | `/api/v2/dags/{dag_id}/dagRuns/{dag_run_id}/taskInstances/{task_id}` | PATCH |

### 7.4 Admin Endpoints

| Operation | v1 Endpoint | v2 Endpoint | Method |
|-----------|-------------|-------------|--------|
| List Variables | `/api/v1/variables` | `/api/v2/variables` | GET |
| Get Variable | `/api/v1/variables/{key}` | `/api/v2/variables/{key}` | GET |
| Create Variable | `/api/v1/variables` | `/api/v2/variables` | POST |
| Update Variable | `/api/v1/variables/{key}` | `/api/v2/variables/{key}` | PATCH |
| Delete Variable | `/api/v1/variables/{key}` | `/api/v2/variables/{key}` | DELETE |
| List Pools | `/api/v1/pools` | `/api/v2/pools` | GET |
| Get Pool | `/api/v1/pools/{name}` | `/api/v2/pools/{name}` | GET |
| Create Pool | `/api/v1/pools` | `/api/v2/pools` | POST |
| Update Pool | `/api/v1/pools/{name}` | `/api/v2/pools/{name}` | PATCH |
| Delete Pool | `/api/v1/pools/{name}` | `/api/v2/pools/{name}` | DELETE |
| List Connections | `/api/v1/connections` | `/api/v2/connections` | GET |
| Get Connection | `/api/v1/connections/{id}` | `/api/v2/connections/{id}` | GET |
| Create Connection | `/api/v1/connections` | `/api/v2/connections` | POST |
| Update Connection | `/api/v1/connections/{id}` | `/api/v2/connections/{id}` | PATCH |
| Delete Connection | `/api/v1/connections/{id}` | `/api/v2/connections/{id}` | DELETE |

### 7.5 Monitoring Endpoints

| Operation | v1 Endpoint | v2 Endpoint | Method |
|-----------|-------------|-------------|--------|
| Health Check | `/api/v1/health` | `/api/v2/monitor/health` | GET |
| Version | `/api/v1/version` | `/api/v2/version` | GET |
| DAG Stats | N/A (computed) | `/api/v2/dagStats` | GET |

---

## 8. Error Handling

### 8.1 HTTP Error Codes

| Code | Meaning | Handling Strategy |
|------|---------|-------------------|
| 400 | Bad Request | Show error message to user |
| 401 | Unauthorized | Prompt for credentials |
| 403 | Forbidden | Show permission error |
| 404 | Not Found | Try alternative method (upsert pattern) |
| 500 | Server Error | Show error, suggest checking Airflow logs |
| 503 | Service Unavailable | Show error, suggest checking Airflow status |

### 8.2 Error Handling Pattern
```typescript
async someOperation() {
  try {
    Logger.info('Operation started', { context });
    const result = await this.http.get('/api/v1/endpoint');
    Logger.info('Operation succeeded', { result });
    return result;
  } catch (error: any) {
    Logger.error('Operation failed', error, { context });
    throw error;  // Re-throw for caller to handle
  }
}
```

### 8.3 Retry Logic
**Current**: No automatic retry
**Future Enhancement**: Implement exponential backoff for transient errors

---

**End of Part 2**

**Next**: Part 3 - Managers, Providers & UI Components
