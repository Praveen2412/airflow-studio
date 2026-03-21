import * as vscode from 'vscode';
import { DagSummary } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';

export class DagsTreeProvider implements vscode.TreeDataProvider<DagTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<DagTreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private dags: DagSummary[] = [];

  constructor(private serverManager: ServerManager) {
    Logger.debug('DagsTreeProvider: Initialized');
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  async loadDags(): Promise<void> {
    try {
      Logger.debug('DagsTreeProvider.loadDags: Starting');
      const client = await this.serverManager.getClient();
      if (client) {
        Logger.debug('DagsTreeProvider.loadDags: Client obtained, fetching DAGs');
        this.dags = await client.listDags();
        Logger.info('DagsTreeProvider.loadDags: Success', { count: this.dags.length });
        this.refresh();
      } else {
        Logger.warn('DagsTreeProvider.loadDags: No client available');
      }
    } catch (error: any) {
      Logger.error('DagsTreeProvider.loadDags: Failed', error);
      vscode.window.showErrorMessage(`Failed to load DAGs: ${error.message}`);
    }
  }

  getTreeItem(element: DagTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: DagTreeItem): Promise<DagTreeItem[]> {
    if (!element) {
      return this.dags.map(d => new DagTreeItem(d));
    }
    return [];
  }
}

class DagTreeItem extends vscode.TreeItem {
  constructor(public readonly dag: DagSummary) {
    super(dag.dagId, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'dag';
    this.description = dag.paused ? '⏸️ Paused' : '▶️ Active';
    this.tooltip = `${dag.dagId}\nOwner: ${dag.owner}\nSchedule: ${dag.schedule || 'None'}`;
    
    const iconName = dag.paused ? 'debug-pause' : 
                     dag.lastRunState === 'success' ? 'pass' :
                     dag.lastRunState === 'failed' ? 'error' :
                     dag.lastRunState === 'running' ? 'sync~spin' : 'circle-outline';
    this.iconPath = new vscode.ThemeIcon(iconName);
    
    // Click to open DAG details
    this.command = {
      command: 'airflow.openDagDetails',
      title: 'Open DAG Details',
      arguments: [this.dag]
    };
  }
}
