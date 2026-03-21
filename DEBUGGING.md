# Debugging Guide

## Comprehensive Logging Added

The extension now has extensive logging throughout all components to help diagnose activation and runtime issues.

## How to View Logs

### 1. Extension Output Channel
- Open VS Code Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Type: "Output: Show Output Channels"
- Select: **"Airflow Extension"**

This channel shows all extension-specific logs with timestamps.

### 2. Developer Console
- Open: `Help` → `Toggle Developer Tools`
- Go to **Console** tab
- Filter by "Airflow" to see extension logs

### 3. Extension Host Output
- Open: `View` → `Output`
- Select: **"Extension Host"** from dropdown
- Look for errors related to "airflow-vscode"

## What Gets Logged

### Activation Phase
- Extension activation start/completion
- VS Code version
- Manager and provider initialization
- Tree data provider registration
- Command registration (all 16 commands)
- Status bar creation
- Active server loading

### Runtime Operations
- Server operations (add, delete, get)
- Client creation (self-hosted vs MWAA)
- DAG loading and operations
- Tree provider refreshes
- HTTP requests (GET, POST, PATCH, DELETE)
- All errors with stack traces

## Debugging Steps

### If Extension Not Activating

1. **Check Output Channel**
   ```
   View → Output → Select "Airflow Extension"
   ```
   Look for:
   - "=== Airflow Extension Activation Started ==="
   - Any ERROR messages
   - Where activation stopped

2. **Check Developer Console**
   ```
   Help → Toggle Developer Tools → Console
   ```
   Look for:
   - `[Airflow] Extension activation started`
   - Red error messages
   - Stack traces

3. **Check Extension Host**
   ```
   View → Output → Select "Extension Host"
   ```
   Look for:
   - Extension loading errors
   - Module not found errors
   - Syntax errors

### Common Issues and Solutions

#### Issue: "Not yet activated"
**Check**: Output channel for activation errors
**Solution**: Look at the last log message before failure

#### Issue: "No data provider registered"
**Check**: Look for "tree provider registered" messages
**Solution**: Ensure all three providers show as registered

#### Issue: Commands not working
**Check**: Look for "Registered X commands successfully"
**Solution**: Should see "Registered 16 commands successfully"

#### Issue: Can't see logs
**Solution**: 
1. Reload window: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Check if "Airflow Extension" appears in Output channels
3. If not, extension failed to initialize Logger

## Log Levels

Current log level: **DEBUG** (most verbose)

Logs include:
- **DEBUG**: Detailed step-by-step execution
- **INFO**: Important milestones and operations
- **WARN**: Warnings that don't stop execution
- **ERROR**: Failures with full error details

## Testing Activation

1. **Close all VS Code windows**
2. **Open VS Code**
3. **Immediately open Output**: `View` → `Output` → "Airflow Extension"
4. **Open Airflow sidebar**: Click Airflow icon in Activity Bar
5. **Watch logs appear in real-time**

Expected log sequence:
```
[timestamp] [INFO] === Airflow Extension Activation Started ===
[timestamp] [DEBUG] VS Code version: ...
[timestamp] [DEBUG] Creating ServerManager...
[timestamp] [DEBUG] ServerManager created successfully
[timestamp] [DEBUG] Creating ServersTreeProvider...
[timestamp] [DEBUG] ServersTreeProvider created successfully
[timestamp] [DEBUG] Creating DagsTreeProvider...
[timestamp] [DEBUG] DagsTreeProvider created successfully
[timestamp] [DEBUG] Creating AdminTreeProvider...
[timestamp] [DEBUG] AdminTreeProvider created successfully
[timestamp] [DEBUG] Registering tree data providers...
[timestamp] [DEBUG] Servers tree provider registered
[timestamp] [DEBUG] DAGs tree provider registered
[timestamp] [DEBUG] Admin tree provider registered
[timestamp] [INFO] All tree data providers registered successfully
[timestamp] [DEBUG] Creating status bar item...
[timestamp] [DEBUG] Status bar item created and shown
[timestamp] [DEBUG] Registering commands...
[timestamp] [DEBUG] Registering command: airflow.addServer
... (16 commands total)
[timestamp] [INFO] Registered 16 commands successfully
[timestamp] [DEBUG] Loading active server...
[timestamp] [INFO] === Airflow Extension Activated Successfully ===
```

## Reporting Issues

When reporting activation issues, include:
1. Full output from "Airflow Extension" channel
2. Errors from Developer Console
3. VS Code version
4. Operating system
5. Steps to reproduce
