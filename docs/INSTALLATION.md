# Installation Guide

## ✅ Extension Successfully Packaged and Installed!

### Package Details
- **File:** `airflow-vscode-0.1.0.vsix`
- **Size:** 5.3 MB
- **Files:** 3,834 files included
- **Status:** ✅ Installed and ready to use

---

## Installation Methods

### Method 1: Install from VSIX (Recommended)

The extension is already packaged and installed. To reinstall or install on another machine:

```bash
code --install-extension airflow-vscode-0.1.0.vsix --force
```

### Method 2: Install from VS Code UI

1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac) to open Extensions
3. Click the `...` menu (top right)
4. Select "Install from VSIX..."
5. Navigate to `airflow-vscode-0.1.0.vsix`
6. Click "Install"

### Method 3: Development Mode (F5)

For development and debugging:

1. Open this project in VS Code
2. Press `F5` to launch Extension Development Host
3. A new VS Code window opens with the extension loaded

---

## Verify Installation

### Check Extension is Installed
```bash
code --list-extensions | grep airflow
```

**Expected output:**
```
airflow.airflow-vscode
```

### Check Extension is Active

1. Open VS Code
2. Look for the Airflow icon in the Activity Bar (left sidebar)
3. Click it to open the Airflow panel
4. You should see three sections:
   - Servers
   - DAGs
   - Admin

---

## First Time Setup

### 1. Add Your First Server

**Option A: Using Tree View Button**
1. Click the Airflow icon in Activity Bar
2. Click "➕ Add Server" at the top of Servers section
3. Follow the prompts

**Option B: Using Command Palette**
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P`)
2. Type "Airflow: Add Server"
3. Follow the prompts

### 2. Configure Server

**For Self-hosted Airflow:**
- Base URL: `http://localhost:8080` (or your server URL)
- Username: Your Airflow username
- Password: Your Airflow password
- API Mode: `auto` (will detect v1 or v2 automatically)

**For AWS MWAA:**
- Environment Name: Your MWAA environment name
- AWS Region: e.g., `us-east-1`
- Ensure AWS credentials are configured

### 3. Verify Connection

1. Right-click the server in the tree
2. Select "Test Server Connection"
3. Check the notification for success/failure

---

## Features Available

### ✅ Server Management
- Add/Edit/Delete servers
- Auto-detect API version (v1 for Airflow 2.x, v2 for Airflow 3.x)
- Health monitoring
- Click server to view details

### ✅ DAG Management
- List all DAGs
- Click DAG to view details and recent runs
- Trigger DAG with JSON config
- Pause/Unpause DAGs
- Delete DAGs

### ✅ Admin Tools
- **Variables:** Create, view, delete
- **Pools:** Create, view, delete, monitor usage
- **Connections:** View, delete

### ✅ Logging
- All operations logged
- View logs: `View` → `Output` → "Airflow Extension"

---

## Uninstall

### From Command Line
```bash
code --uninstall-extension airflow.airflow-vscode
```

### From VS Code UI
1. Open Extensions (`Ctrl+Shift+X`)
2. Search for "Airflow"
3. Click the gear icon
4. Select "Uninstall"

---

## Rebuild Extension

If you make changes to the code:

### 1. Compile TypeScript
```bash
npm run compile
```

### 2. Package Extension
```bash
vsce package
```

### 3. Reinstall
```bash
code --install-extension airflow-vscode-0.1.0.vsix --force
```

### 4. Reload VS Code
Press `Ctrl+Shift+P` → "Developer: Reload Window"

---

## Troubleshooting Installation

### Extension Not Showing Up

1. **Reload Window:**
   - Press `Ctrl+Shift+P`
   - Type "Developer: Reload Window"
   - Press Enter

2. **Check Installation:**
   ```bash
   code --list-extensions | grep airflow
   ```

3. **Reinstall:**
   ```bash
   code --uninstall-extension airflow.airflow-vscode
   code --install-extension airflow-vscode-0.1.0.vsix --force
   ```

### Extension Not Activating

1. **Check Logs:**
   - `View` → `Output`
   - Select "Airflow Extension" from dropdown
   - Look for activation errors

2. **Check Developer Console:**
   - `Help` → `Toggle Developer Tools`
   - Look for errors in Console tab

3. **Try Development Mode:**
   - Open project in VS Code
   - Press `F5`
   - Check if it works in Extension Development Host

### Compilation Errors

If you get TypeScript errors:

```bash
# Clean and rebuild
rm -rf out/
npm run compile
```

### Package Size Warning

The warning about 3,834 files is normal. It includes:
- node_modules (required dependencies)
- OpenAPI specs (for reference)
- Documentation files
- Compiled JavaScript

To reduce size (optional):
1. Add more patterns to `.vscodeignore`
2. Bundle with webpack (advanced)

---

## Development Workflow

### 1. Make Changes
Edit TypeScript files in `src/`

### 2. Compile
```bash
npm run compile
# Or watch mode:
npm run watch
```

### 3. Test in Development
Press `F5` to launch Extension Development Host

### 4. Package and Install
```bash
vsce package
code --install-extension airflow-vscode-0.1.0.vsix --force
```

### 5. Reload VS Code
`Ctrl+Shift+P` → "Developer: Reload Window"

---

## System Requirements

- **VS Code:** 1.80.0 or higher
- **Node.js:** 18.x or higher (for development)
- **Airflow:** 2.x (API v1) or 3.x (API v2)
- **AWS CLI:** Configured (for MWAA only)

---

## Next Steps

1. ✅ Extension is installed
2. 📖 Read [QUICKSTART.md](QUICKSTART.md) for usage guide
3. 🔧 Add your Airflow servers
4. 🚀 Start managing your DAGs!

---

## Support

- **Documentation:** See `*.md` files in project root
- **Logs:** `View` → `Output` → "Airflow Extension"
- **Issues:** Check logs first, then report with log excerpts

---

## Success! 🎉

Your Airflow VS Code extension is now installed and ready to use!

**Quick Test:**
1. Click the Airflow icon in the Activity Bar
2. Click "➕ Add Server"
3. Add your Airflow server
4. Start managing your DAGs!
