import * as vscode from 'vscode';
import { Dag } from '../../core/models/Dag';

export class DagTreeItem extends vscode.TreeItem {
  constructor(private dag: Dag) {
    super(dag.id, vscode.TreeItemCollapsibleState.None);
    this.updateUI();
  }

  getDag(): Dag {
    return this.dag;
  }

  updateUI(): void {
    // Set icon based on state
    if (this.dag.isRunning()) {
      this.iconPath = new vscode.ThemeIcon('sync~spin');
    } else if (this.dag.isPaused) {
      this.iconPath = new vscode.ThemeIcon('debug-pause');
    } else {
      this.iconPath = new vscode.ThemeIcon('circle-large-filled');
    }

    // Set context value for conditional menus
    this.contextValue = this.buildContextValue();

    // Set tooltip
    this.tooltip = this.buildTooltip();

    // Set description
    this.description = this.buildDescription();
  }

  private buildContextValue(): string {
    let context = 'dag';
    if (this.dag.isPaused) {
      context += '#IsPaused#';
    }
    if (!this.dag.isPaused) {
      context += '#!IsPaused#';
    }
    if (this.dag.isRunning()) {
      context += '#IsRunning#';
    }
    if (!this.dag.isRunning()) {
      context += '#!IsRunning#';
    }
    if (this.dag.isFavorite) {
      context += '#IsFav#';
    }
    if (!this.dag.isFavorite) {
      context += '#!IsFav#';
    }
    return context;
  }

  private buildTooltip(): string {
    let tooltip = `DAG: ${this.dag.id}\n`;
    tooltip += `Status: ${this.dag.isPaused ? 'Paused' : 'Active'}\n`;
    if (this.dag.latestState) {
      tooltip += `Last Run: ${this.dag.latestState}\n`;
    }
    if (this.dag.owners.length > 0) {
      tooltip += `Owners: ${this.dag.owners.join(', ')}\n`;
    }
    if (this.dag.tags.length > 0) {
      tooltip += `Tags: ${this.dag.tags.join(', ')}`;
    }
    return tooltip;
  }

  private buildDescription(): string {
    const parts: string[] = [];
    if (this.dag.isPaused) {
      parts.push('⏸️ Paused');
    }
    if (this.dag.latestState) {
      const stateEmoji = this.getStateEmoji(this.dag.latestState);
      parts.push(`${stateEmoji} ${this.dag.latestState}`);
    }
    return parts.join(' | ');
  }

  private getStateEmoji(state: string): string {
    switch (state) {
      case 'success':
        return '✅';
      case 'failed':
        return '❌';
      case 'running':
        return '🔄';
      case 'queued':
        return '⏳';
      default:
        return '⚪';
    }
  }
}
