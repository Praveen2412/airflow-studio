# Airflow VS Code Extension - Technical Documentation (Part 3)

## Part 3: Core Managers and Business Logic

### 3.1 ServerManager (`src/managers/ServerManager.ts`)

The ServerManager is the central business logic layer that manages server profiles, API client creation, and server operations.

#### 3.1.1 Class Overview

```typescript
export class ServerManager {
  private context: vscode.ExtensionContext;
  private activeServerId?: string;
}
```

**Purpose**: Manages all server-related operations including CRUD operations, client creation, and connection testing.

**Dependencies**:
- `vscode.ExtensionContext` - For state persistence and secret storage
- `IAirflowClient` - Interface for API operations
- `AirflowStableClient` - Airflow 2.x API implementation
- `AirflowV2Client` - Airflow 3.x API implementation
- `MwaaClient` - AWS MWAA implementation

#### 3.1.2 Key Methods

##### Constructor
```typescript
constructor(context: vscode.ExtensionContext)
```
- Initializes the manager with VS Code extension context
- Loads the active server ID from global state
- Logs initialization details

##### getServers()
```typescript
async getServers(): Promise<ServerProfile[]>
```
- Retrieves all saved server profiles from global state
- Returns empty array if no servers exist
- Storage key: `'airflow.servers'`

##### getActiveServer()
```typescript
async getActiveServer(): Promise<ServerProfile | undefined>
```
- Returns the currently active server profile
- Searches through all servers for matching `activeServerId`
- Returns undefined if no active server is set

##### setActiveServer()
```typescript
async setActiveServer(serverId: string): Promise<void>
```
- Sets a server as the active/current server
- Updates global state with the server ID
- Storage key: `'airflow.activeServerId'`

##### addServer()
```typescript
async addServer(profile: ServerProfile, password?: string): Promise<void>
```
**Flow**:
1. Auto-detects API version if `apiMode` is 'auto'
2. Tests server health and updates `lastHealthStatus`
3. Adds profile to servers array in global state
4. Stores password securely in VS Code Secret Storage
5. Secret key format: `'airflow.password.{serverId}'`

**API Version Detection Logic**:
- First tries Airflow 3.x (API v2) by calling `/api/v2/monitor/health`
- If v2 fails, tries Airflow 2.x (API v1) by calling `/api/v1/health`
- Defaults to v1 if both fail
- Logs each attempt for debugging

##### detectApiVersion()
```typescript
private async detectApiVersion(profile: ServerProfile, password?: string): Promise<'stable-v1' | 'stable-v2'>
```
**Algorithm**:
```
1. Create AirflowV2Client instance
2. Try getHealth() call
3. If success → return 'stable-v2'
4. If fail → Create AirflowStableClient instance
5. Try getHealth() call
6. If success → return 'stable-v1'
7. If fail → return 'stable-v1' (default)
```

##### createClient()
```typescript
private async createClient(profile: ServerProfile, password?: string): Promise<IAirflowClient>
```
**Decision Tree**:
```
if (profile.type === 'mwaa')
  → return new MwaaClient(baseUrl, awsRegion)
else if (profile.apiMode === 'stable-v2')
  → return await AirflowV2Client.create(baseUrl, username, password, headers)
else
  → return new AirflowStableClient(baseUrl, username, password, headers)
```

##### getClient()
```typescript
async getClient(serverId?: string): Promise<IAirflowClient | undefined>
```
**Flow**:
1. If serverId provided, find that specific server
2. Otherwise, get the active server
3. Return undefined if no server found
4. Retrieve password from Secret Storage
5. Call `createClient()` with server profile and password
6. Return the created client instance

##### updateServer()
```typescript
async updateServer(profile: ServerProfile, password?: string): Promise<void>
```
- Finds server by ID in the servers array
- Replaces the profile at that index
- Updates password in Secret Storage if provided
- Saves updated array to global state

##### deleteServer()
```typescript
async deleteServer(serverId: string): Promise<void>
```
**Flow**:
1. Filter out the server from servers array
2. Save filtered array to global state
3. Delete password from Secret Storage
4. If deleted server was active, clear `activeServerId`

