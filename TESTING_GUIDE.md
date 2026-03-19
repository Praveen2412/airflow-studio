# 🧪 Testing Guide - Step by Step

## 🔄 Step 1: Reload VSCode

After installing the extension, reload VSCode:

### Method 1: Reload Window (Quick)
1. Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type: `Reload Window`
3. Select: `Developer: Reload Window`
4. Wait for VSCode to reload

### Method 2: Restart VSCode (Complete)
1. Close VSCode completely
2. Reopen VSCode
3. Wait for extensions to load

---

## ✅ Step 2: Verify Extension Activated

### Check Extension Status
1. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac) to open Extensions
2. Search for "Airflow"
3. You should see "Airflow VSCode Extension"
4. Status should show: **"Activated"** (not "Not yet activated")

### Check for Errors
1. Go to: `View` → `Output`
2. In the dropdown, select: `Airflow`
3. Look for activation message: `[INFO] Airflow Extension activation started`
4. Should end with: `[INFO] Airflow Extension activation completed`
5. **No errors should appear**

### Check Activity Bar
1. Look at the left sidebar (Activity Bar)
2. You should see a **cloud icon** (☁️)
3. This is the Airflow extension icon

---

## 🔌 Step 3: Open Airflow Panel

### Open the Panel
1. Click the **cloud icon** in the Activity Bar (left sidebar)
2. The Airflow panel should open on the left
3. You should see two sections:
   - **DAGs** (top)
   - **Admin** (bottom)

### Check Welcome Message
In the DAGs section, you should see:
```
Connect to your Airflow Server or AWS MWAA environment.

[Connect to Airflow]

Supports:
• Self-hosted Airflow (v2.x, v3.x)
• AWS MWAA (via AWS CLI)

For MWAA, ensure AWS CLI is configured with proper credentials.
```

---

## 🌐 Step 4: Connect to Airflow

### Option A: Test with Self-Hosted Airflow

#### Prerequisites
- Airflow running locally or remotely
- API URL (e.g., `http://localhost:8080/api/v1`)
- Username and password

#### Steps
1. Click **"Connect to Airflow"** button in the DAGs panel
2. Select: **"Self-Hosted Airflow"**
3. Enter API URL: `http://localhost:8080/api/v1` (or your URL)
4. Enter Username: (your Airflow username)
5. Enter Password: (your Airflow password)
6. Wait for connection test
7. Should show: ✅ **"Connection successful!"**

#### If Connection Fails
- Check Airflow is running: `http://localhost:8080` in browser
- Verify API is enabled in `airflow.cfg`: `auth_backend = airflow.api.auth.backend.basic_auth`
- Check username/password are correct
- Try both `/api/v1` and `/api/v2` endpoints

### Option B: Test with AWS MWAA

#### Prerequisites
- AWS CLI installed: `aws --version`
- AWS credentials configured: `aws sts get-caller-identity`
- MWAA environment created
- IAM permissions for MWAA

#### Steps
1. Click **"Connect to Airflow"** button
2. Select: **"AWS MWAA"**
3. Enter Environment Name: (your MWAA environment name)
4. Enter AWS Region: `us-east-1` (or your region)
5. Enter AWS Profile: (leave empty for default, or enter profile name)
6. Wait for connection test
7. Should show: ✅ **"Connection successful!"**

#### If Connection Fails
- Verify AWS CLI: `aws --version`
- Check credentials: `aws sts get-caller-identity`
- Verify environment exists: `aws mwaa list-environments --region us-east-1`
- Check IAM permissions

---

## 📋 Step 5: Test DAG Operations

### View DAG List
After successful connection:
1. DAGs should load automatically
2. You should see a list of DAGs in the panel
3. Each DAG shows:
   - DAG name
   - Status (Paused/Active)
   - Last run state (if any)

### Test Toolbar Buttons
At the top of the DAGs panel, you should see icons:
1. **Refresh** (↻) - Click to reload DAG list
2. **Connect** (🔌) - Switch servers
3. **Add** (+) - Add new server
4. **Remove** (−) - Remove server
5. **Filter** (🔍) - Filter DAGs
6. **Active Only** (●) - Show only active DAGs
7. **Favorites** (⭐) - Show only favorites

### Test DAG Context Menu
Right-click on any DAG to see options:
- **View DAG Details** (coming soon)
- **Trigger DAG** - Start a DAG run
- **Trigger DAG with Config** - Start with custom config
- **Pause DAG** - Pause the DAG
- **Unpause DAG** - Unpause the DAG
- **Cancel DAG Run** - Cancel running DAG
- **View Logs** - View task logs
- **View Source Code** - View DAG Python code
- **DAG Info** - View DAG metadata
- **Add to Favorites** - Bookmark DAG
- **Remove from Favorites** - Remove bookmark

---

