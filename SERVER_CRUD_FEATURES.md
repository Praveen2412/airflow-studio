# Server Details Panel — Full CRUD Implementation

## Features Added

### 1. ✅ Edit Server Configuration
**Location:** Server Details Panel → Edit button

**Editable Fields:**
- Server Name
- Base URL / Environment Name
- Username (optional, leave empty to keep current)
- Password (optional, leave empty to keep current)
- AWS Region (for MWAA)
- API Mode (auto-detect, v1, v2)

**Behavior:**
- Click "Edit" button in server details view
- Form appears inline with current values pre-filled
- Password field shows placeholder `••••••••` — leave empty to keep existing password
- Server type (self-hosted/MWAA) is locked (cannot be changed after creation)
- Click "Save Changes" to update
- Click "Cancel" to return to view mode
- Success notification shown after save
- Panel refreshes to show updated data

### 2. ✅ Delete Server
**Location:** Server Details Panel → Delete button

**Behavior:**
- Click "Delete" button (red, with trash icon)
- Confirmation dialog: "Delete server "{name}"? This cannot be undone."
- If confirmed:
  - Server removed from storage
  - Credentials deleted from secret storage
  - Success notification shown
  - Servers tree refreshed
  - Panel closes automatically

### 3. ✅ Add New Server (Panel-based)
**Location:** 
- Servers tree → "➕ Add Server" item (top of list)
- Command Palette → "Airflow: Add Server"

**Form Fields:**
- Server Name (required)
- Server Type (self-hosted / AWS MWAA)
- **For Self-hosted:**
  - Base URL (required, e.g., `http://localhost:8080`)
  - Username (optional)
  - Password (optional)
- **For AWS MWAA:**
  - Environment Name (required)
  - AWS Region (default: `us-east-1`)
- API Mode (auto-detect / v1 / v2)

**Behavior:**
- Form appears in a new panel
- Server type dropdown toggles between self-hosted and MWAA fields
- Click "Add Server" to create
- Click "Cancel" to close panel
- After creation:
  - Server added to storage
  - Credentials saved to secret storage
  - Success notification shown
  - Servers tree refreshed
  - Panel switches to show the new server's details

### 4. ✅ Quick Add Server (Legacy)
**Location:** Command Palette → "Airflow: Add Server (Quick)"

**Behavior:**
- Uses `vscode.window.showInputBox` prompts (original implementation)
- Kept for backward compatibility and quick CLI-style workflow
- Recommended to use panel-based "Add Server" for better UX

---

## UI/UX Improvements

### View Mode
- Clean card-based layout
- Metrics at the top (Total/Active/Paused DAGs, Run stats)
- Health status with colored indicators
- Connection details section
- Action buttons: Edit, Delete, Refresh, Test Connection

### Edit Mode
- Inline form replaces view mode
- All fields pre-filled with current values
- Password field shows placeholder, leave empty to keep current
- Server type locked (cannot change after creation)
- Save/Cancel buttons

### Add Mode
- Clean form layout
- Dynamic field visibility based on server type
- Validation before submission
- Cancel button closes panel

---

## Technical Implementation

### State Management
- Each server panel tracked by `serverId` in static `Map`
- Special `'__new__'` serverId for "Add Server" mode
- Panel reuses same component for view/edit/add modes

### Password Handling
- Passwords stored in VS Code Secret Storage (encrypted)
- Edit form: empty password field = keep existing password
- Only updates password if new value provided

### Server Type Locking
- Server type (self-hosted/MWAA) cannot be changed after creation
- Edit form disables the type dropdown
- Prevents configuration mismatches

### Panel Lifecycle
- **View mode:** Shows server details with metrics
- **Edit mode:** Inline form for editing
- **Add mode:** Form for creating new server
- After add: Panel switches to view mode for the new server
- After delete: Panel closes automatically

---

## Commands

| Command | Description | Location |
|---------|-------------|----------|
| `airflow.addServerPanel` | Open panel-based add server form | Tree view, Command Palette |
| `airflow.addServer` | Quick add server (prompts) | Command Palette |
| `airflow.openServerDetails` | Open server details panel | Click server in tree |
| Edit button | Switch to edit mode | Server details panel |
| Delete button | Delete server with confirmation | Server details panel |

---

## User Workflows

### Adding a Server
1. Click "➕ Add Server" in Servers tree
2. Fill in server details
3. Click "Add Server"
4. Panel switches to show new server details

### Editing a Server
1. Click server in tree to open details
2. Click "Edit" button
3. Modify fields (leave password empty to keep current)
4. Click "Save Changes"
5. Panel refreshes with updated data

### Deleting a Server
1. Click server in tree to open details
2. Click "Delete" button (red)
3. Confirm deletion
4. Server removed, panel closes

### Testing Connection
1. Open server details
2. Click "Test Connection"
3. Notification shows success/failure

---

## Security Notes

- Passwords stored in VS Code Secret Storage (encrypted at rest)
- Passwords never displayed in UI (placeholder shown in edit mode)
- Empty password field in edit mode = no change to existing password
- Credentials deleted from storage when server is deleted

---

## Files Modified

1. **src/webviews/ServerDetailsPanel.ts**
   - Added `getAddServerHtml()` for add form
   - Added edit mode toggle in `getHtml()`
   - Added `updateServer()`, `deleteServer()`, `addServer()` handlers
   - Added `showNew()` static method for add mode
   - Exported `showAddServerPanel()` function

2. **src/extension.ts**
   - Added `addServerPanel()` command handler
   - Imported `showAddServerPanel` function

3. **src/providers/ServersTreeProvider.ts**
   - Updated "Add Server" tree item to use `airflow.addServerPanel` command

4. **package.json**
   - Added `airflow.addServerPanel` command
   - Renamed old command to `airflow.addServer (Quick)`

---

## Testing Checklist

- [x] Click "Add Server" in tree → Panel opens with form
- [x] Fill form and add self-hosted server → Server created
- [x] Fill form and add MWAA server → Server created
- [x] Click server in tree → Details panel opens
- [x] Click "Edit" → Form appears with current values
- [x] Edit name and URL → Changes saved
- [x] Edit with empty password → Password unchanged
- [x] Edit with new password → Password updated
- [x] Click "Delete" → Confirmation shown
- [x] Confirm delete → Server removed, panel closes
- [x] Click "Test Connection" → Result shown
- [x] Click "Refresh" → Data reloaded
