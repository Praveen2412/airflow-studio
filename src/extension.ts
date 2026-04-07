import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ServerManager } from './managers/ServerManager';
import { ServersTreeProvider } from './providers/ServersTreeProvider';
import { ServerDetailsPanel, showAddServerPanel } from './webviews/ServerDetailsPanel';
import { DagDetailsPanel } from './webviews/DagDetailsPanel';
import { VariablesPanel, PoolsPanel, ConnectionsPanel, ConfigPanel, PluginsPanel, ProvidersPanel } from './webviews/AdminPanels';
import { CodeSyncManager } from './managers/CodeSyncManager';
import { CodeFileItem } from './providers/CodeTreeProvider';
import { ServerProfile } from './models';
import { Logger } from './utils/logger';
import { Constants, registerConfigurationListener } from './utils/constants';
import { StatusBarManager } from './utils/statusBarManager';

let serverManager: ServerManager;
let serversTreeProvider: ServersTreeProvider;
let statusBarManager: StatusBarManager;
let healthCheckInterval: NodeJS.Timeout | undefined;

export function activate(context: vscode.ExtensionContext) {
  try {
    console.log('[Airflow Studio] Extension activation started');
    
    Logger.initialize(context);
    Logger.info('=== Airflow Studio Extension Activation Started ===');
    Logger.debug('VS Code version:', vscode.version);
    Logger.debug('Extension context available:', !!context);

    // Register configuration listener
    registerConfigurationListener(context);
    Logger.debug('Configuration listener registered');

    Logger.debug('Creating ServerManager...');
    serverManager = new ServerManager(context);
    Logger.debug('ServerManager created successfully');
    
    Logger.debug('Creating ServersTreeProvider...');
    serversTreeProvider = new ServersTreeProvider(serverManager);
    Logger.debug('ServersTreeProvider created successfully');

    Logger.debug('Registering tree data providers...');
    const serversDisposable = vscode.window.registerTreeDataProvider('airflowServers', serversTreeProvider);
    Logger.debug('Servers tree provider registered');
    
    context.subscriptions.push(serversDisposable);
    Logger.info('All tree data providers registered successfully');

    Logger.debug('Creating status bar manager...');
    statusBarManager = new StatusBarManager(context);
    Logger.debug('Status bar manager created');

    Logger.debug('Registering commands...');
    const commands = [
      { id: 'airflow.addServer', handler: addServer },
      { id: 'airflow.addServerPanel', handler: addServerPanel },
      { id: 'airflow.refreshServers', handler: refreshServers },
      { id: 'airflow.refreshDags', handler: refreshDags },
      { id: 'airflow.toggleShowOnlyFavoriteServers', handler: toggleShowOnlyFavoriteServers },
      { id: 'airflow.toggleFavoriteServer', handler: toggleFavoriteServer },
      { id: 'airflow.toggleShowOnlyFavoriteDags', handler: toggleShowOnlyFavoriteDags },
      { id: 'airflow.toggleFavoriteDag', handler: toggleFavoriteDag },
      { id: 'airflow.toggleServerVisibility', handler: toggleServerVisibility },
      { id: 'airflow.toggleDagsVisibility', handler: toggleDagsVisibility },
      { id: 'airflow.editServer', handler: editServer },
      { id: 'airflow.deleteServer', handler: deleteServer },
      { id: 'airflow.testConnection', handler: testConnection },
      { id: 'airflow.openServerDetails', handler: openServerDetails },
      { id: 'airflow.openDag', handler: openDag },
      { id: 'airflow.openDagDetails', handler: openDagDetails },
      { id: 'airflow.triggerDag', handler: triggerDag },
      { id: 'airflow.pauseDag', handler: pauseDag },
      { id: 'airflow.unpauseDag', handler: unpauseDag },
      { id: 'airflow.deleteDag', handler: deleteDag },
      { id: 'airflow.clearTask', handler: clearTask },
      { id: 'airflow.viewLogs', handler: viewLogs },
      { id: 'airflow.openVariables', handler: openVariables },
      { id: 'airflow.openVariablesPanel', handler: openVariablesPanel },
      { id: 'airflow.openPools', handler: openPools },
      { id: 'airflow.openPoolsPanel', handler: openPoolsPanel },
      { id: 'airflow.openConnections', handler: openConnections },
      { id: 'airflow.openConnectionsPanel', handler: openConnectionsPanel },
      { id: 'airflow.openConfigPanel', handler: openConfigPanel },
      { id: 'airflow.openPluginsPanel', handler: openPluginsPanel },
      { id: 'airflow.openProvidersPanel', handler: openProvidersPanel },
      { id: 'airflow.openHealthCheck', handler: openHealthCheck },
      // Code management
      { id: 'airflow.code.configure', handler: codeConfigureServer },
      { id: 'airflow.code.pull', handler: codePull },
      { id: 'airflow.code.push', handler: codePush },
      { id: 'airflow.code.openFile', handler: codeOpenFile },
      { id: 'airflow.code.newFile', handler: codeNewFile },
      { id: 'airflow.code.deleteFile', handler: codeDeleteFile },
      { id: 'airflow.code.uploadFile', handler: codeUploadFile }
    ];
    
    commands.forEach(cmd => {
      Logger.debug(`Registering command: ${cmd.id}`);
      context.subscriptions.push(vscode.commands.registerCommand(cmd.id, cmd.handler));
    });
    Logger.info(`Registered ${commands.length} commands successfully`);

    Logger.debug('Loading active server...');
    loadActiveServer();
    
    Logger.debug('Starting health check interval...');
    startHealthCheckInterval();
    
    Logger.info('=== Airflow Studio Extension Activated Successfully ===');
    Logger.show();
    console.log('[Airflow Studio] Extension activated successfully');
  } catch (error: any) {
    const errorMsg = `Failed to activate Airflow Studio extension: ${error?.message || error}`;
    console.error('[Airflow Studio] ACTIVATION FAILED:', error);
    Logger.error('ACTIVATION FAILED', error);
    Logger.show();
    vscode.window.showErrorMessage(errorMsg);
    throw error;
  }
}

