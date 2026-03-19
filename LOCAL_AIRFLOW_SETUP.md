# 🚀 Local Airflow Setup Guide

## Quick Setup for Testing the Extension

This guide will help you set up a local Airflow instance using Docker for testing the VSCode extension.

---

## 📋 Prerequisites

### Required Software
- **Docker**: Install from https://docs.docker.com/get-docker/
- **Docker Compose**: Usually included with Docker Desktop

### Verify Installation
```bash
docker --version
# Should show: Docker version 20.x.x or higher

docker-compose --version
# Should show: Docker Compose version 2.x.x or higher
```

---

## 🏗️ Setup Steps

### Step 1: Navigate to Project Directory
```bash
cd /workspaces/Airflow-vscode-extension
```

### Step 2: Start Airflow
```bash
# Start all services
docker-compose up -d

# This will:
# - Download Airflow Docker image (~1-2 GB)
# - Start PostgreSQL database
# - Initialize Airflow database
# - Start Airflow webserver (port 8080)
# - Start Airflow scheduler
# - Load example DAGs
```

### Step 3: Wait for Services to Start
```bash
# Check status (wait until all are "healthy")
docker-compose ps

# Watch logs (Ctrl+C to exit)
docker-compose logs -f

# Wait for this message:
# "Airflow is ready"
```

This usually takes **2-3 minutes** on first run.

### Step 4: Verify Airflow is Running
```bash
# Check webserver is accessible
curl http://localhost:8080/health

# Should return: {"metadatabase":{"status":"healthy"},...}
```

---

## 🌐 Access Airflow

### Web UI
- **URL**: http://localhost:8080
- **Username**: `airflow`
- **Password**: `airflow`

### API Endpoints
- **API v1**: http://localhost:8080/api/v1
- **API v2**: http://localhost:8080/api/v2

---

## 🔌 Connect VSCode Extension

### Connection Details
```
Type: Self-Hosted Airflow
API URL: http://localhost:8080/api/v1
Username: airflow
Password: airflow
```

### Steps in VSCode
1. Click the **cloud icon** in Activity Bar
2. Click **"Connect to Airflow"**
3. Select **"Self-Hosted Airflow"**
4. Enter the details above
5. Click **Test Connection**
6. Should show: ✅ **"Connection successful!"**

---

## 📊 Available DAGs

After setup, you'll have these DAGs available:

### Custom Test DAGs (in ./dags/)
1. **test_dag_simple**
   - Owner: airflow
   - Tags: test, example
   - 3 tasks: bash, python hello, python date
   - Good for: Basic testing

2. **test_dag_advanced**
   - Owner: test_user
   - Tags: test, advanced, demo
   - 5 tasks with parallel execution
   - Good for: Testing running states, logs

### Example DAGs (from Airflow)
- **example_bash_operator**
- **example_python_operator**
- **example_xcom**
- **tutorial**
- And many more...

---

## 🧪 Testing Scenarios

### Test 1: View DAGs
1. Connect to Airflow
2. DAG list should load
3. You should see 50+ DAGs (examples + custom)

### Test 2: Trigger a DAG
1. Right-click on **test_dag_simple**
2. Select **"Trigger DAG"**
3. Should show success message
4. DAG should show spinning icon (running)
5. After ~10 seconds, should show ✅ (success)

### Test 3: View Logs
1. Right-click on **test_dag_simple** (after it runs)
2. Select **"View Logs"**
3. Should open editor with task logs
4. Logs should show task execution details

### Test 4: View Source Code
1. Right-click on **test_dag_simple**
2. Select **"View Source Code"**
3. Should open editor with Python code
4. Should show the DAG definition

### Test 5: Pause/Unpause
1. Right-click on **test_dag_simple**
2. Select **"Pause DAG"**
3. DAG should show pause icon ⏸️
4. Right-click and select **"Unpause DAG"**
5. Pause icon should disappear

### Test 6: Filter DAGs
1. Click **Filter** icon in toolbar
2. Enter: `test`
3. Should show only test_dag_simple and test_dag_advanced
4. Clear filter to see all DAGs

### Test 7: Favorites
1. Right-click on **test_dag_simple**
2. Select **"Add to Favorites"**
3. Click **Favorites** icon in toolbar
4. Should show only favorited DAG

### Test 8: Trigger with Config
1. Right-click on **test_dag_advanced**
2. Select **"Trigger DAG with Config"**
3. Enter: `{"key": "value"}`
4. Should trigger successfully
5. Config will be available in task context

---

