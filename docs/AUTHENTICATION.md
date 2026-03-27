# Authentication Architecture

## Overview

The extension now supports **all combinations** of Airflow API versions and authentication backends through a unified, intelligent detection system.

## Supported Configurations

### 1. Self-Hosted Airflow 2.x (API v1)
- **Basic Auth**: `auth_backends = airflow.api.auth.backend.basic_auth`
- **Session Auth**: `auth_backends = airflow.api.auth.backend.session`
- **JWT Auth**: `auth_backends = airflow.api.auth.backend.jwt_token` (rare in 2.x)

### 2. Self-Hosted Airflow 3.x (API v2)
- **JWT Token Auth**: Default authentication via `/auth/token` endpoint
- Requires username/password to obtain JWT token
- Token cached for 50 minutes with automatic refresh

### 3. AWS MWAA
- **AWS SigV4 → Web Login Token → JWT**
- Automatic AWS credential resolution
- Supports both API v1 and v2
- Token cached for 50 minutes

## Architecture Components

### AirflowClientFactory
Central factory that detects and creates the appropriate client.

**Detection Flow:**
```
1. Try API v2 with JWT (Airflow 3.x)
   ↓ (if fails)
2. Try API v1 with Basic Auth
   ↓ (if fails)
3. Try API v1 with Session Auth
   ↓ (if fails)
4. Throw error
```

**Methods:**
- `createClient()`: Auto-detects API version and auth backend
- `createClientFromProfile()`: Creates client from known configuration (faster)

### Client Implementations

#### 1. AirflowV2Client
- **API**: v2 (`/api/v2/*`)
- **Auth**: JWT tokens via `/auth/token`
- **Use Case**: Airflow 3.x
- **Features**: 
  - Automatic token refresh on 401
  - Token caching (50 minutes)
  - Fallback to Basic Auth if JWT fails

#### 2. AirflowStableClient
- **API**: v1 (`/api/v1/*`)
- **Auth**: HTTP Basic Authentication
- **Use Case**: Airflow 2.x with `basic_auth` backend
- **Features**:
  - Simple username/password
  - No token management needed

#### 3. AirflowSessionClient
- **API**: v1 (`/api/v1/*`)
- **Auth**: Session cookies via login form
- **Use Case**: Airflow 2.x with `session` backend
- **Features**:
  - CSRF token extraction
  - Session cookie management
  - Automatic session refresh on 401
  - Session caching (50 minutes)

#### 4. MwaaClient
- **API**: v1 or v2 (configurable)
- **Auth**: AWS SigV4 → CreateWebLoginToken → JWT
- **Use Case**: AWS MWAA environments
- **Features**:
  - Automatic AWS credential resolution
  - Token exchange flow
  - Delegates to AirflowStableClient or AirflowV2Client

### HTTP Clients

#### HttpClient
- Used by AirflowStableClient and AirflowV2Client
- Supports Basic Auth and JWT tokens
- Automatic token refresh on 401

#### SessionHttpClient
- Used by AirflowSessionClient
- Handles CSRF tokens and session cookies
- Multi-step login flow:
  1. GET `/login/` → Extract CSRF token and session cookie
  2. POST `/login/` with credentials + CSRF → Get authenticated session
  3. Use session cookie for all API requests

## ServerProfile Model

```typescript
interface ServerProfile {
  id: string;
  name: string;
  type: 'self-hosted' | 'mwaa';
  baseUrl: string;
  awsRegion?: string;
  authBackend?: 'basic' | 'session' | 'jwt' | 'aws' | 'auto';  // Auto-detected
  username?: string;
  apiMode: 'stable-v1' | 'stable-v2' | 'auto';
  // ... other fields
}
```

**Key Fields:**
- `authBackend`: Detected during first connection, stored for future use
- `apiMode`: API version (v1 or v2)
- `type`: Determines if MWAA or self-hosted

## Authentication Flow

### First Connection (Auto-Detection)
```
User adds server with username/password
  ↓
ServerManager.addServer()
  ↓
AirflowClientFactory.createClient()
  ↓
Try each auth method in order:
  1. API v2 + JWT
  2. API v1 + Basic Auth
  3. API v1 + Session Auth
  ↓
First successful method is used
  ↓
Store authBackend in ServerProfile
  ↓
Cache client for 5 minutes
```

### Subsequent Connections (Fast Path)
```
User expands DAGs folder
  ↓
ServerManager.getClient()
  ↓
Check client cache (5 min TTL)
  ↓ (if expired)
AirflowClientFactory.createClientFromProfile()
  ↓
Use stored authBackend (no detection)
  ↓
Return client immediately
```

### Session Refresh (Automatic)
```
API request returns 401
  ↓
HttpClient/SessionHttpClient detects 401
  ↓
Clear cached token/session
  ↓
Re-authenticate automatically
  ↓
Retry original request
  ↓
Return result to user
```