async function loadActiveServer() {
  try {
    Logger.debug('loadActiveServer: Starting...');
    const servers = await serverManager.getServers();
    statusBarManager.updateServerCount(servers);
    if (servers.length > 0) {
      serversTreeProvider.refresh();
      Logger.info('loadActiveServer: Tree refreshed');
    } else {
      Logger.debug('No servers found');
    }
  } catch (error: any) {
    Logger.error('Failed to load servers', error);
    statusBarManager.showError('Failed to load servers');
  }
}

function startHealthCheckInterval() {
  updateAllServerHealth();
  healthCheckInterval = setInterval(() => {
    updateAllServerHealth();
  }, Constants.HEALTH_CHECK_INTERVAL);
  Logger.debug('Health check interval started', { intervalMs: Constants.HEALTH_CHECK_INTERVAL });
}

async function updateAllServerHealth() {
  try {
    Logger.debug('updateAllServerHealth: Starting');
    const servers = await serverManager.getServers();
    
    // Parallel health checks using Promise.allSettled
    const healthCheckPromises = servers.map(async (server) => {
      try {
        const client = await serverManager.getClient(server.id);
        if (!client) {
          return { serverId: server.id, status: 'down' as const };
        }
        
        await client.getHealth();
        Logger.debug('updateAllServerHealth: Server healthy', { serverId: server.id, name: server.name });
        return { serverId: server.id, status: 'healthy' as const };
      } catch (error: any) {
        Logger.debug('updateAllServerHealth: Server down', { serverId: server.id, name: server.name });
        return { serverId: server.id, status: 'down' as const };
      }
    });
    
    const results = await Promise.allSettled(healthCheckPromises);
    
    // Update server statuses based on results
    let updated = false;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const server = servers[i];
      
      if (result.status === 'fulfilled') {
        const { status } = result.value;
        if (server.lastHealthStatus !== status) {
          server.lastHealthStatus = status;
          await serverManager.updateServer(server);
          updated = true;
        }
      } else {
        // Promise rejected - mark as down
        if (server.lastHealthStatus !== 'down') {
          server.lastHealthStatus = 'down';
          await serverManager.updateServer(server);
          updated = true;
        }
      }
    }
    
    if (updated) {
      serversTreeProvider.refresh();
      statusBarManager.updateServerCount(servers);
    }
    
    Logger.debug('updateAllServerHealth: Completed', { count: servers.length, updated });
  } catch (error: any) {
    Logger.error('updateAllServerHealth: Failed', error);
  }
}

async function refreshServers() {
  Logger.info('=== USER ACTION: Refresh Servers ===');
  await updateAllServerHealth();
  await loadActiveServer();
  vscode.window.showInformationMessage('Servers refreshed');
}

