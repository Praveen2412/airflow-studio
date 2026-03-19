import * as vscode from 'vscode';

class AdminTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly command?: vscode.Command
  ) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = command;
  }
}

export class AdminTreeView implements vscode.TreeDataProvider<AdminTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<AdminTreeItem | undefined | null | void> =
    new vscode.EventEmitter<AdminTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<AdminTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: AdminTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: AdminTreeItem): Thenable<AdminTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }

    const items: AdminTreeItem[] = [
      new AdminTreeItem('Connections', {
        command: 'dagTreeView.viewConnections',
        title: 'View Connections',
      }),
      new AdminTreeItem('Variables', {
        command: 'dagTreeView.viewVariables',
        title: 'View Variables',
      }),
      new AdminTreeItem('Providers', {
        command: 'dagTreeView.viewProviders',
        title: 'View Providers',
      }),
      new AdminTreeItem('Server Health', {
        command: 'dagTreeView.viewServerHealth',
        title: 'View Server Health',
      }),
    ];

    return Promise.resolve(items);
  }

  async viewConnections(): Promise<void> {
    vscode.window.showInformationMessage('Connections view coming in next phase!');
  }

  async viewVariables(): Promise<void> {
    vscode.window.showInformationMessage('Variables view coming in next phase!');
  }

  async viewProviders(): Promise<void> {
    vscode.window.showInformationMessage('Providers view coming in next phase!');
  }

  async viewServerHealth(): Promise<void> {
    vscode.window.showInformationMessage('Server health view coming in next phase!');
  }
}
