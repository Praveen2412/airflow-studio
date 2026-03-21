import * as vscode from 'vscode';
import { ServerProfile } from '../models';
import { ServerManager } from '../managers/ServerManager';

export class ServersTreeProvider implements vscode.TreeDataProvider<ServerTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ServerTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private serverManager: ServerManager) {}

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ServerTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: ServerTreeItem): Promise<ServerTreeItem[]> {
    if (!element) {
      const servers = await this.serverManager.getServers();
      return servers.map(s => new ServerTreeItem(s));
    }
    return [];
  }
}

class ServerTreeItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile) {
    super(server.name, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'server';
    this.description = server.type === 'mwaa' ? 'MWAA' : 'Self-hosted';
    this.tooltip = `${server.name}\n${server.baseUrl || server.awsRegion}`;
    
    const iconName = server.lastHealthStatus === 'healthy' ? 'pass' : 
                     server.lastHealthStatus === 'degraded' ? 'warning' : 
                     server.lastHealthStatus === 'down' ? 'error' : 'circle-outline';
    this.iconPath = new vscode.ThemeIcon(iconName);
  }
}