async function refreshDags(item: any) {
  Logger.info('=== USER ACTION: Refresh DAGs ===');
  const serverId = item?.server?.id;
  if (serverId) {
    Logger.debug('refreshDags: Clearing cache for server', { serverId });
    // Clear the DAG cache for this server
    serversTreeProvider.clearDagCache(serverId);
  }
  serversTreeProvider.refresh();
  vscode.window.showInformationMessage('DAGs refreshed');
}

async function toggleShowOnlyFavoriteServers() {
  Logger.info('=== USER ACTION: Toggle Show Only Favorite Servers ===');
  serversTreeProvider.toggleShowOnlyFavoriteServers();
}

async function toggleFavoriteServer(item: any) {
  Logger.info('=== USER ACTION: Toggle Favorite Server ===');
  const serverId = item?.server?.id;
  if (!serverId) return;
  
  const servers = await serverManager.getServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) return;
  
  server.isFavorite = !server.isFavorite;
  await serverManager.updateServer(server);
  
  vscode.window.showInformationMessage(
    server.isFavorite ? `⭐ ${server.name} added to favorites` : `${server.name} removed from favorites`
  );
  
  serversTreeProvider.refresh();
  Logger.info('toggleFavoriteServer: Success', { serverId, isFavorite: server.isFavorite });
}

async function toggleShowOnlyFavoriteDags(item: any) {
  Logger.info('=== USER ACTION: Toggle Show Only Favorite DAGs ===');
  const serverId = item?.server?.id;
  if (!serverId) return;
  
  serversTreeProvider.toggleShowOnlyFavoriteDags(serverId);
}

async function toggleFavoriteDag(item: any) {
  Logger.info('=== USER ACTION: Toggle Favorite DAG ===');
  const dagId = item?.dag?.dagId;
  const serverId = item?.serverId;
  if (!dagId || !serverId) return;
  
  const servers = await serverManager.getServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) return;
  
  if (!server.favoriteDags) {
    server.favoriteDags = [];
  }
  
  const index = server.favoriteDags.indexOf(dagId);
  if (index > -1) {
    server.favoriteDags.splice(index, 1);
    vscode.window.showInformationMessage(`${dagId} removed from favorites`);
  } else {
    server.favoriteDags.push(dagId);
    vscode.window.showInformationMessage(`⭐ ${dagId} added to favorites`);
  }
  
  await serverManager.updateServer(server);
  serversTreeProvider.refresh();
  Logger.info('toggleFavoriteDag: Success', { dagId, serverId, isFavorite: index === -1 });
}

async function toggleServerVisibility(item: any) {
  Logger.info('=== USER ACTION: Toggle Server Visibility ===');
  const serverId = item?.server?.id;
  if (!serverId) return;
  
  serversTreeProvider.toggleServerVisibility(serverId);
  Logger.info('toggleServerVisibility: Toggled', { serverId });
}

async function toggleDagsVisibility(item: any) {
  Logger.info('=== USER ACTION: Toggle DAGs Visibility ===');
  const serverId = item?.server?.id;
  if (!serverId) return;
  
  serversTreeProvider.toggleDagsVisibility(serverId);
  Logger.info('toggleDagsVisibility: Toggled', { serverId });
}

async function addServerPanel() {
  Logger.info('addServerPanel: Command invoked');
  showAddServerPanel(serverManager, vscode.Uri.file(__dirname));
}

async function addServer() {
  Logger.info('addServer: Opening add server panel');
  showAddServerPanel(serverManager, vscode.Uri.file(__dirname));
}

async function openServerDetails(item: any) {
  const serverId = item?.server?.id || item?.id;
  if (!serverId) return;
  Logger.info('openServerDetails: Command invoked', { serverId });
  ServerDetailsPanel.show(serverId, serverManager, vscode.Uri.file(__dirname));
}

async function editServer(item: any) {
  const serverId = item?.server?.id;
  if (!serverId) return;
  Logger.info('editServer: Opening edit panel', { serverId });
  ServerDetailsPanel.show(serverId, serverManager, vscode.Uri.file(__dirname));
}

async function openDagDetails(item: any) {
  const dagId = item?.dag?.dagId;
  const serverId = item?.serverId;
  if (!dagId) return;
  Logger.info('openDagDetails: Command invoked', { dagId, serverId });
  DagDetailsPanel.show(dagId, serverManager, vscode.Uri.file(__dirname), serverId);
}

