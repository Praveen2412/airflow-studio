"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const ServerManager_1 = require("./managers/ServerManager");
const ServersTreeProvider_1 = require("./providers/ServersTreeProvider");
const DagsTreeProvider_1 = require("./providers/DagsTreeProvider");
const AdminTreeProvider_1 = require("./providers/AdminTreeProvider");
const logger_1 = require("./utils/logger");
let serverManager;
let serversTreeProvider;
let dagsTreeProvider;
let adminTreeProvider;
let statusBarItem;
function activate(context) {
    try {
        console.log('[Airflow] Extension activation started');
        // Initialize logger first
        logger_1.Logger.initialize(context);
        logger_1.Logger.info('=== Airflow Extension Activation Started ===');
        logger_1.Logger.debug('VS Code version:', vscode.version);
        logger_1.Logger.debug('Extension context available:', !!context);
        // Initialize managers and providers
        logger_1.Logger.debug('Creating ServerManager...');
        serverManager = new ServerManager_1.ServerManager(context);
        logger_1.Logger.debug('ServerManager created successfully');
        logger_1.Logger.debug('Creating ServersTreeProvider...');
        serversTreeProvider = new ServersTreeProvider_1.ServersTreeProvider(serverManager);
        logger_1.Logger.debug('ServersTreeProvider created successfully');
        logger_1.Logger.debug('Creating DagsTreeProvider...');
        dagsTreeProvider = new DagsTreeProvider_1.DagsTreeProvider(serverManager);
        logger_1.Logger.debug('DagsTreeProvider created successfully');
        logger_1.Logger.debug('Creating AdminTreeProvider...');
        adminTreeProvider = new AdminTreeProvider_1.AdminTreeProvider(serverManager);
        logger_1.Logger.debug('AdminTreeProvider created successfully');
        // Register tree views
        logger_1.Logger.debug('Registering tree data providers...');
        const serversDisposable = vscode.window.registerTreeDataProvider('airflowServers', serversTreeProvider);
        logger_1.Logger.debug('Servers tree provider registered');
        const dagsDisposable = vscode.window.registerTreeDataProvider('airflowDags', dagsTreeProvider);
        logger_1.Logger.debug('DAGs tree provider registered');
        const adminDisposable = vscode.window.registerTreeDataProvider('airflowAdmin', adminTreeProvider);
        logger_1.Logger.debug('Admin tree provider registered');
        context.subscriptions.push(serversDisposable, dagsDisposable, adminDisposable);
        logger_1.Logger.info('All tree data providers registered successfully');
        // Status bar
        logger_1.Logger.debug('Creating status bar item...');
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = '$(cloud) Airflow';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        logger_1.Logger.debug('Status bar item created and shown');
        // Register commands
        logger_1.Logger.debug('Registering commands...');
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
            logger_1.Logger.debug(`Registering command: ${cmd.id}`);
            context.subscriptions.push(vscode.commands.registerCommand(cmd.id, cmd.handler));
        });
        logger_1.Logger.info(`Registered ${commands.length} commands successfully`);
        // Load initial data
        logger_1.Logger.debug('Loading active server...');
        loadActiveServer();
        logger_1.Logger.info('=== Airflow Extension Activated Successfully ===');
        logger_1.Logger.show();
        console.log('[Airflow] Extension activated successfully');
    }
    catch (error) {
        const errorMsg = `Failed to activate Airflow extension: ${error?.message || error}`;
        console.error('[Airflow] ACTIVATION FAILED:', error);
        logger_1.Logger.error('ACTIVATION FAILED', error);
        logger_1.Logger.show();
        vscode.window.showErrorMessage(errorMsg);
        throw error;
    }
}
async function loadActiveServer() {
    try {
        logger_1.Logger.debug('loadActiveServer: Starting...');
        const server = await serverManager.getActiveServer();
        if (server) {
            logger_1.Logger.info('Active server loaded:', { name: server.name, type: server.type });
            statusBarItem.text = `$(cloud) ${server.name}`;
            dagsTreeProvider.loadDags();
        }
        else {
            logger_1.Logger.debug('No active server found');
        }
    }
    catch (error) {
        logger_1.Logger.error('Failed to load active server', error);
    }
}
async function addServer() {
    logger_1.Logger.info('addServer: Command invoked');
    try {
        const name = await vscode.window.showInputBox({ prompt: 'Server name' });
        if (!name) {
            logger_1.Logger.debug('addServer: Cancelled - no name');
            return;
        }
        const type = await vscode.window.showQuickPick(['self-hosted', 'mwaa'], { placeHolder: 'Server type' });
        if (!type) {
            logger_1.Logger.debug('addServer: Cancelled - no type');
            return;
        }
        let baseUrl = '';
        let awsRegion = '';
        if (type === 'self-hosted') {
            const url = await vscode.window.showInputBox({ prompt: 'Base URL (e.g., http://localhost:8080)' });
            if (!url) {
                logger_1.Logger.debug('addServer: Cancelled - no URL');
                return;
            }
            baseUrl = url;
        }
        else {
            const env = await vscode.window.showInputBox({ prompt: 'MWAA environment name' });
            if (!env) {
                logger_1.Logger.debug('addServer: Cancelled - no env');
                return;
            }
            baseUrl = env;
            const region = await vscode.window.showInputBox({ prompt: 'AWS region', value: 'us-east-1' });
            if (!region) {
                logger_1.Logger.debug('addServer: Cancelled - no region');
                return;
            }
            awsRegion = region;
        }
        const username = await vscode.window.showInputBox({ prompt: 'Username (optional for MWAA)' });
        const password = username ? await vscode.window.showInputBox({ prompt: 'Password', password: true }) : undefined;
        const profile = {
            id: Date.now().toString(),
            name,
            type: type,
            baseUrl,
            awsRegion,
            authType: type === 'mwaa' ? 'aws' : 'basic',
            username,
            apiMode: 'auto',
            defaultRefreshInterval: 15,
            lastHealthStatus: 'unknown'
        };
        logger_1.Logger.debug('addServer: Profile created', { id: profile.id, name: profile.name });
        await serverManager.addServer(profile, password);
        await serverManager.setActiveServer(profile.id);
        serversTreeProvider.refresh();
        loadActiveServer();
        vscode.window.showInformationMessage(`Server ${name} added`);
        logger_1.Logger.info('addServer: Completed successfully');
    }
    catch (error) {
        logger_1.Logger.error('addServer: Failed', error);
        vscode.window.showErrorMessage(`Failed to add server: ${error.message}`);
    }
}
async function editServer(item) {
    vscode.window.showInformationMessage('Edit server - Not implemented yet');
}
async function deleteServer(item) {
    const serverId = item?.server?.id;
    if (!serverId)
        return;
    const confirm = await vscode.window.showWarningMessage(`Delete server ${item.server.name}?`, { modal: true }, 'Delete');
    if (confirm === 'Delete') {
        await serverManager.deleteServer(serverId);
        serversTreeProvider.refresh();
        dagsTreeProvider.refresh();
        vscode.window.showInformationMessage('Server deleted');
    }
}
async function testConnection(item) {
    const serverId = item?.server?.id;
    if (!serverId)
        return;
    const result = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Testing connection...' }, async () => await serverManager.testConnection(serverId));
    if (result.success) {
        vscode.window.showInformationMessage('✓ Connection successful');
    }
    else {
        vscode.window.showErrorMessage(`✗ Connection failed: ${result.message}`);
    }
}
async function refreshDags() {
    await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Refreshing DAGs...' }, async () => await dagsTreeProvider.loadDags());
}
async function openDag(item) {
    const dagId = item?.dag?.dagId;
    if (!dagId)
        return;
    vscode.window.showInformationMessage(`Open DAG: ${dagId} - Not implemented yet`);
}
async function triggerDag(item) {
    logger_1.Logger.info('triggerDag: Command invoked');
    const dagId = item?.dag?.dagId;
    if (!dagId) {
        logger_1.Logger.warn('triggerDag: No dagId provided');
        return;
    }
    const confInput = await vscode.window.showInputBox({
        prompt: 'Configuration JSON (optional)',
        placeHolder: '{"key": "value"}',
        validateInput: (value) => {
            if (!value)
                return null;
            try {
                JSON.parse(value);
                return null;
            }
            catch {
                return 'Invalid JSON';
            }
        }
    });
    if (confInput === undefined)
        return;
    try {
        const client = await serverManager.getClient();
        if (!client) {
            logger_1.Logger.error('triggerDag: No active server');
            vscode.window.showErrorMessage('No active server');
            return;
        }
        const conf = confInput ? JSON.parse(confInput) : undefined;
        await client.triggerDagRun(dagId, conf);
        vscode.window.showInformationMessage(`✓ DAG ${dagId} triggered`);
        logger_1.Logger.info('triggerDag: Success', { dagId });
        refreshDags();
    }
    catch (error) {
        logger_1.Logger.error('triggerDag: Failed', error, { dagId });
        vscode.window.showErrorMessage(`Failed to trigger DAG: ${error.message}`);
    }
}
async function pauseDag(item) {
    const dagId = item?.dag?.dagId;
    if (!dagId)
        return;
    try {
        const client = await serverManager.getClient();
        if (!client)
            return;
        await client.pauseDag(dagId, true);
        vscode.window.showInformationMessage(`✓ DAG ${dagId} paused`);
        refreshDags();
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to pause DAG: ${error.message}`);
    }
}
async function unpauseDag(item) {
    const dagId = item?.dag?.dagId;
    if (!dagId)
        return;
    try {
        const client = await serverManager.getClient();
        if (!client)
            return;
        await client.pauseDag(dagId, false);
        vscode.window.showInformationMessage(`✓ DAG ${dagId} unpaused`);
        refreshDags();
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to unpause DAG: ${error.message}`);
    }
}
async function deleteDag(item) {
    const dagId = item?.dag?.dagId;
    if (!dagId)
        return;
    const confirm = await vscode.window.showWarningMessage(`Delete DAG ${dagId}?`, { modal: true }, 'Delete');
    if (confirm === 'Delete') {
        try {
            const client = await serverManager.getClient();
            if (!client)
                return;
            await client.deleteDag(dagId);
            vscode.window.showInformationMessage(`✓ DAG ${dagId} deleted`);
            refreshDags();
        }
        catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        vscode.window.showErrorMessage(`Failed to get health: ${error.message}`);
    }
}
function deactivate() {
    logger_1.Logger.info('Extension deactivated');
}
//# sourceMappingURL=extension.full.js.map