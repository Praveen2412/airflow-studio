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
      Logger.debug('ServersTreeProvider.getChildren: Loaded', { count: servers.length });
      const items: (ServerTreeItem | AddServerTreeItem)[] = servers.map(s => new ServerTreeItem(s));
      // Add "Add Server" button at the top
      items.unshift(new AddServerTreeItem());
      return items;
    }
    return [];
  }
}

class AddServerTreeItem extends vscode.TreeItem {
  constructor() {
    super('➕ Add Server', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'addServer';
    this.command = {
      command: 'airflow.addServer',
      title: 'Add Server'
    };
    this.iconPath = new vscode.ThemeIcon('add');
  }
}

class ServerTreeItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile) {
    super(server.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'server';
    this.description = server.type === 'mwaa' ? 'MWAA' : 'Self-hosted';
    this.tooltip = `${server.name}\n${server.baseUrl || server.awsRegion}\nAPI: ${server.apiMode}`;
    
    const iconName = server.lastHealthStatus === 'healthy' ? 'pass' : 
                     server.lastHealthStatus === 'degraded' ? 'warning' : 
                     server.lastHealthStatus === 'down' ? 'error' : 'circle-outline';
    this.iconPath = new vscode.ThemeIcon(iconName);
    
    // Click to open details
    this.command = {
      command: 'airflow.openServerDetails',
      title: 'Open Server Details',
      arguments: [this.server]
    };
  }
}
