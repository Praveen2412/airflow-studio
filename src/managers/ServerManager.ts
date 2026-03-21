import * as vscode from 'vscode';
import { ServerProfile } from '../models';
import { IAirflowClient } from '../api/IAirflowClient';
import { AirflowStableClient } from '../api/AirflowStableClient';
import { AirflowV2Client } from '../api/AirflowV2Client';
import { MwaaClient } from '../api/MwaaClient';
import { Logger } from '../utils/logger';

export class ServerManager {
  private context: vscode.ExtensionContext;
  private activeServerId?: string;

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
    
    // Auto-detect API version
    if (profile.type === 'self-hosted' && profile.apiMode === 'auto') {
      profile.apiMode = await this.detectApiVersion(profile, password);
      Logger.info('ServerManager.addServer: API version detected', { apiMode: profile.apiMode });
    }
    
    // Test health and update status
    try {
      const client = await this.createClient(profile, password);
      await client.getHealth();
      profile.lastHealthStatus = 'healthy';
      Logger.info('ServerManager.addServer: Health check passed', { name: profile.name });
    } catch (error: any) {
      profile.lastHealthStatus = 'down';
      Logger.warn('ServerManager.addServer: Health check failed', { name: profile.name, error: error.message });
    }
    
    servers.push(profile);
    await this.context.globalState.update('airflow.servers', servers);
    
    if (password && profile.username) {
      await this.context.secrets.store(`airflow.password.${profile.id}`, password);
    }
  }

  private async detectApiVersion(profile: ServerProfile, password?: string): Promise<'stable-v1' | 'stable-v2'> {
    try {
      Logger.debug('ServerManager.detectApiVersion: Testing v2');
      const v2Client = await AirflowV2Client.create(profile.baseUrl, profile.username, password, profile.headers);
      await v2Client.getHealth();
      return 'stable-v2';
    } catch (error) {
      Logger.debug('ServerManager.detectApiVersion: v2 failed, trying v1');
      try {
        const v1Client = new AirflowStableClient(profile.baseUrl, profile.username, password, profile.headers);
        await v1Client.getHealth();
        return 'stable-v1';
      } catch (error2) {
        Logger.warn('ServerManager.detectApiVersion: Both versions failed, defaulting to v1');
        return 'stable-v1';
      }
    }
  }

  private async createClient(profile: ServerProfile, password?: string): Promise<IAirflowClient> {
    if (profile.type === 'mwaa') {
      return new MwaaClient(profile.baseUrl, profile.awsRegion || 'us-east-1');
    } else {
      if (profile.apiMode === 'stable-v2') {
        return await AirflowV2Client.create(profile.baseUrl, profile.username, password, profile.headers);
      } else {
        return new AirflowStableClient(profile.baseUrl, profile.username, password, profile.headers);
      }
    }
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
    }
  }

  async deleteServer(serverId: string): Promise<void> {
    const servers = await this.getServers();
    const filtered = servers.filter(s => s.id !== serverId);
    await this.context.globalState.update('airflow.servers', filtered);
    await this.context.secrets.delete(`airflow.password.${serverId}`);
    
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

    Logger.debug('ServerManager.getClient: Creating client', { type: server.type, name: server.name, apiMode: server.apiMode });
    
    const password = server.username ? await this.context.secrets.get(`airflow.password.${server.id}`) : undefined;
    return this.createClient(server, password);
  }

  async testConnection(serverId: string): Promise<{ success: boolean; message: string }> {
    try {
      Logger.info('ServerManager.testConnection: Starting', { serverId });
      const client = await this.getClient(serverId);
      if (!client) {
        return { success: false, message: 'Server not found' };
      }
      
      await client.getHealth();
      Logger.info('ServerManager.testConnection: Success', { serverId });
      return { success: true, message: 'Connection successful' };
    } catch (error: any) {
      Logger.error('ServerManager.testConnection: Failed', error, { serverId });
      return { success: false, message: error.message || 'Connection failed' };
    }
  }
}