## Configuration Examples

### Airflow 2.x with Session Auth (Your Case)
```ini
# airflow.cfg
[api]
auth_backends = airflow.api.auth.backend.session
```

**Extension Behavior:**
1. Tries JWT → Fails (no `/auth/token` endpoint)
2. Tries Basic Auth → Fails (401)
3. Tries Session Auth → Success!
4. Stores `authBackend: 'session'` in profile
5. Future connections use session auth directly

### Airflow 2.x with Basic Auth
```ini
# airflow.cfg
[api]
auth_backends = airflow.api.auth.backend.basic_auth
```

**Extension Behavior:**
1. Tries JWT → Fails
2. Tries Basic Auth → Success!
3. Stores `authBackend: 'basic'`

### Airflow 3.x with JWT
```ini
# airflow.cfg (default in 3.x)
[api]
auth_backends = airflow.api.auth.backend.jwt_token
```

**Extension Behavior:**
1. Tries JWT → Success!
2. Stores `authBackend: 'jwt'`, `apiMode: 'stable-v2'`

### AWS MWAA
No configuration needed - uses AWS credentials.

**Extension Behavior:**
1. Detects `type: 'mwaa'`
2. Uses MwaaClient directly
3. Tries API v2, falls back to v1
4. Stores `authBackend: 'aws'`

## Caching Strategy

### Client Cache (5 minutes)
- Avoids recreating clients on every request
- Cleared when server is edited/deleted
- Key: `serverId`

### Token/Session Cache (50 minutes)
- JWT tokens cached in HttpClient
- Session cookies cached in SessionHttpClient
- Automatically refreshed on 401

### DAG List Cache (Configurable, default 5 minutes)
- Reduces API calls for tree view
- Cleared on manual refresh
- Cleared on error

## Error Handling

### 401 Unauthorized
- **Cause**: Invalid credentials or expired token/session
- **Action**: Automatic re-authentication and retry
- **User Impact**: Transparent (no error shown if retry succeeds)

### 403 Forbidden
- **Cause**: User lacks permissions
- **Action**: Show error to user
- **User Impact**: Must fix permissions in Airflow

### 404 Not Found
- **Cause**: Endpoint doesn't exist (wrong API version)
- **Action**: Try next auth method during detection
- **User Impact**: Transparent during auto-detection

### Connection Refused
- **Cause**: Server is down or URL is wrong
- **Action**: Show error to user
- **User Impact**: Must fix server URL or start Airflow

## Testing

### Test Script
Use `test-auth-all.js` to verify your Airflow configuration:

```bash
node test-auth-all.js
```

This tests all auth methods and shows which one works.

### Manual Testing
1. Delete existing server
2. Add server with auto-detect
3. Check logs for detection results
4. Verify authBackend is stored in profile

## Troubleshooting

### "Failed to authenticate with any supported method"
**Cause**: None of the auth backends work
**Solution**: 
1. Run `node test-auth-all.js` to see which auth methods are available
2. Check Airflow configuration: `auth_backends` setting
3. Verify credentials are correct
4. Check Airflow logs for authentication errors

### "Session expired" errors
**Cause**: Session cache expired and refresh failed
**Solution**:
1. Check if Airflow is still running
2. Verify credentials are still valid
3. Delete and re-add server

### MWAA connection fails
**Cause**: AWS credentials not configured or insufficient permissions
**Solution**:
1. Run `aws configure` to set up credentials
2. Verify IAM permissions include `airflow:CreateWebLoginToken`
3. Check environment name and region are correct

## Performance Considerations

### First Connection
- **Time**: 2-6 seconds (tries multiple auth methods)
- **Optimization**: Specify `apiMode` and `authBackend` if known

### Subsequent Connections
- **Time**: <100ms (uses cached client and stored authBackend)
- **Optimization**: Client cache reduces overhead

### API Requests
- **Time**: Depends on Airflow response time
- **Optimization**: DAG list caching reduces redundant calls

## Security

### Credential Storage
- Passwords stored in VS Code Secret Storage (encrypted)
- Tokens/sessions cached in memory only (not persisted)
- Never logged or displayed

### Token Refresh
- Automatic refresh prevents expired token errors
- Refresh happens before expiry (50 min cache for 60 min tokens)

### Session Security
- CSRF tokens validated on every login
- Session cookies marked HttpOnly
- Sessions expire after inactivity

## Future Enhancements

### Potential Additions
1. **OAuth2 Support**: For enterprise Airflow deployments
2. **Kerberos Support**: For Hadoop-integrated Airflow
3. **Custom Auth Backends**: Plugin system for custom auth
4. **Multi-Factor Auth**: Support for 2FA/MFA flows

### Not Planned
- **No Auth**: Security risk, not recommended
- **API Keys**: Not supported by Airflow REST API