## 🛠️ Useful Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Webserver only
docker-compose logs -f airflow-webserver

# Scheduler only
docker-compose logs -f airflow-scheduler
```

### Restart Services
```bash
# Restart all
docker-compose restart

# Restart specific service
docker-compose restart airflow-webserver
```

### Stop Airflow
```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Access Airflow CLI
```bash
# Run Airflow commands
docker-compose exec airflow-webserver airflow dags list
docker-compose exec airflow-webserver airflow dags trigger test_dag_simple
docker-compose exec airflow-webserver airflow dags state test_dag_simple
```

### Check Service Status
```bash
# List all services
docker-compose ps

# Check health
docker-compose ps | grep healthy
```

---

## 📁 Project Structure

```
Airflow-vscode-extension/
├── docker-compose.yml          # Docker configuration
├── .env                        # Environment variables
├── dags/                       # Your DAG files
│   ├── test_dag_simple.py     # Simple test DAG
│   └── test_dag_advanced.py   # Advanced test DAG
├── logs/                       # Airflow logs
└── plugins/                    # Airflow plugins
```

---

## 🔧 Troubleshooting

### Issue: Port 8080 already in use
**Solution**:
```bash
# Find process using port 8080
lsof -i :8080

# Kill the process or change Airflow port
# Edit docker-compose.yml:
# ports:
#   - "8081:8080"  # Use 8081 instead
```

### Issue: Services not starting
**Solution**:
```bash
# Check logs
docker-compose logs

# Restart services
docker-compose down
docker-compose up -d

# Clean start
docker-compose down -v
docker-compose up -d
```

### Issue: Permission denied on logs/dags
**Solution**:
```bash
# Fix permissions
sudo chown -R 50000:0 logs dags plugins

# Or set AIRFLOW_UID in .env
echo "AIRFLOW_UID=$(id -u)" >> .env
docker-compose down
docker-compose up -d
```

### Issue: Database connection error
**Solution**:
```bash
# Wait for postgres to be ready
docker-compose logs postgres

# Restart init
docker-compose restart airflow-init
```

### Issue: DAGs not appearing
**Solution**:
```bash
# Check DAG files
ls -la dags/

# Check scheduler logs
docker-compose logs airflow-scheduler

# Trigger DAG scan
docker-compose exec airflow-webserver airflow dags list-import-errors
```

---

## 🎯 Testing Checklist

Use this checklist to verify everything works:

### Setup
- [ ] Docker and Docker Compose installed
- [ ] Services started successfully
- [ ] Web UI accessible at http://localhost:8080
- [ ] Can login with airflow/airflow
- [ ] DAGs visible in web UI

### Extension Connection
- [ ] VSCode extension installed
- [ ] Extension activated
- [ ] Connected to http://localhost:8080/api/v1
- [ ] DAGs loaded in extension
- [ ] Can see test_dag_simple and test_dag_advanced

### DAG Operations
- [ ] Can trigger test_dag_simple
- [ ] Can view logs
- [ ] Can view source code
- [ ] Can pause/unpause DAG
- [ ] Can filter DAGs
- [ ] Can add to favorites
- [ ] Can trigger with config

### Advanced Testing
- [ ] Running DAG shows spinning icon
- [ ] Completed DAG shows success/failure icon
- [ ] Auto-refresh works (every 10 seconds)
- [ ] State persists after VSCode reload
- [ ] Multiple DAGs can run simultaneously

---

## 🚀 Quick Start Commands

```bash
# Start Airflow
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f

# Stop Airflow
docker-compose down

# Clean restart
docker-compose down -v && docker-compose up -d
```

---

## 📚 Additional Resources

### Airflow Documentation
- Official Docs: https://airflow.apache.org/docs/
- API Reference: https://airflow.apache.org/docs/apache-airflow/stable/stable-rest-api-ref.html

### Docker Documentation
- Docker Compose: https://docs.docker.com/compose/
- Airflow Docker: https://airflow.apache.org/docs/docker-stack/

### Extension Documentation
- See: TESTING_GUIDE.md
- See: FINAL_STATUS.md

---

## 🎉 Ready to Test!

Your local Airflow instance is now ready for testing the VSCode extension!

**Next Steps**:
1. Start Airflow: `docker-compose up -d`
2. Wait 2-3 minutes for services to start
3. Open VSCode and connect the extension
4. Start testing!

**Connection Details**:
- URL: http://localhost:8080/api/v1
- Username: airflow
- Password: airflow

---

**Happy Testing! 🚀**
