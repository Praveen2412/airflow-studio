# Quick Troubleshooting Reference

## Extension Not Activating?

### Step 1: Check Logs (30 seconds)
```
1. Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
2. Type: "Output"
3. Select: "Airflow Extension"
4. Look for errors
```

### Step 2: Check Console (30 seconds)
```
1. Help → Toggle Developer Tools
2. Click Console tab
3. Look for [Airflow] messages
4. Look for red errors
```

### Step 3: Reload Window
```
1. Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
2. Type: "Reload Window"
3. Press Enter
4. Check logs again
```

## What You Should See

### In "Airflow Extension" Output:
```
[INFO] === Airflow Extension Activation Started ===
[DEBUG] Creating ServerManager...
[DEBUG] ServerManager created successfully
[DEBUG] Creating ServersTreeProvider...
[DEBUG] ServersTreeProvider created successfully
[DEBUG] Creating DagsTreeProvider...
[DEBUG] DagsTreeProvider created successfully
[DEBUG] Creating AdminTreeProvider...
[DEBUG] AdminTreeProvider created successfully
[DEBUG] Registering tree data providers...
[INFO] All tree data providers registered successfully
[INFO] Registered 16 commands successfully
[INFO] === Airflow Extension Activated Successfully ===
```

### In Developer Console:
```
[Airflow] Extension activation started
[Airflow] Extension activated successfully
```

## Common Problems

### Problem: No "Airflow Extension" in Output
**Cause**: Extension failed before Logger initialized
**Check**: Developer Console for early errors
**Fix**: Look for module loading errors

### Problem: Activation starts but doesn't finish
**Cause**: Error during initialization
**Check**: Last log message in Output
**Fix**: Look at the component that failed

### Problem: "No data provider registered"
**Cause**: Tree providers not registered
**Check**: Look for "tree provider registered" messages
**Fix**: Should see 3 providers registered

### Problem: Commands don't work
**Cause**: Commands not registered
**Check**: Look for "Registered 16 commands successfully"
**Fix**: If less than 16, check for registration errors

## Quick Commands to Test

After activation, try these:
1. `Airflow: Add Server` - Should open input dialog
2. Click Airflow icon in sidebar - Should show 3 sections
3. Check status bar - Should show "☁ Airflow"

## Get Help

Include in bug report:
1. Full "Airflow Extension" output
2. Developer Console errors
3. VS Code version (Help → About)
4. Operating system
5. What you were doing when it failed
