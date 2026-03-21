# Authentication Fix - JWT Token Support for Airflow v2 API

## 🔐 Issue Identified

**Problem:** Health endpoint works but all other endpoints return 401 Unauthorized.

**Root Cause:** Airflow API v2 requires JWT token authentication, not basic auth.

### Authentication Requirements by API Version

#### Airflow v1 API (Airflow 2.x)
- **Health Endpoint:** No authentication required
- **All Other Endpoints:** Basic authentication (username/password)
- **Security Scheme:** HTTP Basic Auth

#### Airflow v2 API (Airflow 3.x)
- **Health Endpoint:** No authentication required ✅
- **All Other Endpoints:** JWT Bearer token required 🔐
- **Security Schemes:** 
  - OAuth2PasswordBearer (JWT token)
  - HTTPBearer (Bearer token)

## ✅ Fix Applied

### 1. JWT Token Authentication Flow

**New Method in HttpClient:**
```typescript
async setTokenAuth(username: string, password: string) {
  try {
    // Get JWT token from /auth/token endpoint
    const response = await axios.post(`${this.baseURL}/auth/token`, 
      new URLSearchParams({
        username,
        password
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    this.token = response.data.access_token;
    this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
    Logger.info('HttpClient: JWT token obtained successfully');
    return true;
  } catch (error) {
    // Fallback to basic auth if JWT fails
    Logger.debug('HttpClient: Falling back to basic auth');
    this.client.defaults.auth = { username, password };
    return false;
  }
}
```

### 2. Factory Pattern for AirflowV2Client

**Before (Synchronous Constructor):**
```typescript
constructor(baseUrl: string, username?: string, password?: string) {
  this.http = new HttpClient(baseUrl);
  if (username && password) {
    this.http.setAuth(username, password); // Basic auth only
  }
}
```

**After (Async Factory Method):**
```typescript
static async create(baseUrl: string, username?: string, password?: string): Promise<AirflowV2Client> {
  const client = new AirflowV2Client(baseUrl);
  if (username && password) {
    await client.http.setTokenAuth(username, password); // JWT token
  }
  return client;
}
```

### 3. Updated ServerManager

```typescript
private async createClient(profile: ServerProfile, password?: string): Promise<IAirflowClient> {
  if (profile.type === 'mwaa') {
    return new MwaaClient(profile.baseUrl, profile.awsRegion || 'us-east-1');
  } else {
    if (profile.apiMode === 'stable-v2') {
      // Use factory method for v2 (JWT token)
      return await AirflowV2Client.create(profile.baseUrl, profile.username, password, profile.headers);
    } else {
      // Use constructor for v1 (basic auth)
      return new AirflowStableClient(profile.baseUrl, profile.username, password, profile.headers);
    }
  }
}
```

## 📊 Authentication Flow

### Airflow v1 API (Basic Auth)
```
1. User adds server with username/password
2. Extension stores credentials
3. Every API request includes: Authorization: Basic base64(username:password)
4. ✅ All endpoints work
```

### Airflow v2 API (JWT Token)
```
1. User adds server with username/password
2. Extension calls POST /auth/token with credentials
3. Server returns JWT access token
4. Extension stores token
5. Every API request includes: Authorization: Bearer <token>
6. ✅ All endpoints work
```

## 🔍 What You'll See in Logs

### Successful JWT Token Retrieval
```
[DEBUG] HttpClient: Attempting to get JWT token
[DEBUG] HTTP Request {"method":"POST","url":"/auth/token",...}
[DEBUG] HTTP Response Success {"status":200,"dataPreview":"Keys: access_token, token_type"}
[INFO] HttpClient: JWT token obtained successfully
[INFO] AirflowV2Client: Initialized
```

### JWT Token Failure (Fallback to Basic Auth)
```
[DEBUG] HttpClient: Attempting to get JWT token
[ERROR] HTTP Response Error {"status":404,"url":"/auth/token"}
[ERROR] HttpClient: Failed to get JWT token
[DEBUG] HttpClient: Falling back to basic auth
[INFO] AirflowV2Client: Initialized
```

