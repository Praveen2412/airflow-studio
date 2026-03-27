import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  const outputChannel = vscode.window.createOutputChannel('Airflow Extension');
  outputChannel.show();
  
  try {
    outputChannel.appendLine('[1/7] Starting activation...');
    console.log('[Airflow] Starting activation...');
    
    outputChannel.appendLine('[2/7] Importing Logger...');
    const { Logger } = require('./utils/logger');
    outputChannel.appendLine('[2/7] ✓ Logger imported');
    
    outputChannel.appendLine('[3/7] Initializing Logger...');
    Logger.initialize(context);
    Logger.info('Logger initialized');
    outputChannel.appendLine('[3/7] ✓ Logger initialized');
    
    outputChannel.appendLine('[4/7] Importing ServerManager...');
    const { ServerManager } = require('./managers/ServerManager');
    outputChannel.appendLine('[4/7] ✓ ServerManager imported');
    
    outputChannel.appendLine('[5/7] Importing Providers...');
    const { ServersTreeProvider } = require('./providers/ServersTreeProvider');
    const { DagsTreeProvider } = require('./providers/DagsTreeProvider');
    const { AdminTreeProvider } = require('./providers/AdminTreeProvider');
    outputChannel.appendLine('[5/7] ✓ Providers imported');
    
    outputChannel.appendLine('[6/7] Creating instances...');
    const serverManager = new ServerManager(context);
    const serversTreeProvider = new ServersTreeProvider(serverManager);
    const dagsTreeProvider = new DagsTreeProvider(serverManager);
    const adminTreeProvider = new AdminTreeProvider(serverManager);
    outputChannel.appendLine('[6/7] ✓ Instances created');
    
    outputChannel.appendLine('[7/7] Registering providers...');
    context.subscriptions.push(
      vscode.window.registerTreeDataProvider('airflowServers', serversTreeProvider),
      vscode.window.registerTreeDataProvider('airflowDags', dagsTreeProvider),
      vscode.window.registerTreeDataProvider('airflowAdmin', adminTreeProvider)
    );
    outputChannel.appendLine('[7/7] ✓ Providers registered');
    
    outputChannel.appendLine('=== ACTIVATION SUCCESSFUL ===');
    Logger.info('=== ACTIVATION SUCCESSFUL ===');
    vscode.window.showInformationMessage('Airflow Extension Activated!');
    
  } catch (error: any) {
    const errorMsg = `ACTIVATION FAILED: ${error.message}\n${error.stack}`;
    outputChannel.appendLine(errorMsg);
    console.error('[Airflow] ACTIVATION FAILED:', error);
    vscode.window.showErrorMessage(`Airflow activation failed: ${error.message}`);
    throw error;
  }
}

export function deactivate() {
  console.log('[Airflow] Deactivated');
}