async function openVariablesPanel(item: any) {
  Logger.info('openVariablesPanel: Command invoked');
  const serverId = item?.serverId || await promptForServer();
  if (!serverId) return;
  VariablesPanel.show(serverManager, vscode.Uri.file(__dirname), serverId);
}

async function openPoolsPanel(item: any) {
  Logger.info('openPoolsPanel: Command invoked');
  const serverId = item?.serverId || await promptForServer();
  if (!serverId) return;
  PoolsPanel.show(serverManager, vscode.Uri.file(__dirname), serverId);
}

async function openConnectionsPanel(item: any) {
  Logger.info('openConnectionsPanel: Command invoked');
  const serverId = item?.serverId || await promptForServer();
  if (!serverId) return;
  ConnectionsPanel.show(serverManager, vscode.Uri.file(__dirname), serverId);
}

async function openConfigPanel(item: any) {
  Logger.info('openConfigPanel: Command invoked');
  const serverId = item?.serverId || await promptForServer();
  if (!serverId) return;
  ConfigPanel.show(serverManager, vscode.Uri.file(__dirname), serverId);
}

async function openPluginsPanel(item: any) {
  Logger.info('openPluginsPanel: Command invoked');
  const serverId = item?.serverId || await promptForServer();
  if (!serverId) return;
  PluginsPanel.show(serverManager, vscode.Uri.file(__dirname), serverId);
}

async function openProvidersPanel(item: any) {
  Logger.info('openProvidersPanel: Command invoked');
  const serverId = item?.serverId || await promptForServer();
  if (!serverId) return;
  ProvidersPanel.show(serverManager, vscode.Uri.file(__dirname), serverId);
}

async function promptForServer(): Promise<string | undefined> {
  const servers = await serverManager.getServers();
  
  if (servers.length === 0) {
    vscode.window.showErrorMessage('No servers configured. Please add a server first.');
    return undefined;
  }
  
  if (servers.length === 1) {
    return servers[0].id;
  }
  
  const items = servers.map(s => ({
    label: s.name,
    description: `${s.type === 'mwaa' ? 'MWAA' : 'Self-hosted'} - ${s.lastHealthStatus === 'healthy' ? '✓ Healthy' : s.lastHealthStatus === 'down' ? '✗ Down' : '○ Unknown'}`,
    detail: s.baseUrl || s.awsRegion,
    serverId: s.id
  }));
  
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a server',
    title: 'Choose Airflow Server'
  });
  
  return selected?.serverId;
}

async function deleteServer(item: any) {
  const serverId = item?.server?.id;
  if (!serverId) return;

  const servers = await serverManager.getServers();
  const server = servers.find(s => s.id === serverId);
  if (!server) return;

  const confirm = await vscode.window.showWarningMessage(
    `Delete server ${server.name}?`,
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    await serverManager.deleteServer(serverId);
    serversTreeProvider.refresh();
    vscode.window.showInformationMessage('Server deleted');
  }
}

async function testConnection(item: any) {
  Logger.info('=== USER ACTION: Test Connection ===');
  const serverId = item?.server?.id;
  Logger.debug('testConnection: Input', { serverId });
  
  if (!serverId) return;

  const result = await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: 'Testing connection...' },
    async () => await serverManager.testConnection(serverId)
  );

  Logger.info('testConnection: Result', { success: result.success, message: result.message });
  
  if (result.success) {
    vscode.window.showInformationMessage('✓ Connection successful');
  } else {
    vscode.window.showErrorMessage(`✗ Connection failed: ${result.message}`);
  }
}

async function openDag(item: any) {
  const dagId = item?.dag?.dagId;
  if (!dagId) return;
  vscode.window.showInformationMessage(`Open DAG: ${dagId} - Not implemented yet`);
}

