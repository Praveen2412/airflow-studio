import * as vscode from 'vscode';
import * as tmp from 'tmp';
import * as fs from 'fs';
import { DagTreeItem } from '../items/DagTreeItem';
import { DagTreeDataProvider } from '../providers/DagTreeDataProvider';
import { DagService } from '../../core/services/DagService';
import { ConnectionService } from '../../core/services/ConnectionService';
import { IStateManager } from '../../core/interfaces/IAirflowClient';
import { Logger } from '../../infrastructure/logging/Logger';
import { EventBus, Events } from '../../shared/events/EventBus';
import { ServerConfig } from '../../core/models/Server';
import { Dag } from '../../core/models/Dag';

export class DagTreeView {
  private logger = Logger.getInstance();
  private eventBus = EventBus.getInstance();
  private view: vscode.TreeView<DagTreeItem>;
  private provider: DagTreeDataProvider;
  private dagService: DagService | undefined;
  private refreshInterval: NodeJS.Timeout | undefined;
  private favoriteDags: string[] = [];

  constructor(
    private connectionService: ConnectionService,
    private stateManager: IStateManager,
    private context: vscode.ExtensionContext
  ) {
    this.provider = new DagTreeDataProvider();
    this.view = vscode.window.createTreeView('dagTreeView', {
      treeDataProvider: this.provider,
      showCollapseAll: true,
    });

    this.loadState();
    this.setupEventListeners();
    this.updateViewTitle();
    this.updateViewMessage();

    context.subscriptions.push(this.view);
    context.subscriptions.push({ dispose: () => this.dispose() });
  }

  private setupEventListeners(): void {
    this.eventBus.on(Events.SERVER_CONNECTED, () => {
      this.onServerConnected();
    });

    this.eventBus.on(Events.SERVER_DISCONNECTED, () => {
      this.onServerDisconnected();
    });

    this.eventBus.on(Events.DAG_TRIGGERED, () => {
      this.startRefreshInterval();
    });

    this.eventBus.on(Events.DAG_STATE_CHANGED, () => {
      this.provider.refresh();
    });
  }

  private async onServerConnected(): Promise<void> {
    const client = this.connectionService.getCurrentClient();
    if (client) {
      this.dagService = new DagService(client);
      await this.refresh();
    }
    this.updateViewTitle();
  }

  private onServerDisconnected(): void {
    this.dagService = undefined;
    this.provider.setDags([]);
    this.updateViewTitle();
    this.stopRefreshInterval();
  }