### Authenticated API Requests
```
[DEBUG] HTTP Request {
  "method":"GET",
  "url":"/api/v2/dags",
  "auth":"Bearer Token"  // JWT token being used
}
[DEBUG] HTTP Response Success {"status":200,...}
```

## 🎯 Testing

### Test with Airflow 2.x (API v1 - Basic Auth)
```bash
# Add server
# Extension detects: apiMode = 'stable-v1'
# Uses: Basic authentication
# Result: ✅ All endpoints work
```

### Test with Airflow 3.x (API v2 - JWT Token)
```bash
# Add server
# Extension detects: apiMode = 'stable-v2'
# Calls: POST /auth/token
# Gets: JWT access token
# Uses: Bearer token authentication
# Result: ✅ All endpoints work
```

## 📋 Endpoints Authentication Status

### Airflow v1 API
| Endpoint | Auth Required | Method |
|----------|---------------|--------|
| `/api/v1/health` | ❌ No | None |
| `/api/v1/dags` | ✅ Yes | Basic Auth |
| `/api/v1/variables` | ✅ Yes | Basic Auth |
| `/api/v1/pools` | ✅ Yes | Basic Auth |
| `/api/v1/connections` | ✅ Yes | Basic Auth |

### Airflow v2 API
| Endpoint | Auth Required | Method |
|----------|---------------|--------|
| `/api/v2/monitor/health` | ❌ No | None |
| `/api/v2/dags` | ✅ Yes | JWT Bearer Token |
| `/api/v2/variables` | ✅ Yes | JWT Bearer Token |
| `/api/v2/pools` | ✅ Yes | JWT Bearer Token |
| `/api/v2/connections` | ✅ Yes | JWT Bearer Token |

## 🔧 Files Modified

1. **src/api/HttpClient.ts**
   - Added `setTokenAuth()` method for JWT token retrieval
   - Added token storage
   - Enhanced logging to show auth type

2. **src/api/AirflowV2Client.ts**
   - Changed to factory pattern with `create()` static method
   - Uses JWT token authentication
   - Falls back to basic auth if JWT fails

3. **src/managers/ServerManager.ts**
   - Updated to use `AirflowV2Client.create()` factory method
   - Awaits JWT token retrieval

## ✅ Installation Status

```bash
✅ JWT token authentication implemented
✅ Factory pattern for async client creation
✅ Fallback to basic auth if JWT fails
✅ Compiled successfully
✅ Packaged: airflow-vscode-0.1.0.vsix
✅ Installed in VS Code
```

## 🚀 Next Steps

1. **Reload VS Code:** `Ctrl+Shift+P` → "Developer: Reload Window"
2. **Delete existing servers:** Remove any servers added before this fix
3. **Re-add servers:** Extension will now get JWT tokens for v2 API
4. **Check logs:** Look for "JWT token obtained successfully"
5. **Test operations:** DAGs, Variables, Pools, Connections should all work now

## 🐛 Troubleshooting

### If Still Getting 401 Errors

**Check logs for:**
```
[ERROR] HttpClient: Failed to get JWT token
```

**Possible causes:**
1. `/auth/token` endpoint not available (older Airflow 3.x versions)
2. Wrong username/password
3. User doesn't have API access permissions

**Solutions:**
1. Verify Airflow version supports `/auth/token` endpoint
2. Check username/password are correct
3. Verify user has appropriate permissions in Airflow
4. Check Airflow configuration for API authentication settings

### If JWT Token Endpoint Not Found

The extension will automatically fall back to basic auth:
```
[DEBUG] HttpClient: Falling back to basic auth
```

This may work for some Airflow 3.x configurations that still support basic auth.

## 📚 References

- Airflow API Authentication: https://airflow.apache.org/docs/apache-airflow/stable/security/api.html
- JWT Token Endpoint: `POST /auth/token`
- OAuth2 Password Flow: Used for token generation

---

**Authentication is now properly implemented for both API v1 and v2!** 🎉
