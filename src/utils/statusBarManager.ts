import * as vscode from 'vscode';
import { ServerProfile } from '../models';

/**
 * Centralized manager for VS Code status bar item
 */
export class StatusBarManager {
  private item: vscode.StatusBarItem;

  constructor(context: vscode.ExtensionContext) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.item.text = '$(cloud) Airflow Studio';
    this.item.show();
    context.subscriptions.push(this.item);
  }

  /**
   * Update status bar with server count and health information
   */
  updateServerCount(servers: ServerProfile[]): void {
    if (servers.length === 0) {
      this.item.text = '$(cloud) Airflow Studio';
      this.item.tooltip = 'No servers configured';
      return;
    }

    const healthyCount = servers.filter(s => s.lastHealthStatus === 'healthy').length;
    const downCount = servers.filter(s => s.lastHealthStatus === 'down').length;
    const degradedCount = servers.filter(s => s.lastHealthStatus === 'degraded').length;

    this.item.text = `$(cloud) Airflow Studio (${servers.length} server${servers.length > 1 ? 's' : ''}, ${healthyCount} healthy)`;
    
    const tooltipParts = [
      `Total servers: ${servers.length}`,
      `Healthy: ${healthyCount}`,
    ];

    if (downCount > 0) {
      tooltipParts.push(`Down: ${downCount}`);
    }

    if (degradedCount > 0) {
      tooltipParts.push(`Degraded: ${degradedCount}`);
    }

    this.item.tooltip = tooltipParts.join('\n');
  }

  /**
   * Show loading indicator
   */
  showLoading(message: string = 'Loading...'): void {
    this.item.text = `$(sync~spin) ${message}`;
  }

  /**
   * Show error state
   */
  showError(message: string): void {
    this.item.text = `$(error) ${message}`;
    this.item.tooltip = message;
  }

  /**
   * Reset to default state
   */
  reset(): void {
    this.item.text = '$(cloud) Airflow Studio';
    this.item.tooltip = undefined;
  }

  /**
   * Dispose the status bar item
   */
  dispose(): void {
    this.item.dispose();
  }
}
