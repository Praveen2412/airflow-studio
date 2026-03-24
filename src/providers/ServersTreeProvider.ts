import * as vscode from 'vscode';
import { ServerProfile } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

export class ServersTreeProvider implements vscode.TreeDataProvider<ServerTreeItem | AddServerTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ServerTreeItem | AddServerTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private serverManager: ServerManager) {
    Logger.debug('ServersTreeProvider: Initialized');
  }

  refresh(): void {
    Logger.debug('ServersTreeProvider: Refreshing');
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ServerTreeItem | AddServerTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ServerTreeItem | AddServerTreeItem): Promise<(ServerTreeItem | AddServerTreeItem)[]> {
    if (!element) {
      Logger.debug('ServersTreeProvider.getChildren: Loading servers');
      const servers = await this.serverManager.getServers();
      const activeServer = await this.serverManager.getActiveServer();
      Logger.debug('ServersTreeProvider.getChildren: Loaded', { count: servers.length, activeId: activeServer?.id });
      const items: (ServerTreeItem | AddServerTreeItem)[] = servers.map(s => new ServerTreeItem(s, s.id === activeServer?.id));
      // Add "Add Server" button at the top
      items.unshift(new AddServerTreeItem());
      return items;
    }
    return [];
  }
}

class AddServerTreeItem extends vscode.TreeItem {
  constructor() {
    super('Add Server', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'addServer';
    this.command = {
      command: 'airflow.addServerPanel',
      title: 'Add Server'
    };
    this.iconPath = new vscode.ThemeIcon('add');
  }
}

class ServerTreeItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile, isActive: boolean = false) {
    super(server.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'server';
    this.description = `${server.type === 'mwaa' ? 'MWAA' : 'Self-hosted'}${isActive ? ' (Active)' : ''}`;
    this.tooltip = `${server.name}\n${server.baseUrl || server.awsRegion}\nAPI: ${server.apiMode}${isActive ? '\n\u2713 Active Server' : ''}`;
    
    const iconName = server.lastHealthStatus === 'healthy' ? 'pass' : 
                     server.lastHealthStatus === 'degraded' ? 'warning' : 
                     server.lastHealthStatus === 'down' ? 'error' : 'circle-outline';
    this.iconPath = new vscode.ThemeIcon(iconName, isActive ? new vscode.ThemeColor('charts.green') : undefined);
    
    // Click to open details
    this.command = {
      command: 'airflow.openServerDetails',
      title: 'Open Server Details',
      arguments: [this.server]
    };
  }
}
