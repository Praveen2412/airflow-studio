import * as vscode from 'vscode';
import { ServerProfile } from '../models';
import { IAirflowClient } from '../api/IAirflowClient';
import { AirflowStableClient } from '../api/AirflowStableClient';
import { MwaaClient } from '../api/MwaaClient';

export class ServerManager {
  private context: vscode.ExtensionContext;
  private activeServerId?: string;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async getServers(): Promise<ServerProfile[]> {
    return this.context.globalState.get<ServerProfile[]>('airflow.servers', []);
  }

  async getActiveServer(): Promise<ServerProfile | undefined> {
    const servers = await this.getServers();
    return servers.find(s => s.id === this.activeServerId);
  }

  async setActiveServer(serverId: string): Promise<void> {
    this.activeServerId = serverId;
    await this.context.globalState.update('airflow.activeServerId', serverId);
  }

  async addServer(profile: ServerProfile, password?: string): Promise<void> {
    const servers = await this.getServers();
    servers.push(profile);
    await this.context.globalState.update('airflow.servers', servers);
    
    if (password && profile.username) {
      await this.context.secrets.store(`airflow.password.${profile.id}`, password);
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
    const servers = await this.getServers();
    const server = serverId ? servers.find(s => s.id === serverId) : await this.getActiveServer();
    
    if (!server) return undefined;

    if (server.type === 'mwaa') {
      return new MwaaClient(server.baseUrl, server.awsRegion || 'us-east-1');
    } else {
      const password = server.username ? await this.context.secrets.get(`airflow.password.${server.id}`) : undefined;
      return new AirflowStableClient(server.baseUrl, server.username, password, server.headers);
    }
  }

  async testConnection(serverId: string): Promise<{ success: boolean; message: string }> {
    try {
      const client = await this.getClient(serverId);
      if (!client) {
        return { success: false, message: 'Server not found' };
      }
      
      await client.getHealth();
      return { success: true, message: 'Connection successful' };
    } catch (error: any) {
      return { success: false, message: error.message || 'Connection failed' };
    }
  }
}
