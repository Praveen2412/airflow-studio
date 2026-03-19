import * as vscode from 'vscode';
import { StateManager } from './infrastructure/storage/StateManager';
import { Logger, LogLevel } from './infrastructure/logging/Logger';
import { ConnectionService } from './core/services/ConnectionService';
import { DagTreeView } from './presentation/views/DagTreeView';
import { AdminTreeView } from './presentation/views/AdminTreeView';
import { Commands } from './shared/constants/Commands';

export function activate(context: vscode.ExtensionContext) {
  // Initialize logger
  const logger = Logger.getInstance();
  logger.info('Airflow Extension activation started');

  // Set log level from configuration
  const config = vscode.workspace.getConfiguration('airflow');
  const logLevel = config.get<string>('logLevel', 'info');
  switch (logLevel) {
    case 'debug':
      logger.setLogLevel(LogLevel.DEBUG);
      break;
    case 'warn':
      logger.setLogLevel(LogLevel.WARN);
      break;
    case 'error':
      logger.setLogLevel(LogLevel.ERROR);
      break;
    default:
      logger.setLogLevel(LogLevel.INFO);
  }

  // Initialize infrastructure
  const stateManager = new StateManager(context);

  // Initialize services
  const connectionService = new ConnectionService(stateManager);

  // Initialize views
  const dagTreeView = new DagTreeView(connectionService, stateManager, context);
  const adminTreeView = new AdminTreeView();

  // Register tree data providers
  vscode.window.registerTreeDataProvider('adminTreeView', adminTreeView);
  logger.info('Admin Tree View registered');

  // Register commands
  const commands: vscode.Disposable[] = [];

  // Server management commands
  commands.push(
    vscode.commands.registerCommand(Commands.DAG.REFRESH, () => {
      dagTreeView.refresh();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.ADD_SERVER, () => {
      dagTreeView.addServer();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.REMOVE_SERVER, () => {
      dagTreeView.removeServer();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.CONNECT, () => {
      dagTreeView.connectServer();
    })
  );

  // Filter commands
  commands.push(
    vscode.commands.registerCommand(Commands.DAG.FILTER, () => {
      dagTreeView.filter();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.SHOW_ACTIVE, () => {
      dagTreeView.toggleShowOnlyActive();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.SHOW_FAVORITE, () => {
      dagTreeView.toggleShowOnlyFavorite();
    })
  );

  // DAG operation commands
  commands.push(
    vscode.commands.registerCommand(Commands.DAG.VIEW_DETAILS, (item) => {
      dagTreeView.viewDagDetails();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.TRIGGER, (item) => {
      dagTreeView.triggerDag(item);
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.TRIGGER_WITH_CONFIG, (item) => {
      dagTreeView.triggerDagWithConfig(item);
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.PAUSE, (item) => {
      dagTreeView.pauseDag(item);
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.UNPAUSE, (item) => {
      dagTreeView.unpauseDag(item);
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.CANCEL, (item) => {
      dagTreeView.cancelDagRun(item);
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.VIEW_LOGS, (item) => {
      dagTreeView.viewLogs(item);
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.VIEW_SOURCE, (item) => {
      dagTreeView.viewSourceCode(item);
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.VIEW_INFO, (item) => {
      dagTreeView.viewDagInfo(item);
    })
  );

  // Favorite commands
  commands.push(
    vscode.commands.registerCommand(Commands.DAG.ADD_FAVORITE, (item) => {
      dagTreeView.addToFavorites(item);
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.DAG.REMOVE_FAVORITE, (item) => {
      dagTreeView.removeFromFavorites(item);
    })
  );

  // Admin commands
  commands.push(
    vscode.commands.registerCommand(Commands.ADMIN.VIEW_CONNECTIONS, () => {
      adminTreeView.viewConnections();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.ADMIN.VIEW_VARIABLES, () => {
      adminTreeView.viewVariables();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.ADMIN.VIEW_PROVIDERS, () => {
      adminTreeView.viewProviders();
    })
  );

  commands.push(
    vscode.commands.registerCommand(Commands.ADMIN.VIEW_HEALTH, () => {
      adminTreeView.viewServerHealth();
    })
  );

  // Register all commands with context
  commands.forEach((cmd) => context.subscriptions.push(cmd));

  logger.info('Airflow Extension activation completed');
}

export function deactivate() {
  const logger = Logger.getInstance();
  logger.info('Airflow Extension is now deactivated!');
  logger.dispose();
}