async function triggerDag(item: any) {
  Logger.info('=== USER ACTION: Trigger DAG ===');
  const dagId = item?.dag?.dagId;
  const serverId = item?.serverId;
  Logger.debug('triggerDag: Input', { dagId, serverId, itemType: typeof item });
  
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

  if (confInput === undefined) {
    Logger.debug('triggerDag: User cancelled config input');
    return;
  }

  try {
    Logger.debug('triggerDag: Getting client...');
    const client = await serverManager.getClient(serverId);
    if (!client) {
      Logger.error('triggerDag: No active server');
      vscode.window.showErrorMessage('No active server');
      return;
    }

    const conf = confInput ? JSON.parse(confInput) : undefined;
    Logger.info('triggerDag: Calling API', { dagId, hasConfig: !!conf });
    await client.triggerDagRun(dagId, conf);
    vscode.window.showInformationMessage(`✓ DAG ${dagId} triggered`);
    Logger.info('triggerDag: Success', { dagId });
    serversTreeProvider.refresh();
  } catch (error: any) {
    Logger.error('triggerDag: Failed', error, { dagId });
    vscode.window.showErrorMessage(`Failed to trigger DAG: ${error.message}`);
  }
}

async function pauseDag(item: any) {
  Logger.info('=== USER ACTION: Pause DAG ===');
  const dagId = item?.dag?.dagId;
  const serverId = item?.serverId;
  Logger.debug('pauseDag: Input', { dagId, serverId });
  
  if (!dagId) return;

  try {
    const client = await serverManager.getClient(serverId);
    if (!client) return;

    Logger.info('pauseDag: Calling API', { dagId });
    await client.pauseDag(dagId, true);
    vscode.window.showInformationMessage(`✓ DAG ${dagId} paused`);
    Logger.info('pauseDag: Success', { dagId });
    serversTreeProvider.refresh();
  } catch (error: any) {
    Logger.error('pauseDag: Failed', error, { dagId });
    vscode.window.showErrorMessage(`Failed to pause DAG: ${error.message}`);
  }
}

async function unpauseDag(item: any) {
  Logger.info('=== USER ACTION: Unpause DAG ===');
  const dagId = item?.dag?.dagId;
  const serverId = item?.serverId;
  Logger.debug('unpauseDag: Input', { dagId, serverId });
  
  if (!dagId) return;

  try {
    const client = await serverManager.getClient(serverId);
    if (!client) return;

    Logger.info('unpauseDag: Calling API', { dagId });
    await client.pauseDag(dagId, false);
    vscode.window.showInformationMessage(`✓ DAG ${dagId} unpaused`);
    Logger.info('unpauseDag: Success', { dagId });
    serversTreeProvider.refresh();
  } catch (error: any) {
    Logger.error('unpauseDag: Failed', error, { dagId });
    vscode.window.showErrorMessage(`Failed to unpause DAG: ${error.message}`);
  }
}

