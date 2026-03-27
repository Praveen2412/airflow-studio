import * as vscode from 'vscode';

/**
 * Configuration constants for Airflow Studio extension
 * All values can be overridden via VS Code settings
 */
export class Constants {
  private static config = vscode.workspace.getConfiguration('airflowStudio');

  // Health check interval in milliseconds (default: 30 seconds)
  static get HEALTH_CHECK_INTERVAL(): number {
    return this.config.get<number>('healthCheckInterval', 30000);
  }

  // Client cache TTL in milliseconds (default: 5 minutes)
  static get CLIENT_CACHE_TTL(): number {
    return this.config.get<number>('clientCacheTTL', 300000);
  }

  // JWT token cache TTL in milliseconds (default: 50 minutes)
  static get TOKEN_CACHE_TTL(): number {
    return this.config.get<number>('tokenCacheTTL', 3000000);
  }

  // Webview update delay in milliseconds (default: 500ms)
  static get WEBVIEW_UPDATE_DELAY(): number {
    return this.config.get<number>('webviewUpdateDelay', 500);
  }

  // DAG list cache TTL in milliseconds (default: 30 seconds)
  static get DAG_CACHE_TTL(): number {
    return this.config.get<number>('dagCacheTTL', 30000);
  }

  // Task refresh delay after operations (default: 1 second)
  static get TASK_REFRESH_DELAY(): number {
    return this.config.get<number>('taskRefreshDelay', 1000);
  }

  // HTTP request timeout in milliseconds (default: 30 seconds)
  static get HTTP_TIMEOUT(): number {
    return this.config.get<number>('httpTimeout', 30000);
  }

  // Default DAG run limit (default: 25)
  static get DEFAULT_DAG_RUN_LIMIT(): number {
    return this.config.get<number>('defaultDagRunLimit', 25);
  }

  // Default API list limit (default: 100)
  static get DEFAULT_API_LIMIT(): number {
    return this.config.get<number>('defaultApiLimit', 100);
  }

  // Refresh configuration when settings change
  static refresh(): void {
    this.config = vscode.workspace.getConfiguration('airflowStudio');
  }
}

// Listen for configuration changes
export function registerConfigurationListener(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('airflowStudio')) {
        Constants.refresh();
      }
    })
  );
}
