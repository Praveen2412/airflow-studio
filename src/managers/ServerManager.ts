import * as vscode from 'vscode';
import { ServerProfile } from '../models';
import { IAirflowClient } from '../api/IAirflowClient';
import { AirflowClientFactory, AuthBackend, ApiVersion } from '../api/AirflowClientFactory';
import { Logger } from '../utils/logger';
import { Constants } from '../utils/constants';

export class ServerManager {
  private context: vscode.ExtensionContext;
  private activeServerId?: string;
  private clientCache: Map<string, { client: IAirflowClient; timestamp: number }> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.activeServerId = context.globalState.get<string>('airflow.activeServerId');
    Logger.debug('ServerManager: Initialized', { activeServerId: this.activeServerId });
  }

  async getServers(): Promise<ServerProfile[]> {
    const servers = this.context.globalState.get<ServerProfile[]>('airflow.servers', []);
    Logger.debug('ServerManager.getServers:', { count: servers.length });
    return servers;
  }

  async getActiveServer(): Promise<ServerProfile | undefined> {
    const servers = await this.getServers();
    const active = servers.find(s => s.id === this.activeServerId);
    Logger.debug('ServerManager.getActiveServer', { activeServerId: this.activeServerId, found: !!active });
    return active;
  }

  async setActiveServer(serverId: string): Promise<void> {
    this.activeServerId = serverId;
    await this.context.globalState.update('airflow.activeServerId', serverId);
    Logger.info('ServerManager.setActiveServer', { serverId });
  }

  async addServer(profile: ServerProfile, password?: string): Promise<void> {
    const servers = await this.getServers();
    
    // Auto-detect API version and auth backend
    if (profile.apiMode === 'auto' || !profile.authBackend || profile.authBackend === 'auto') {
      try {
        Logger.info('ServerManager.addServer: Auto-detecting API and auth', { name: profile.name });
        const result = await AirflowClientFactory.createClient(
          profile.baseUrl,
          profile.username,
          password,
          profile.headers,
          profile.type,
          profile.awsRegion,
          profile.type === 'mwaa' ? profile.baseUrl : undefined
        );
        
        profile.apiMode = result.apiVersion === 'v2' ? 'stable-v2' : 'stable-v1';
        profile.authBackend = result.authBackend;
        profile.lastHealthStatus = 'healthy';
        
        Logger.info('ServerManager.addServer: Detection successful', { 
          apiMode: profile.apiMode, 
          authBackend: profile.authBackend 
        });
      } catch (error: any) {
        Logger.error('ServerManager.addServer: Detection failed', error, { name: profile.name });
        throw new Error(`Failed to connect: ${error.message}`);
      }
    } else {
      // Use specified API mode and auth backend
      try {
        const client = await this.createClient(profile, password);
        await client.listDags(); // Test with authenticated endpoint
        profile.lastHealthStatus = 'healthy';
        Logger.info('ServerManager.addServer: Connection test passed', { name: profile.name });
      } catch (error: any) {
        Logger.error('ServerManager.addServer: Connection test failed', error, { name: profile.name });
        throw new Error(`Connection test failed: ${error.message}`);
      }
    }
    
    servers.push(profile);
    await this.context.globalState.update('airflow.servers', servers);
    
    if (password && profile.username) {
      await this.context.secrets.store(`airflow.password.${profile.id}`, password);
    }
  }

  private async detectApiVersion(profile: ServerProfile, password?: string): Promise<'stable-v1' | 'stable-v2'> {
    // This method is deprecated - use AirflowClientFactory instead
    try {
      const result = await AirflowClientFactory.createClient(
        profile.baseUrl,
        profile.username,
        password,
        profile.headers,
        profile.type,
        profile.awsRegion,
        profile.type === 'mwaa' ? profile.baseUrl : undefined
      );
      return result.apiVersion === 'v2' ? 'stable-v2' : 'stable-v1';
    } catch (error) {
      Logger.warn('ServerManager.detectApiVersion: Detection failed, defaulting to v1');
      return 'stable-v1';
    }
  }

  private async createClient(profile: ServerProfile, password?: string): Promise<IAirflowClient> {
    // If auth backend is known, use it directly (faster)
    if (profile.authBackend && profile.authBackend !== 'auto') {
      const apiVersion: ApiVersion = profile.apiMode === 'stable-v2' ? 'v2' : 'v1';
      return await AirflowClientFactory.createClientFromProfile(
        profile.baseUrl,
        apiVersion,
        profile.authBackend,
        profile.username,
        password,
        profile.headers,
        profile.type === 'mwaa' ? profile.baseUrl : undefined,
        profile.awsRegion
      );
    }

    // Otherwise, detect (should only happen on first connection)
    const result = await AirflowClientFactory.createClient(
      profile.baseUrl,
      profile.username,
      password,
      profile.headers,
      profile.type,
      profile.awsRegion,
      profile.type === 'mwaa' ? profile.baseUrl : undefined
    );

    // Update profile with detected values
    profile.apiMode = result.apiVersion === 'v2' ? 'stable-v2' : 'stable-v1';
    profile.authBackend = result.authBackend;
    await this.updateServer(profile, password);

    return result.client;
  }

  async updateServer(profile: ServerProfile, password?: string): Promise<void> {
    const servers = await this.getServers();
    const index = servers.findIndex(s => s.id === profile.id);
    if (index >= 0) {
      servers[index] = profile;
      await this.context.globalState.update('airflow.servers', servers);
      
      if (password && profile.username) {
        await this.context.secrets.store(`airflow.password.${profile.id}`, password);
      }
      
      // Clear cached client to force recreation with new settings
      this.clientCache.delete(profile.id);
    }
  }

  async deleteServer(serverId: string): Promise<void> {
    const servers = await this.getServers();
    const filtered = servers.filter(s => s.id !== serverId);
    await this.context.globalState.update('airflow.servers', filtered);
    await this.context.secrets.delete(`airflow.password.${serverId}`);
    
    // Clear cached client
    this.clientCache.delete(serverId);
    
    if (this.activeServerId === serverId) {
      this.activeServerId = undefined;
      await this.context.globalState.update('airflow.activeServerId', undefined);
    }
  }

  async getClient(serverId?: string): Promise<IAirflowClient | undefined> {
    Logger.debug('ServerManager.getClient: Starting', { serverId });
    const servers = await this.getServers();
    const server = serverId ? servers.find(s => s.id === serverId) : await this.getActiveServer();
    
    if (!server) {
      Logger.warn('ServerManager.getClient: No server found');
      return undefined;
    }

    // Check cache (cache for configured TTL)
    const cached = this.clientCache.get(server.id);
    if (cached && (Date.now() - cached.timestamp) < Constants.CLIENT_CACHE_TTL) {
      Logger.debug('ServerManager.getClient: Using cached client', { serverId: server.id });
      return cached.client;
    }

    Logger.debug('ServerManager.getClient: Creating new client', { 
      type: server.type, 
      name: server.name, 
      apiMode: server.apiMode, 
      hasUsername: !!server.username,
      username: server.username || 'none'
    });
    
    const password = server.username ? await this.context.secrets.get(`airflow.password.${server.id}`) : undefined;
    Logger.debug('ServerManager.getClient: Retrieved credentials from secret storage', { 
      hasUsername: !!server.username, 
      hasPassword: !!password,
      passwordLength: password?.length || 0,
      secretKey: `airflow.password.${server.id}`
    });
    
    const client = await this.createClient(server, password);
    
    // Cache the client
    this.clientCache.set(server.id, { client, timestamp: Date.now() });
    
    return client;
  }

  async testConnection(serverId: string): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('ServerManager.testConnection: Starting', { serverId });
      const client = await this.getClient(serverId);
      if (!client) {
        return { success: false, message: 'Server not found' };
      }
      
      // Test with authenticated endpoint (listDags requires auth)
      await client.listDags();
      Logger.info('ServerManager.testConnection: Success', { serverId });
      return { success: true, message: 'Connection and authentication successful' };
    } catch (error: any) {
      Logger.error('ServerManager.testConnection: Failed', error, { serverId });
      const message = error.status === 401 
        ? 'Authentication failed: Invalid credentials or unsupported auth backend'
        : error.message || 'Connection failed';
      return { success: false, message };
    }
  }
}
