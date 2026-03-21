import * as vscode from 'vscode';
import { ServerManager } from './managers/ServerManager';
import { ServersTreeProvider } from './providers/ServersTreeProvider';
import { DagsTreeProvider } from './providers/DagsTreeProvider';
import { AdminTreeProvider } from './providers/AdminTreeProvider';
import { ServerProfile } from './models';

let serverManager: ServerManager;
let serversTreeProvider: ServersTreeProvider;
let dagsTreeProvider: DagsTreeProvider;
let adminTreeProvider: AdminTreeProvider;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('Airflow extension activated');

  // Initialize managers and providers
  serverManager = new ServerManager(context);
  serversTreeProvider = new ServersTreeProvider(serverManager);
  dagsTreeProvider = new DagsTreeProvider(serverManager);
  adminTreeProvider = new AdminTreeProvider(serverManager);

  // Register tree views
  vscode.window.registerTreeDataProvider('airflowServers', serversTreeProvider);
  vscode.window.registerTreeDataProvider('airflowDags', dagsTreeProvider);
  vscode.window.registerTreeDataProvider('airflowAdmin', adminTreeProvider);

  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.text = '$(cloud) Airflow';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('airflow.addServer', addServer),
    vscode.commands.registerCommand('airflow.editServer', editServer),
    vscode.commands.registerCommand('airflow.deleteServer', deleteServer),
    vscode.commands.registerCommand('airflow.testConnection', testConnection),
    vscode.commands.registerCommand('airflow.refreshDags', refreshDags),
    vscode.commands.registerCommand('airflow.openDag', openDag),
    vscode.commands.registerCommand('airflow.triggerDag', triggerDag),
    vscode.commands.registerCommand('airflow.pauseDag', pauseDag),
    vscode.commands.registerCommand('airflow.unpauseDag', unpauseDag),
    vscode.commands.registerCommand('airflow.deleteDag', deleteDag),
    vscode.commands.registerCommand('airflow.clearTask', clearTask),
    vscode.commands.registerCommand('airflow.viewLogs', viewLogs),
    vscode.commands.registerCommand('airflow.openVariables', openVariables),
    vscode.commands.registerCommand('airflow.openPools', openPools),
    vscode.commands.registerCommand('airflow.openConnections', openConnections),
    vscode.commands.registerCommand('airflow.openHealthCheck', openHealthCheck)
  );

  // Load initial data
  loadActiveServer();
}

async function loadActiveServer() {
  const server = await serverManager.getActiveServer();
  if (server) {
    statusBarItem.text = `$(cloud) ${server.name}`;
    dagsTreeProvider.loadDags();
  }
}

async function addServer() {
  const name = await vscode.window.showInputBox({ prompt: 'Server name' });
  if (!name) return;

  const type = await vscode.window.showQuickPick(['self-hosted', 'mwaa'], { placeHolder: 'Server type' });
  if (!type) return;

  let baseUrl = '';
  let awsRegion = '';

  if (type === 'self-hosted') {
    const url = await vscode.window.showInputBox({ prompt: 'Base URL (e.g., http://localhost:8080)' });
    if (!url) return;
    baseUrl = url;
  } else {
    const env = await vscode.window.showInputBox({ prompt: 'MWAA environment name' });
    if (!env) return;
    baseUrl = env;
    
    const region = await vscode.window.showInputBox({ prompt: 'AWS region', value: 'us-east-1' });
    if (!region) return;
    awsRegion = region;
  }

  const username = await vscode.window.showInputBox({ prompt: 'Username (optional for MWAA)' });
  const password = username ? await vscode.window.showInputBox({ prompt: 'Password', password: true }) : undefined;

  const profile: ServerProfile = {
    id: Date.now().toString(),
    name,
    type: type as 'self-hosted' | 'mwaa',
    baseUrl,
    awsRegion,
    authType: type === 'mwaa' ? 'aws' : 'basic',
    username,
    apiMode: 'auto',
    defaultRefreshInterval: 15,
    lastHealthStatus: 'unknown'
  };

  await serverManager.addServer(profile, password);
  await serverManager.setActiveServer(profile.id);
  serversTreeProvider.refresh();
  loadActiveServer();
  vscode.window.showInformationMessage(`Server ${name} added`);
}

async function editServer(item: any) {
  vscode.window.showInformationMessage('Edit server - Not implemented yet');
}

async function deleteServer(item: any) {
  const serverId = item?.server?.id;
  if (!serverId) return;

  const confirm = await vscode.window.showWarningMessage(
    `Delete server ${item.server.name}?`,
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    await serverManager.deleteServer(serverId);
    serversTreeProvider.refresh();
    dagsTreeProvider.refresh();
    vscode.window.showInformationMessage('Server deleted');
  }
}

