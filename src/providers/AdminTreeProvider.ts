import * as vscode from 'vscode';
import { ServerManager } from '../managers/ServerManager';

export class AdminTreeProvider implements vscode.TreeDataProvider<AdminTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<AdminTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private serverManager: ServerManager) {}

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
        new AdminTreeItem('Health Check', 'health', 'pulse')
      ];
    }
    return [];
  }
}

class AdminTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly type: string,
    iconName: string
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = type;
    this.iconPath = new vscode.ThemeIcon(iconName);
    this.command = {
      command: `airflow.open${label.replace(' ', '')}`,
      title: `Open ${label}`,
      arguments: []
    };
  }
}
