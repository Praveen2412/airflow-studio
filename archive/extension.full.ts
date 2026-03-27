import * as vscode from 'vscode';
import { ServerManager } from './managers/ServerManager';
import { ServersTreeProvider } from './providers/ServersTreeProvider';
import { DagsTreeProvider } from './providers/DagsTreeProvider';
import { AdminTreeProvider } from './providers/AdminTreeProvider';
import { ServerProfile } from './models';
import { Logger } from './utils/logger';

let serverManager: ServerManager;
let serversTreeProvider: ServersTreeProvider;
let dagsTreeProvider: DagsTreeProvider;
let adminTreeProvider: AdminTreeProvider;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  try {
    console.log('[Airflow] Extension activation started');
    
    // Initialize logger first
    Logger.initialize(context);
    Logger.info('=== Airflow Extension Activation Started ===');
    Logger.debug('VS Code version:', vscode.version);
    Logger.debug('Extension context available:', !!context);

    // Initialize managers and providers
    Logger.debug('Creating ServerManager...');
    serverManager = new ServerManager(context);
    Logger.debug('ServerManager created successfully');
    
    Logger.debug('Creating ServersTreeProvider...');
    serversTreeProvider = new ServersTreeProvider(serverManager);
    Logger.debug('ServersTreeProvider created successfully');
    
    Logger.debug('Creating DagsTreeProvider...');
    dagsTreeProvider = new DagsTreeProvider(serverManager);
    Logger.debug('DagsTreeProvider created successfully');
    
    Logger.debug('Creating AdminTreeProvider...');
    adminTreeProvider = new AdminTreeProvider(serverManager);
    Logger.debug('AdminTreeProvider created successfully');

    // Register tree views
    Logger.debug('Registering tree data providers...');
    const serversDisposable = vscode.window.registerTreeDataProvider('airflowServers', serversTreeProvider);
    Logger.debug('Servers tree provider registered');
    
    const dagsDisposable = vscode.window.registerTreeDataProvider('airflowDags', dagsTreeProvider);
    Logger.debug('DAGs tree provider registered');
    
    const adminDisposable = vscode.window.registerTreeDataProvider('airflowAdmin', adminTreeProvider);
    Logger.debug('Admin tree provider registered');
    
    context.subscriptions.push(serversDisposable, dagsDisposable, adminDisposable);
    Logger.info('All tree data providers registered successfully');

    // Status bar
    Logger.debug('Creating status bar item...');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = '$(cloud) Airflow';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    Logger.debug('Status bar item created and shown');

    // Register commands
    Logger.debug('Registering commands...');
    const commands = [
      { id: 'airflow.addServer', handler: addServer },
      { id: 'airflow.editServer', handler: editServer },
      { id: 'airflow.deleteServer', handler: deleteServer },
      { id: 'airflow.testConnection', handler: testConnection },
      { id: 'airflow.refreshDags', handler: refreshDags },
      { id: 'airflow.openDag', handler: openDag },
      { id: 'airflow.triggerDag', handler: triggerDag },
      { id: 'airflow.pauseDag', handler: pauseDag },
      { id: 'airflow.unpauseDag', handler: unpauseDag },
      { id: 'airflow.deleteDag', handler: deleteDag },
      { id: 'airflow.clearTask', handler: clearTask },
      { id: 'airflow.viewLogs', handler: viewLogs },
      { id: 'airflow.openVariables', handler: openVariables },
      { id: 'airflow.openPools', handler: openPools },
      { id: 'airflow.openConnections', handler: openConnections },
      { id: 'airflow.openHealthCheck', handler: openHealthCheck }
    ];
    
    commands.forEach(cmd => {
      Logger.debug(`Registering command: ${cmd.id}`);
      context.subscriptions.push(vscode.commands.registerCommand(cmd.id, cmd.handler));
    });
    Logger.info(`Registered ${commands.length} commands successfully`);

    // Load initial data
    Logger.debug('Loading active server...');
    loadActiveServer();
    
    Logger.info('=== Airflow Extension Activated Successfully ===');
    Logger.show();
    console.log('[Airflow] Extension activated successfully');
  } catch (error: any) {
    const errorMsg = `Failed to activate Airflow extension: ${error?.message || error}`;
    console.error('[Airflow] ACTIVATION FAILED:', error);
    Logger.error('ACTIVATION FAILED', error);
    Logger.show();
    vscode.window.showErrorMessage(errorMsg);
    throw error;
  }
}

async function loadActiveServer() {
  try {
    Logger.debug('loadActiveServer: Starting...');
    const server = await serverManager.getActiveServer();
    if (server) {
      Logger.info('Active server loaded:', { name: server.name, type: server.type });
      statusBarItem.text = `$(cloud) ${server.name}`;
      dagsTreeProvider.loadDags();
    } else {
      Logger.debug('No active server found');
    }
  } catch (error: any) {
    Logger.error('Failed to load active server', error);
  }
}

async function addServer() {
  Logger.info('addServer: Command invoked');
  try {
    const name = await vscode.window.showInputBox({ prompt: 'Server name' });
    if (!name) {
      Logger.debug('addServer: Cancelled - no name');
      return;
    }

    const type = await vscode.window.showQuickPick(['self-hosted', 'mwaa'], { placeHolder: 'Server type' });
    if (!type) {
      Logger.debug('addServer: Cancelled - no type');
      return;
    }

    let baseUrl = '';
    let awsRegion = '';

    if (type === 'self-hosted') {
      const url = await vscode.window.showInputBox({ prompt: 'Base URL (e.g., http://localhost:8080)' });
      if (!url) {
        Logger.debug('addServer: Cancelled - no URL');
        return;
      }
      baseUrl = url;
    } else {
      const env = await vscode.window.showInputBox({ prompt: 'MWAA environment name' });
      if (!env) {
        Logger.debug('addServer: Cancelled - no env');
        return;
      }
      baseUrl = env;
      
      const region = await vscode.window.showInputBox({ prompt: 'AWS region', value: 'us-east-1' });
      if (!region) {
        Logger.debug('addServer: Cancelled - no region');
        return;
      }
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
    Logger.debug('addServer: Profile created', { id: profile.id, name: profile.name });

    await serverManager.addServer(profile, password);
    await serverManager.setActiveServer(profile.id);
    serversTreeProvider.refresh();
    loadActiveServer();
    vscode.window.showInformationMessage(`Server ${name} added`);
    Logger.info('addServer: Completed successfully');
  } catch (error: any) {
    Logger.error('addServer: Failed', error);
    vscode.window.showErrorMessage(`Failed to add server: ${error.message}`);
  }
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
  Logger.info('triggerDag: Command invoked');
  const dagId = item?.dag?.dagId;
  if (!dagId) {
    Logger.warn('triggerDag: No dagId provided');
    return;
  }

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
      Logger.error('triggerDag: No active server');
      vscode.window.showErrorMessage('No active server');
      return;
    }

    const conf = confInput ? JSON.parse(confInput) : undefined;
    await client.triggerDagRun(dagId, conf);
    vscode.window.showInformationMessage(`✓ DAG ${dagId} triggered`);
    Logger.info('triggerDag: Success', { dagId });
    refreshDags();
  } catch (error: any) {
    Logger.error('triggerDag: Failed', error, { dagId });
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

export function deactivate() {
  Logger.info('Extension deactivated');
}