## 🧪 Step 6: Detailed Testing

### Test 1: Trigger a DAG
1. Right-click on a DAG
2. Select **"Trigger DAG"**
3. Should show: ✅ **"DAG [name] triggered successfully!"**
4. DAG should show spinning icon (🔄) indicating it's running
5. Status should update automatically every 10 seconds

### Test 2: View Logs
1. Right-click on a DAG (that has run before)
2. Select **"View Logs"**
3. Should show: "Fetching logs..."
4. A new editor tab should open with logs
5. Logs should show task execution details

### Test 3: View Source Code
1. Right-click on any DAG
2. Select **"View Source Code"**
3. A new editor tab should open
4. Should show the Python code for the DAG

### Test 4: Filter DAGs
1. Click the **Filter** icon (🔍) in toolbar
2. Enter filter text (e.g., "example" or owner name)
3. Press Enter
4. DAG list should filter to show only matching DAGs
5. Filter message should appear at top of panel

### Test 5: Favorites
1. Right-click on a DAG
2. Select **"Add to Favorites"**
3. Click **Favorites** icon (⭐) in toolbar
4. Should show only favorite DAGs
5. Right-click and select **"Remove from Favorites"**
6. DAG should disappear from favorites view

### Test 6: Pause/Unpause
1. Right-click on an active DAG
2. Select **"Pause DAG"**
3. Should show: ✅ **"DAG [name] paused"**
4. DAG should show pause icon (⏸️)
5. Right-click and select **"Unpause DAG"**
6. Should show: ✅ **"DAG [name] unpaused"**

### Test 7: State Persistence
1. Set some filters
2. Add some favorites
3. Close VSCode completely
4. Reopen VSCode
5. Click Airflow icon
6. Verify:
   - Server connection is still active
   - Favorites are still there
   - Filter settings are preserved

---

## 🐛 Step 7: Check for Issues

### Check Output Panel
1. Go to: `View` → `Output`
2. Select: `Airflow` from dropdown
3. Look for any ERROR messages
4. All messages should be INFO or DEBUG level

### Check Developer Console
1. Press: `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac)
2. Go to **Console** tab
3. Look for any red error messages
4. Should be clean (no errors)

### Common Issues and Solutions

#### Issue: Extension not activated
**Solution**: 
- Reload window: `Ctrl+Shift+P` → "Reload Window"
- Check Output panel for errors

#### Issue: Cloud icon not visible
**Solution**:
- Check Extensions panel - extension should be enabled
- Reload window
- Reinstall extension if needed

#### Issue: Connection fails
**Solution**:
- Verify Airflow is running
- Check API URL (try both /api/v1 and /api/v2)
- Verify credentials
- Check Output panel for detailed error

#### Issue: DAGs not loading
**Solution**:
- Click Refresh button
- Check connection is active
- Verify Airflow has DAGs
- Check Output panel for errors

---

## ✅ Step 8: Success Checklist

Mark each item as you test:

### Installation & Activation
- [ ] Extension shows "Activated" status
- [ ] No errors in Output panel
- [ ] Cloud icon visible in Activity Bar
- [ ] Airflow panel opens when clicking icon

### Connection
- [ ] Can add self-hosted server
- [ ] Can add MWAA environment
- [ ] Connection test succeeds
- [ ] DAGs load after connection

### DAG Operations
- [ ] Can view DAG list
- [ ] Can trigger DAG
- [ ] Can pause/unpause DAG
- [ ] Can view logs
- [ ] Can view source code
- [ ] Can filter DAGs
- [ ] Can add/remove favorites

### UI Features
- [ ] All toolbar buttons work
- [ ] Context menu appears on right-click
- [ ] Icons display correctly
- [ ] Status updates automatically

### State Persistence
- [ ] Server connection persists after reload
- [ ] Favorites persist after reload
- [ ] Filter settings persist after reload

---

## 📊 Expected Results

### After Successful Testing

You should be able to:
1. ✅ Connect to Airflow (self-hosted or MWAA)
2. ✅ View all your DAGs
3. ✅ Trigger DAGs with one click
4. ✅ Monitor running DAGs (auto-refresh)
5. ✅ View logs and source code
6. ✅ Filter and organize DAGs
7. ✅ Manage favorites
8. ✅ All state persists across sessions

### Performance
- DAG list loads in < 5 seconds
- Triggering DAG responds immediately
- Logs load in < 10 seconds
- UI is responsive (no freezing)

---

## 🎉 Testing Complete!

If all tests pass, the extension is working correctly! 

### Next Steps
1. Use it with your real Airflow workflows
2. Report any issues you find
3. Provide feedback for improvements

### Need Help?
- Check **FINAL_STATUS.md** for troubleshooting
- Review **Output panel** for detailed logs
- Check **Developer Console** for errors

---

**Happy Testing! 🚀**
