import * as vscode from 'vscode';
import { ServerProfile, DagSummary } from '../models';
import { ServerManager } from '../managers/ServerManager';
import { Logger } from '../utils/logger';
import { Constants } from '../utils/constants';

type TreeItemType = ServerTreeItem | DagsFolderItem | AdminFolderItem | DagTreeItem | AdminItemTreeItem | NoServersItem;

interface DagCache {
  dags: DagSummary[];
  timestamp: number;
}

export class ServersTreeProvider implements vscode.TreeDataProvider<TreeItemType> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeItemType | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private hiddenServers = new Set<string>();
  private hiddenDagsFolders = new Set<string>();
  private showOnlyFavoriteServers = false;
  private showOnlyFavoriteDagsPerServer = new Map<string, boolean>();
  private dagCache = new Map<string, DagCache>();

  constructor(private serverManager: ServerManager) {
    Logger.debug('ServersTreeProvider: Initialized');
  }

  refresh(): void {
    Logger.debug('ServersTreeProvider: Refreshing');
    // Clear cache on manual refresh
    this.dagCache.clear();
    this._onDidChangeTreeData.fire(undefined);
  }

  clearDagCache(serverId?: string): void {
    if (serverId) {
      Logger.debug('ServersTreeProvider: Clearing DAG cache for server', { serverId });
      this.dagCache.delete(serverId);
    } else {
      Logger.debug('ServersTreeProvider: Clearing all DAG caches');
      this.dagCache.clear();
    }
  }

  getTreeItem(element: TreeItemType): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: TreeItemType): Promise<TreeItemType[]> {
    if (!element) {
      Logger.debug('ServersTreeProvider.getChildren: Loading servers');
      let servers = await this.serverManager.getServers();
      
      if (servers.length === 0) {
        return [new NoServersItem()];
      }
      
      if (this.showOnlyFavoriteServers) {
        servers = servers.filter(s => s.isFavorite);
      }
      
      Logger.debug('ServersTreeProvider.getChildren: Loaded', { count: servers.length, showOnlyFavorites: this.showOnlyFavoriteServers });
      const items: TreeItemType[] = servers.map(s => new ServerTreeItem(s, false, this.hiddenServers.has(s.id)));
      return items;
    }

    if (element instanceof ServerTreeItem) {
      const isHidden = this.hiddenServers.has(element.server.id);
      if (isHidden) return [];
      
      return [
        new DagsFolderItem(element.server, this.hiddenDagsFolders.has(element.server.id)),
        new AdminFolderItem(element.server)
      ];
    }

    if (element instanceof DagsFolderItem) {
      const isHidden = this.hiddenDagsFolders.has(element.server.id);
      if (isHidden) return [];
      
      try {
        // Check cache first
        const cached = this.dagCache.get(element.server.id);
        const now = Date.now();
        const cacheAge = cached ? now - cached.timestamp : Infinity;
        const isCacheValid = cached && cacheAge < Constants.DAG_CACHE_TTL;
        
        if (isCacheValid) {
          Logger.debug('ServersTreeProvider: Using cached DAGs', { 
            serverId: element.server.id, 
            count: cached.dags.length,
            age: cacheAge,
            ttl: Constants.DAG_CACHE_TTL
          });
          let dags = cached.dags;
          
          const showOnlyFavorites = this.showOnlyFavoriteDagsPerServer.get(element.server.id) || false;
          if (showOnlyFavorites) {
            const favoriteDags = element.server.favoriteDags || [];
            dags = dags.filter(dag => favoriteDags.includes(dag.dagId));
          }
          
          return dags.map(dag => new DagTreeItem(dag, element.server.id, element.server.favoriteDags?.includes(dag.dagId) || false));
        }
        
        // Cache miss or expired - fetch from API
        Logger.debug('ServersTreeProvider: Cache expired or missing, fetching DAGs from API', { 
          serverId: element.server.id,
          cacheAge,
          ttl: Constants.DAG_CACHE_TTL,
          expired: cached ? cacheAge >= Constants.DAG_CACHE_TTL : false
        });
        const client = await this.serverManager.getClient(element.server.id);
        if (!client) return [];
        
        const dags = await client.listDags();
        
        // Update cache
        this.dagCache.set(element.server.id, { dags, timestamp: now });
        Logger.debug('ServersTreeProvider: Cached DAGs', { serverId: element.server.id, count: dags.length });
        
        const showOnlyFavorites = this.showOnlyFavoriteDagsPerServer.get(element.server.id) || false;
        let filteredDags = dags;
        if (showOnlyFavorites) {
          const favoriteDags = element.server.favoriteDags || [];
          filteredDags = dags.filter(dag => favoriteDags.includes(dag.dagId));
        }
        
        return filteredDags.map(dag => new DagTreeItem(dag, element.server.id, element.server.favoriteDags?.includes(dag.dagId) || false));
      } catch (error: any) {
        Logger.error('Failed to load DAGs', error, { serverId: element.server.id });
        // Clear cache on error
        this.dagCache.delete(element.server.id);
        return [];
      }
    }

    if (element instanceof AdminFolderItem) {
      return [
        new AdminItemTreeItem('Variables', 'variables', element.server.id),
        new AdminItemTreeItem('Pools', 'pools', element.server.id),
        new AdminItemTreeItem('Connections', 'connections', element.server.id),
        new AdminItemTreeItem('Config', 'config', element.server.id),
        new AdminItemTreeItem('Plugins', 'plugins', element.server.id),
        new AdminItemTreeItem('Providers', 'providers', element.server.id),
        new AdminItemTreeItem('Health Check', 'health', element.server.id)
      ];
    }

    return [];
  }

  toggleServerVisibility(serverId: string): void {
    if (this.hiddenServers.has(serverId)) {
      this.hiddenServers.delete(serverId);
    } else {
      this.hiddenServers.add(serverId);
    }
    this.refresh();
  }

  toggleDagsVisibility(serverId: string): void {
    if (this.hiddenDagsFolders.has(serverId)) {
      this.hiddenDagsFolders.delete(serverId);
    } else {
      this.hiddenDagsFolders.add(serverId);
    }
    this.refresh();
  }

  toggleShowOnlyFavoriteServers(): void {
    this.showOnlyFavoriteServers = !this.showOnlyFavoriteServers;
    Logger.info('toggleShowOnlyFavoriteServers', { showOnlyFavorites: this.showOnlyFavoriteServers });
    this.refresh();
  }

  toggleShowOnlyFavoriteDags(serverId: string): void {
    const current = this.showOnlyFavoriteDagsPerServer.get(serverId) || false;
    this.showOnlyFavoriteDagsPerServer.set(serverId, !current);
    Logger.info('toggleShowOnlyFavoriteDags', { serverId, showOnlyFavorites: !current });
    this.refresh();
  }
}

class ServerTreeItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile, isActive: boolean = false, isHidden: boolean = false) {
    super(server.name, isHidden ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'server';
    
    const healthIcon = server.lastHealthStatus === 'healthy' ? '✓' : 
                       server.lastHealthStatus === 'down' ? '✗' : 
                       server.lastHealthStatus === 'degraded' ? '⚠' : '○';
    
    const favoriteIcon = server.isFavorite ? '⭐ ' : '';
    
    this.description = `${favoriteIcon}${server.type === 'mwaa' ? 'MWAA' : 'Self-hosted'} ${healthIcon}`;
    this.tooltip = `${server.name}\n${server.baseUrl || server.awsRegion}\nAPI: ${server.apiMode}\nHealth: ${server.lastHealthStatus}${server.isFavorite ? '\n⭐ Favorite' : ''}`;
    
    const iconName = server.lastHealthStatus === 'healthy' ? 'pass' : 
                     server.lastHealthStatus === 'degraded' ? 'warning' : 
                     server.lastHealthStatus === 'down' ? 'error' : 'circle-outline';
    
    const iconColor = server.lastHealthStatus === 'healthy' ? new vscode.ThemeColor('testing.iconPassed') : 
                      server.lastHealthStatus === 'down' ? new vscode.ThemeColor('testing.iconFailed') : 
                      server.lastHealthStatus === 'degraded' ? new vscode.ThemeColor('testing.iconErrored') : undefined;
    
    this.iconPath = new vscode.ThemeIcon(iconName, iconColor);
  }
}

class DagsFolderItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile, isHidden: boolean = false) {
    super('DAGs', isHidden ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'dagsFolder';
    this.iconPath = new vscode.ThemeIcon(isHidden ? 'eye-closed' : 'folder');
    this.description = isHidden ? '(Hidden)' : '';
  }
}

class AdminFolderItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile) {
    super('Admin', vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'adminFolder';
    this.iconPath = new vscode.ThemeIcon('tools');
  }
}

class DagTreeItem extends vscode.TreeItem {
  constructor(public readonly dag: DagSummary, public readonly serverId: string, public readonly isFavorite: boolean = false) {
    super(dag.dagId, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'dag';
    
    const favoriteIcon = isFavorite ? '❤️ ' : '';
    this.description = favoriteIcon;
    this.tooltip = `${dag.dagId}\nStatus: ${dag.paused ? 'Paused' : 'Active'}\nOwner: ${dag.owner || 'N/A'}\nSchedule: ${dag.schedule || 'None'}\nTags: ${dag.tags?.join(', ') || 'None'}${isFavorite ? '\n❤️ Favorite' : ''}`;
    this.iconPath = new vscode.ThemeIcon(dag.paused ? 'debug-pause' : 'play');
    this.command = {
      command: 'airflow.openDagDetails',
      title: 'Open DAG Details',
      arguments: [{ dag: this.dag, serverId: this.serverId }]
    };
  }
}

class AdminItemTreeItem extends vscode.TreeItem {
  constructor(label: string, public readonly itemType: string, public readonly serverId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'adminItem';
    
    const iconMap: { [key: string]: string } = {
      'variables': 'symbol-variable',
      'pools': 'database',
      'connections': 'plug',
      'config': 'settings-gear',
      'plugins': 'extensions',
      'providers': 'package',
      'health': 'pulse'
    };
    
    this.iconPath = new vscode.ThemeIcon(iconMap[itemType] || 'circle-outline');
    
    const commandMap: { [key: string]: string } = {
      'variables': 'airflow.openVariablesPanel',
      'pools': 'airflow.openPoolsPanel',
      'connections': 'airflow.openConnectionsPanel',
      'config': 'airflow.openConfigPanel',
      'plugins': 'airflow.openPluginsPanel',
      'providers': 'airflow.openProvidersPanel',
      'health': 'airflow.openHealthCheck'
    };
    
    this.command = {
      command: commandMap[itemType],
      title: `Open ${label}`,
      arguments: [{ serverId: this.serverId }]
    };
  }
}

class NoServersItem extends vscode.TreeItem {
  constructor() {
    super('No servers configured', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'noServers';
    this.iconPath = new vscode.ThemeIcon('info');
    this.description = 'Click to add a server';
    this.tooltip = 'Add your first Airflow server to get started';
    this.command = {
      command: 'airflow.addServer',
      title: 'Add Server'
    };
  }
}