async function testConnection(item: any) {
  const serverId = item?.server?.id;
  if (!serverId) return;

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Testing connection...' },
    async () => await serverManager.testConnection(serverId)
  );

  if (result.success) {
    vscode.window.showInformationMessage('✓ Connection successful');
  } else {
    vscode.window.showErrorMessage(`✗ Connection failed: ${result.message}`);
  }
}

async function refreshDags() {
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Refreshing DAGs...' },
    async () => await dagsTreeProvider.loadDags()
  );
}

async function openDag(item: any) {
  const dagId = item?.dag?.dagId;
  if (!dagId) return;
  vscode.window.showInformationMessage(`Open DAG: ${dagId} - Not implemented yet`);
}

async function triggerDag(item: any) {
  const dagId = item?.dag?.dagId;
  if (!dagId) return;

  const confInput = await vscode.window.showInputBox({
    prompt: 'Configuration JSON (optional)',
    placeHolder: '{"key": "value"}',
    validateInput: (value) => {
      if (!value) return null;
      try {
        JSON.parse(value);
        return null;
      } catch {
        return 'Invalid JSON';
      }
    }
  });

  if (confInput === undefined) return;

  try {
    const client = await serverManager.getClient();
    if (!client) {
      vscode.window.showErrorMessage('No active server');
      return;
    }

    const conf = confInput ? JSON.parse(confInput) : undefined;
    await client.triggerDagRun(dagId, conf);
    vscode.window.showInformationMessage(`✓ DAG ${dagId} triggered`);
    refreshDags();
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to trigger DAG: ${error.message}`);
  }
}

async function pauseDag(item: any) {
  const dagId = item?.dag?.dagId;
  if (!dagId) return;

  try {
    const client = await serverManager.getClient();
    if (!client) return;

    await client.pauseDag(dagId, true);
    vscode.window.showInformationMessage(`✓ DAG ${dagId} paused`);
    refreshDags();
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to pause DAG: ${error.message}`);
  }
}

async function unpauseDag(item: any) {
  const dagId = item?.dag?.dagId;
  if (!dagId) return;

  try {
    const client = await serverManager.getClient();
    if (!client) return;

    await client.pauseDag(dagId, false);
    vscode.window.showInformationMessage(`✓ DAG ${dagId} unpaused`);
    refreshDags();
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to unpause DAG: ${error.message}`);
  }
}

async function deleteDag(item: any) {
  const dagId = item?.dag?.dagId;
  if (!dagId) return;

  const confirm = await vscode.window.showWarningMessage(
    `Delete DAG ${dagId}?`,
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    try {
      const client = await serverManager.getClient();
      if (!client) return;

      await client.deleteDag(dagId);
      vscode.window.showInformationMessage(`✓ DAG ${dagId} deleted`);
      refreshDags();
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to delete DAG: ${error.message}`);
    }
  }
}

async function clearTask() {
  vscode.window.showInformationMessage('Clear task - Not implemented yet');
}

async function viewLogs() {
  vscode.window.showInformationMessage('View logs - Not implemented yet');
}

async function openVariables() {
  try {
    const client = await serverManager.getClient();
    if (!client) {
      vscode.window.showErrorMessage('No active server');
      return;
    }

    const variables = await client.listVariables();
    const items = variables.map(v => ({
      label: v.key,
      description: v.value.substring(0, 50),
      detail: v.description
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a variable to view/edit'
    });

    if (selected) {
      vscode.window.showInformationMessage(`Variable: ${selected.label} = ${selected.description}`);
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to load variables: ${error.message}`);
  }
}

async function openPools() {
  try {
    const client = await serverManager.getClient();
    if (!client) {
      vscode.window.showErrorMessage('No active server');
      return;
    }

    const pools = await client.listPools();
    const items = pools.map(p => ({
      label: p.name,
      description: `${p.occupiedSlots}/${p.slots} slots used`,
      detail: p.description
    }));

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Pools'
    });
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to load pools: ${error.message}`);
  }
}

async function openConnections() {
  try {
    const client = await serverManager.getClient();
    if (!client) {
      vscode.window.showErrorMessage('No active server');
      return;
    }

    const connections = await client.listConnections();
    const items = connections.map(c => ({
      label: c.connectionId,
      description: c.connType,
      detail: c.host
    }));

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Connections'
    });
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to load connections: ${error.message}`);
  }
}

async function openHealthCheck() {
  try {
    const client = await serverManager.getClient();
    if (!client) {
      vscode.window.showErrorMessage('No active server');
      return;
    }

    const health = await client.getHealth();
    const message = `
Metadatabase: ${health.metadatabase.status}
Scheduler: ${health.scheduler.status}
${health.triggerer ? `Triggerer: ${health.triggerer.status}` : ''}
${health.dagProcessor ? `DAG Processor: ${health.dagProcessor.status}` : ''}
    `.trim();

    vscode.window.showInformationMessage(message);
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to get health: ${error.message}`);
  }
}

export function deactivate() {}