##### testConnection()
```typescript
async testConnection(serverId: string): Promise<{ success: boolean; message: string }>
```
**Flow**:
1. Get client for the specified server
2. Call `client.getHealth()`
3. If successful → return `{ success: true, message: 'Connection successful' }`
4. If error → return `{ success: false, message: error.message }`
5. Log all attempts and results

#### 3.1.3 Data Storage Strategy

**Global State Storage** (Persistent across VS Code sessions):
- `'airflow.servers'` → Array of ServerProfile objects
- `'airflow.activeServerId'` → String ID of active server

**Secret Storage** (Encrypted):
- `'airflow.password.{serverId}'` → Password for each server
- Automatically deleted when server is removed

**Storage Flow Diagram**:
```
User Action
    ↓
ServerManager Method
    ↓
├─→ Global State (context.globalState.update())
│   - Server profiles
│   - Active server ID
│
└─→ Secret Storage (context.secrets.store())
    - Passwords (encrypted)
```

#### 3.1.4 Error Handling

All methods implement try-catch blocks with:
- Detailed error logging via Logger
- Contextual information (serverId, operation type)
- User-friendly error messages
- Graceful degradation (returns undefined/empty arrays)

#### 3.1.5 Integration Points

**Used By**:
- `ServersTreeProvider` - Display server list
- `DagsTreeProvider` - Get client for DAG operations
- `AdminTreeProvider` - Get client for admin operations
- All webview panels - Server operations and API calls
- Extension commands - All server-related commands

**Uses**:
- `AirflowStableClient` - Airflow 2.x API calls
- `AirflowV2Client` - Airflow 3.x API calls
- `MwaaClient` - AWS MWAA API calls
- `Logger` - Comprehensive logging
- VS Code APIs - State and secret storage

---

### 3.2 Logger Utility (`src/utils/logger.ts`)

#### 3.2.1 Class Overview

```typescript
export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug';
}
```

**Purpose**: Centralized logging system for debugging and monitoring extension behavior.

#### 3.2.2 Key Features

##### Initialization
```typescript
static initialize(context: vscode.ExtensionContext)
```
- Creates output channel named "Airflow Extension"
- Registers channel for disposal
- Sets default log level to 'debug'

##### Log Levels
```typescript
static debug(message: string, ...args: any[])
static info(message: string, ...args: any[])
static warn(message: string, ...args: any[])
static error(message: string, error?: any, ...args: any[])
```

**Level Hierarchy**: debug < info < warn < error

##### Log Format
```
[TIMESTAMP] [LEVEL] MESSAGE ARGS
```

Example:
```
[2024-01-15T10:30:45.123Z] [INFO] ServerManager.addServer: Success {"serverId":"1234567890"}
```

##### Circular Reference Handling
```typescript
private static safeStringify(obj: any): string
```
- Prevents JSON.stringify errors on circular objects
- Replaces circular references with '[Circular]'
- Safely serializes complex objects

##### Error Logging Enhancement
```typescript
static error(message: string, error?: any, ...args: any[])
```
Extracts detailed error information:
- `error.message` - Error message
- `error.stack` - Stack trace
- `error.name` - Error type
- `error.code` - Error code
- `error.response?.status` - HTTP status
- `error.response?.statusText` - HTTP status text

##### Output Control
```typescript
static show()
```
- Reveals the output channel to user
- Called automatically on errors
- Can be manually triggered

#### 3.2.3 Usage Patterns

**Standard Logging**:
```typescript
Logger.info('Operation started', { userId: '123', action: 'trigger' });
```

**Error Logging**:
```typescript
try {
  await someOperation();
} catch (error: any) {
  Logger.error('Operation failed', error, { context: 'additional info' });
}
```

**Debug Logging**:
```typescript
Logger.debug('Variable state', { count: items.length, first: items[0] });
```

#### 3.2.4 Integration

**Used Throughout**:
- All API clients (HttpClient, AirflowStableClient, AirflowV2Client, MwaaClient)
- ServerManager
- All tree providers
- All webview panels
- Extension activation and commands