  async refresh(): Promise<void> {
    this.logger.info('Refreshing DAG list');

    if (!this.dagService) {
      this.provider.setDags([]);
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Window,
        title: 'Airflow: Loading DAGs...',
      },
      async () => {
        const dags = await this.dagService!.loadDags();
        
        // Restore favorite status
        dags.forEach((dag) => {
          if (this.favoriteDags.includes(dag.id)) {
            dag.setFavorite(true);
          }
        });

        this.provider.setDags(dags);
        this.logger.info(`Loaded ${dags.length} DAGs`);
      }
    );
  }

  async addServer(): Promise<void> {
    const serverType = await vscode.window.showQuickPick(['Self-Hosted Airflow', 'AWS MWAA'], {
      placeHolder: 'Select Airflow Server Type',
    });

    if (!serverType) {
      return;
    }

    if (serverType === 'AWS MWAA') {
      await this.addMWAAServer();
    } else {
      await this.addSelfHostedServer();
    }
  }

  private async addMWAAServer(): Promise<void> {
    const envName = await vscode.window.showInputBox({
      placeHolder: 'MWAA Environment Name',
      prompt: 'Enter your AWS MWAA environment name',
    });
    if (!envName) {
      return;
    }

    const region = await vscode.window.showInputBox({
      placeHolder: 'AWS Region (e.g., us-east-1)',
      prompt: 'Enter AWS region',
      value: 'us-east-1',
    });
    if (!region) {
      return;
    }

    const awsProfile = await vscode.window.showInputBox({
      placeHolder: 'AWS Profile (optional)',
      prompt: 'Enter AWS CLI profile name (leave empty for default)',
    });

    const config: ServerConfig = {
      apiUrl: envName,
      type: 'mwaa',
      region: region,
      awsProfile: awsProfile || undefined,
    };

    await this.addServerWithConfig(config);
  }

  private async addSelfHostedServer(): Promise<void> {
    const apiUrl = await vscode.window.showInputBox({
      value: 'http://localhost:8080/api/v1',
      placeHolder: 'API Full URL (e.g., http://localhost:8080/api/v1 or /api/v2)',
    });
    if (!apiUrl) {
      return;
    }

    const userName = await vscode.window.showInputBox({
      placeHolder: 'Username',
    });
    if (!userName) {
      return;
    }

    const password = await vscode.window.showInputBox({
      placeHolder: 'Password',
      password: true,
    });
    if (!password) {
      return;
    }

    const config: ServerConfig = {
      apiUrl: apiUrl,
      apiUserName: userName,
      apiPassword: password,
      type: 'self-hosted',
    };

    await this.addServerWithConfig(config);
  }

  private async addServerWithConfig(config: ServerConfig): Promise<void> {
    vscode.window.showInformationMessage('Testing connection...');
    
    const added = await this.connectionService.addServer(config);
    if (added) {
      const server = this.connectionService.getServers().find(
        (s) => s.config.apiUrl === config.apiUrl
      );
      if (server) {
        await this.connectionService.connectToServer(server.identifier);
        vscode.window.showInformationMessage('Connection successful!');
      }
    } else {
      vscode.window.showErrorMessage('Failed to connect to server.');
    }
  }

  async removeServer(): Promise<void> {
    const servers = this.connectionService.getServers();
    if (servers.length === 0) {
      vscode.window.showInformationMessage('No servers to remove');
      return;
    }

    const items = servers.map((s) => s.displayName);
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select Server to Remove',
    });

    if (selected) {
      const index = items.indexOf(selected);
      const server = servers[index];
      await this.connectionService.removeServer(server.identifier);
      vscode.window.showInformationMessage('Server removed');
    }
  }

  async connectServer(): Promise<void> {
    const servers = this.connectionService.getServers();
    if (servers.length === 0) {
      await this.addServer();
      return;
    }

    const items = servers.map((s) => s.displayName);
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select Server to Connect',
    });

    if (selected) {
      const index = items.indexOf(selected);
      const server = servers[index];
      vscode.window.showInformationMessage('Connecting...');
      
      const connected = await this.connectionService.connectToServer(server.identifier);
      if (connected) {
        vscode.window.showInformationMessage('Connected successfully!');
      } else {
        vscode.window.showErrorMessage('Failed to connect to server');
      }
    }
  }

  async triggerDag(item: DagTreeItem): Promise<void> {
    if (!this.dagService) {
      return;
    }

    try {
      const dag = item.getDag();
      await this.dagService.triggerDag(dag);
      item.updateUI();
      this.provider.refresh();
      vscode.window.showInformationMessage(`DAG ${dag.id} triggered successfully!`);
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  async triggerDagWithConfig(item: DagTreeItem): Promise<void> {
    if (!this.dagService) {
      return;
    }

    const config = await vscode.window.showInputBox({
      placeHolder: 'Enter Configuration JSON (Optional, must be a dict object) or Press Enter',
    });

    if (config === undefined) {
      return;
    }

    try {
      const dag = item.getDag();
      await this.dagService.triggerDag(dag, config || '{}');
      item.updateUI();
      this.provider.refresh();
      vscode.window.showInformationMessage(`DAG ${dag.id} triggered with config!`);
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  async pauseDag(item: DagTreeItem): Promise<void> {
    if (!this.dagService) {
      return;
    }

    try {
      const dag = item.getDag();
      if (dag.isPaused) {
        vscode.window.showWarningMessage(`DAG ${dag.id} is already paused`);
        return;
      }

      await this.dagService.pauseDag(dag);
      item.updateUI();
      this.provider.refresh();
      vscode.window.showInformationMessage(`DAG ${dag.id} paused`);
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  async unpauseDag(item: DagTreeItem): Promise<void> {
    if (!this.dagService) {
      return;
    }

    try {
      const dag = item.getDag();
      if (!dag.isPaused) {
        vscode.window.showInformationMessage(`DAG ${dag.id} is already active`);
        return;
      }

      await this.dagService.unpauseDag(dag);
      item.updateUI();
      this.provider.refresh();
      vscode.window.showInformationMessage(`DAG ${dag.id} unpaused`);
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  async cancelDagRun(item: DagTreeItem): Promise<void> {
    if (!this.dagService) {
      return;
    }

    try {
      const dag = item.getDag();
      await this.dagService.cancelDagRun(dag);
      item.updateUI();
      this.provider.refresh();
      vscode.window.showInformationMessage(`DAG run cancelled`);
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  async viewLogs(item: DagTreeItem): Promise<void> {
    if (!this.dagService) {
      return;
    }

    try {
      vscode.window.showInformationMessage('Fetching logs...');
      const dag = item.getDag();
      const logs = await this.dagService.getDagLogs(dag);
      this.createAndOpenTempFile(logs, dag.id, '.log');
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  async viewSourceCode(item: DagTreeItem): Promise<void> {
    if (!this.dagService) {
      return;
    }

    try {
      const dag = item.getDag();
      const source = await this.dagService.getDagSourceCode(dag);
      this.createAndOpenTempFile(source, dag.id, '.py');
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  async viewDagInfo(item: DagTreeItem): Promise<void> {
    if (!this.dagService) {
      return;
    }

    try {
      const dag = item.getDag();
      const info = await this.dagService.getDagInfo(dag);
      this.createAndOpenTempFile(JSON.stringify(info, null, 2), dag.id + '_info', '.json');
    } catch (error) {
      vscode.window.showErrorMessage((error as Error).message);
    }
  }

  async filter(): Promise<void> {
    const filterString = await vscode.window.showInputBox({
      value: this.provider.getFilterString(),
      placeHolder: 'Enter filters separated by comma (e.g., dag_name, owner, active)',
    });

    if (filterString !== undefined) {
      this.provider.setFilterString(filterString);
      this.updateViewMessage();
      await this.saveState();
    }
  }

  async toggleShowOnlyActive(): Promise<void> {
    this.provider.setShowOnlyActive(!this.provider.getShowOnlyActive());
    this.updateViewMessage();
    await this.saveState();
  }

  async toggleShowOnlyFavorite(): Promise<void> {
    this.provider.setShowOnlyFavorite(!this.provider.getShowOnlyFavorite());
    this.updateViewMessage();
    await this.saveState();
  }

  async addToFavorites(item: DagTreeItem): Promise<void> {
    const dag = item.getDag();
    dag.setFavorite(true);
    
    if (!this.favoriteDags.includes(dag.id)) {
      this.favoriteDags.push(dag.id);
    }
    
    item.updateUI();
    this.provider.refresh();
    await this.saveState();
  }

  async removeFromFavorites(item: DagTreeItem): Promise<void> {
    const dag = item.getDag();
    dag.setFavorite(false);
    
    this.favoriteDags = this.favoriteDags.filter((id) => id !== dag.id);
    
    item.updateUI();
    this.provider.refresh();
    await this.saveState();
  }

  async viewDagDetails(): Promise<void> {
    vscode.window.showInformationMessage('DAG detail view coming in next phase!');
  }

  private createAndOpenTempFile(content: string, prefix: string, extension: string): void {
    const tmpFile = tmp.fileSync({ mode: 0o644, prefix, postfix: extension });
    fs.appendFileSync(tmpFile.name, content);
    vscode.workspace.openTextDocument(tmpFile.name).then((doc) => {
      vscode.window.showTextDocument(doc);
    });
  }

  private startRefreshInterval(): void {
    if (!this.refreshInterval) {
      this.refreshInterval = setInterval(() => {
        this.refreshRunningDags();
      }, 10000);
    }
  }

  private stopRefreshInterval(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = undefined;
    }
  }

  private async refreshRunningDags(): Promise<void> {
    if (!this.dagService) {
      return;
    }

    const items = this.provider.getVisibleItems();
    let hasRunningDags = false;

    for (const item of items) {
      const dag = item.getDag();
      if (dag.isRunning()) {
        hasRunningDags = true;
        await this.dagService.refreshDagState(dag);
        item.updateUI();
      }
    }

    if (!hasRunningDags) {
      this.stopRefreshInterval();
      this.logger.info('All DAG runs completed');
    }

    this.provider.refresh();
  }

  private updateViewTitle(): void {
    const server = this.connectionService.getCurrentServer();
    this.view.title = server ? server.displayName : 'Airflow';
  }

  private updateViewMessage(): void {
    const server = this.connectionService.getCurrentServer();
    if (server) {
      const favSign = this.provider.getShowOnlyFavorite() ? '✓' : '✗';
      const activeSign = this.provider.getShowOnlyActive() ? '✓' : '✗';
      const filter = this.provider.getFilterString();
      this.view.message = `${favSign}Fav, ${activeSign}Active, Filter: ${filter}`;
    }
  }

  private async saveState(): Promise<void> {
    try {
      await this.stateManager.set('filterString', this.provider.getFilterString());
      await this.stateManager.set('showOnlyActive', this.provider.getShowOnlyActive());
      await this.stateManager.set('showOnlyFavorite', this.provider.getShowOnlyFavorite());
      await this.stateManager.set('favoriteDags', this.favoriteDags);
    } catch (error) {
      this.logger.error('Failed to save DAG tree state', error as Error);
    }
  }

  private loadState(): void {
    try {
      const filterString = this.stateManager.get<string>('filterString') || '';
      const showOnlyActive = this.stateManager.get<boolean>('showOnlyActive') ?? true;
      const showOnlyFavorite = this.stateManager.get<boolean>('showOnlyFavorite') ?? false;
      this.favoriteDags = this.stateManager.get<string[]>('favoriteDags') || [];

      this.provider.setFilterString(filterString);
      this.provider.setShowOnlyActive(showOnlyActive);
      this.provider.setShowOnlyFavorite(showOnlyFavorite);
    } catch (error) {
      this.logger.error('Failed to load DAG tree state', error as Error);
    }
  }

  private dispose(): void {
    this.stopRefreshInterval();
  }
}
