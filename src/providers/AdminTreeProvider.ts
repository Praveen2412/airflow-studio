import * as vscode from 'vscode';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

export class AdminTreeProvider implements vscode.TreeDataProvider<AdminTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AdminTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private serverManager: ServerManager) {
    Logger.debug('AdminTreeProvider: Initialized');
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: AdminTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: AdminTreeItem): Promise<AdminTreeItem[]> {
    if (!element) {
      return [
        new AdminTreeItem('Variables', 'variables', 'symbol-variable'),
        new AdminTreeItem('Pools', 'pools', 'database'),
        new AdminTreeItem('Connections', 'connections', 'plug'),
        new AdminTreeItem('Health Check', 'health', 'pulse', 'airflow.openHealthCheck')
      ];
    }
    return [];
  }
}

class AdminTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: string,
    iconName: string,
    commandId?: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = type;
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.command = {
      command: commandId ?? `airflow.open${label.replace(' ', '')}`,
      title: `Open ${label}`,
      arguments: []
    };
  }
}
