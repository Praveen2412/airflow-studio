import * as vscode from 'vscode';
import { DagTreeItem } from '../items/DagTreeItem';
import { Dag } from '../../core/models/Dag';

export class DagTreeDataProvider implements vscode.TreeDataProvider<DagTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<DagTreeItem | undefined | null | void> =
    new vscode.EventEmitter<DagTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<DagTreeItem | undefined | null | void> =
    this._onDidChangeTreeData.event;

  private dags: Dag[] = [];
  private visibleItems: DagTreeItem[] = [];
  private filterString: string = '';
  private showOnlyActive: boolean = true;
  private showOnlyFavorite: boolean = false;

  refresh(): void {
    this.applyFilters();
    this._onDidChangeTreeData.fire();
  }

  setDags(dags: Dag[]): void {
    this.dags = dags;
    this.refresh();
  }

  getDags(): Dag[] {
    return this.dags;
  }

  getVisibleItems(): DagTreeItem[] {
    return this.visibleItems;
  }

  setFilterString(filter: string): void {
    this.filterString = filter;
    this.refresh();
  }

  getFilterString(): string {
    return this.filterString;
  }

  setShowOnlyActive(value: boolean): void {
    this.showOnlyActive = value;
    this.refresh();
  }

  getShowOnlyActive(): boolean {
    return this.showOnlyActive;
  }

  setShowOnlyFavorite(value: boolean): void {
    this.showOnlyFavorite = value;
    this.refresh();
  }

  getShowOnlyFavorite(): boolean {
    return this.showOnlyFavorite;
  }

  getTreeItem(element: DagTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: DagTreeItem): Thenable<DagTreeItem[]> {
    if (element) {
      return Promise.resolve([]);
    }
    return Promise.resolve(this.visibleItems);
  }

  private applyFilters(): void {
    this.visibleItems = this.dags
      .filter((dag) => {
        // Filter by active/paused
        if (this.showOnlyActive && dag.isPaused) {
          return false;
        }

        // Filter by favorites
        if (this.showOnlyFavorite && !dag.isFavorite) {
          return false;
        }

        // Filter by search string
        if (this.filterString) {
          const filters = this.filterString
            .toLowerCase()
            .split(',')
            .map((f) => f.trim())
            .filter((f) => f.length > 0);

          if (filters.length > 0) {
            const matches = filters.some((filter) => dag.matchesFilter(filter));
            if (!matches) {
              return false;
            }
          }
        }

        return true;
      })
      .map((dag) => {
        const item = new DagTreeItem(dag);
        return item;
      });
  }
}