**Benefits**:
- Centralized log viewing in VS Code Output panel
- Consistent log format across extension
- Easy debugging of production issues
- Performance monitoring
- User action tracking

---

### 3.3 State Management Architecture

#### 3.3.1 State Layers

**Layer 1: VS Code Global State**
- Persistent across sessions
- Stored in VS Code's storage
- Used for: Server profiles, active server ID

**Layer 2: VS Code Secret Storage**
- Encrypted storage
- OS-level security
- Used for: Passwords, tokens

**Layer 3: In-Memory State**
- Tree provider data caches
- Webview panel instances
- Active client connections

#### 3.3.2 State Flow

```
User Action
    ↓
Command Handler (extension.ts)
    ↓
ServerManager (business logic)
    ↓
├─→ Global State Update
├─→ Secret Storage Update
└─→ Tree Provider Refresh
    ↓
UI Update
```

#### 3.3.3 State Synchronization

**Tree Providers**:
- Listen to ServerManager changes
- Refresh on data updates
- Fire `onDidChangeTreeData` events

**Webview Panels**:
- Maintain own state
- Request fresh data on refresh
- Receive updates via postMessage

**Status Bar**:
- Updates on active server change
- Shows current server name
- Reflects connection status

---

### 3.4 Client Factory Pattern

#### 3.4.1 Pattern Implementation

The ServerManager implements a factory pattern for creating API clients:

```typescript
// Factory method
private async createClient(profile: ServerProfile, password?: string): Promise<IAirflowClient>

// Public accessor
async getClient(serverId?: string): Promise<IAirflowClient | undefined>
```

#### 3.4.2 Client Selection Logic

```
Input: ServerProfile
    ↓
Check: profile.type
    ↓
├─→ 'mwaa' → MwaaClient
│   - Uses AWS SDK
│   - Token-based auth
│   - Region-specific
│
└─→ 'self-hosted'
    ↓
    Check: profile.apiMode
    ↓
    ├─→ 'stable-v2' → AirflowV2Client
    │   - JWT token auth
    │   - /api/v2/* endpoints
    │   - Airflow 3.x
    │
    └─→ 'stable-v1' → AirflowStableClient
        - Basic auth
        - /api/v1/* endpoints
        - Airflow 2.x
```

#### 3.4.3 Benefits

- **Abstraction**: Commands don't need to know client type
- **Flexibility**: Easy to add new client types
- **Consistency**: All clients implement IAirflowClient
- **Testability**: Can mock client creation
- **Maintainability**: Client logic centralized

---

### 3.5 Security Considerations

#### 3.5.1 Password Storage

**Secure Storage**:
- Uses VS Code Secret Storage API
- OS-level encryption (Keychain on macOS, Credential Manager on Windows, Secret Service on Linux)
- Never stored in plain text
- Automatically cleared on server deletion

**Access Pattern**:
```typescript
// Store
await context.secrets.store(`airflow.password.${serverId}`, password);

// Retrieve
const password = await context.secrets.get(`airflow.password.${serverId}`);

// Delete
await context.secrets.delete(`airflow.password.${serverId}`);
```

#### 3.5.2 Credential Handling

**In Memory**:
- Passwords only held during API calls
- Not cached in variables
- Cleared after client creation

**In Logs**:
- Passwords never logged
- Auth headers logged as 'Basic Auth' or 'Bearer Token'
- Sensitive data masked

**In UI**:
- Password fields use `type="password"`
- Secrets masked in webviews
- No display of raw credentials

#### 3.5.3 Network Security

**HTTPS Enforcement**:
- Recommended for production
- Warnings for HTTP connections
- Certificate validation enabled

**Token Management**:
- JWT tokens for Airflow 3.x
- AWS temporary tokens for MWAA
- Token refresh handled automatically

---

## Summary

Part 3 covered:
- **ServerManager**: Central business logic for server management
- **Logger**: Comprehensive logging system
- **State Management**: Multi-layer state architecture
- **Client Factory**: Pattern for creating API clients
- **Security**: Credential storage and handling

**Next Part Preview**: Part 4 will cover Tree Providers and UI components.