async function deleteDag(item: any) {
  Logger.info('=== USER ACTION: Delete DAG ===');
  const dagId = item?.dag?.dagId;
  const serverId = item?.serverId;
  Logger.debug('deleteDag: Input', { dagId, serverId });
  
  if (!dagId) return;

  const confirm = await vscode.window.showWarningMessage(
    `Delete DAG ${dagId}?`,
    { modal: true },
    'Delete'
  );

  if (confirm === 'Delete') {
    try {
      const client = await serverManager.getClient(serverId);
      if (!client) return;

      Logger.info('deleteDag: Calling API', { dagId });
      await client.deleteDag(dagId);
      vscode.window.showInformationMessage(`✓ DAG ${dagId} deleted`);
      Logger.info('deleteDag: Success', { dagId });
      serversTreeProvider.refresh();
    } catch (error: any) {
      Logger.error('deleteDag: Failed', error, { dagId });
      vscode.window.showErrorMessage(`Failed to delete DAG: ${error.message}`);
    }
  } else {
    Logger.debug('deleteDag: User cancelled');
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
    const serverId = await promptForServer();
    if (!serverId) return;
    
    const client = await serverManager.getClient(serverId);
    if (!client) {
      vscode.window.showErrorMessage('Failed to connect to server');
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
    const serverId = await promptForServer();
    if (!serverId) return;
    
    const client = await serverManager.getClient(serverId);
    if (!client) {
      vscode.window.showErrorMessage('Failed to connect to server');
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
    const serverId = await promptForServer();
    if (!serverId) return;
    
    const client = await serverManager.getClient(serverId);
    if (!client) {
      vscode.window.showErrorMessage('Failed to connect to server');
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

async function openHealthCheck(item: any) {
  try {
    const serverId = item?.serverId || await promptForServer();
    if (!serverId) return;
    
    const client = await serverManager.getClient(serverId);
    if (!client) {
      vscode.window.showErrorMessage('Failed to connect to server');
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

// ─── Code management handlers ─────────────────────────────────────────────────

async function codeConfigureServer(item: any) {
  Logger.info('=== USER ACTION: Configure Code Settings ===');
  const serverId = item?.server?.id;
  if (!serverId) return;
  ServerDetailsPanel.show(serverId, serverManager, vscode.Uri.file(__dirname));
}

async function codePull(item: any) {
  Logger.info('=== USER ACTION: Code Pull ===');
  const server = await resolveServerFromItem(item);
  if (!server?.codeConfig) { vscode.window.showErrorMessage('Code management not configured for this server.'); return; }

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Pulling files from ${server.type === 'mwaa' ? 'S3' : 'source'}...` },
    async () => {
      const result = await CodeSyncManager.getInstance().pull(server);
      vscode.window.showInformationMessage(`✓ ${result.message}`);
      serversTreeProvider.refresh();
    }
  );
}

async function codePush(item: any) {
  Logger.info('=== USER ACTION: Code Push ===');
  const server = await resolveServerFromItem(item);
  if (!server?.codeConfig) { vscode.window.showErrorMessage('Code management not configured for this server.'); return; }

  const confirm = await vscode.window.showWarningMessage(
    `Push local changes to ${server.type === 'mwaa' ? 'S3' : 'source'}? This will overwrite remote files.`,
    { modal: true }, 'Push'
  );
  if (confirm !== 'Push') return;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title: `Pushing files to ${server.type === 'mwaa' ? 'S3' : 'source'}...` },
    async () => {
      const result = await CodeSyncManager.getInstance().push(server);
      vscode.window.showInformationMessage(`✓ ${result.message}`);
    }
  );
}

async function codeOpenFile(item: CodeFileItem) {
  Logger.info('=== USER ACTION: Code Open File ===', { filePath: item?.filePath });
  if (!item?.filePath) return;
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(item.filePath));
  await vscode.window.showTextDocument(doc, { preview: false });
}

async function codeNewFile(item: any) {
  Logger.info('=== USER ACTION: Code New File ===');
  const server = await resolveServerFromItem(item);
  if (!server?.codeConfig) { vscode.window.showErrorMessage('Code management not configured for this server.'); return; }

  const fileName = await vscode.window.showInputBox({
    prompt: 'New file name',
    placeHolder: 'my_dag.py',
    validateInput: v => v?.trim() ? null : 'File name is required'
  });
  if (!fileName) return;

  const syncManager = CodeSyncManager.getInstance();
  const localBase = syncManager.getLocalWorkspacePath(server);
  // If item is a directory node, create inside it; otherwise use workspace root
  const dirPath = (item instanceof CodeFileItem && item.isDirectory) ? item.filePath : localBase;
  const filePath = path.join(dirPath, fileName.trim());

  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, '', { flag: 'wx' }).catch(async () => {
    // file exists — just open it
  });

  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
  await vscode.window.showTextDocument(doc, { preview: false });
  serversTreeProvider.refresh();
}

async function codeDeleteFile(item: CodeFileItem) {
  Logger.info('=== USER ACTION: Code Delete File ===', { filePath: item?.filePath });
  if (!item?.filePath) return;

  const confirm = await vscode.window.showWarningMessage(
    `Delete "${item.fileName}" from source and local workspace?`,
    { modal: true }, 'Delete'
  );
  if (confirm !== 'Delete') return;

  try {
    await CodeSyncManager.getInstance().deleteFile(item.server, item.filePath);
    vscode.window.showInformationMessage(`✓ Deleted ${item.fileName}`);
    serversTreeProvider.refresh();
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to delete: ${error.message}`);
  }
}

async function codeUploadFile(item: CodeFileItem) {
  Logger.info('=== USER ACTION: Code Upload File ===', { filePath: item?.filePath });
  if (!item?.filePath) return;

  try {
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, title: `Uploading ${item.fileName}...` },
      async () => {
        await CodeSyncManager.getInstance().uploadFile(item.server, item.filePath);
        vscode.window.showInformationMessage(`✓ Uploaded ${item.fileName}`);
      }
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to upload: ${error.message}`);
  }
}

async function resolveServerFromItem(item: any): Promise<ServerProfile | undefined> {
  const serverId = item?.server?.id;
  if (!serverId) return undefined;
  const servers = await serverManager.getServers();
  return servers.find(s => s.id === serverId);
}

export function deactivate() {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  Logger.info('Extension deactivated');
}
