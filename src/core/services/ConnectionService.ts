import { Server, ServerConfig } from '../models/Server';
import { IAirflowClient } from '../interfaces/IAirflowClient';
import { IStateManager } from '../interfaces/IAirflowClient';
import { Logger } from '../../infrastructure/logging/Logger';
import { AirflowApiClient } from '../../infrastructure/api/AirflowApiClient';
import { EventBus, Events } from '../../shared/events/EventBus';

export class ConnectionService {
  private logger = Logger.getInstance();
  private eventBus = EventBus.getInstance();
  private currentServer: Server | undefined;
  private currentClient: IAirflowClient | undefined;
  private servers: Server[] = [];

  constructor(private stateManager: IStateManager) {
    this.loadState();
  }

  async addServer(config: ServerConfig): Promise<boolean> {
    const server = new Server(config);
    
    // Check if server already exists
    const exists = this.servers.some((s) => s.identifier === server.identifier);
    if (exists) {
      this.logger.warn(`Server already exists: ${server.displayName}`);
      return false;
    }

    // Test connection
    const client = new AirflowApiClient(config);
    const connected = await client.checkConnection();
    
    if (!connected) {
      this.logger.error(`Failed to connect to server: ${server.displayName}`);
      return false;
    }

    this.servers.push(server);
    await this.saveState();
    this.logger.info(`Server added: ${server.displayName}`);
    return true;
  }

  async removeServer(identifier: string): Promise<boolean> {
    const initialLength = this.servers.length;
    this.servers = this.servers.filter((s) => s.identifier !== identifier);
    
    if (this.servers.length < initialLength) {
      await this.saveState();
      this.logger.info(`Server removed: ${identifier}`);
      
      // If current server was removed, disconnect
      if (this.currentServer?.identifier === identifier) {
        this.disconnect();
      }
      return true;
    }
    return false;
  }

  async connectToServer(identifier: string): Promise<boolean> {
    const server = this.servers.find((s) => s.identifier === identifier);
    if (!server) {
      this.logger.error(`Server not found: ${identifier}`);
      return false;
    }

    const client = new AirflowApiClient(server.config);
    const connected = await client.checkConnection();
    
    if (!connected) {
      this.logger.error(`Failed to connect to server: ${server.displayName}`);
      return false;
    }

    this.currentServer = server;
    this.currentClient = client;
    await this.saveState();
    this.eventBus.emit(Events.SERVER_CONNECTED, server);
    this.logger.info(`Connected to server: ${server.displayName}`);
    return true;
  }

  disconnect(): void {
    if (this.currentServer) {
      this.logger.info(`Disconnected from server: ${this.currentServer.displayName}`);
      this.eventBus.emit(Events.SERVER_DISCONNECTED, this.currentServer);
    }
    this.currentServer = undefined;
    this.currentClient = undefined;
  }

  getCurrentServer(): Server | undefined {
    return this.currentServer;
  }

  getCurrentClient(): IAirflowClient | undefined {
    return this.currentClient;
  }

  getServers(): Server[] {
    return [...this.servers];
  }

  getServer(identifier: string): Server | undefined {
    return this.servers.find((s) => s.identifier === identifier);
  }

  isConnected(): boolean {
    return this.currentServer !== undefined && this.currentClient !== undefined;
  }

  private async saveState(): Promise<void> {
    try {
      await this.stateManager.set('servers', this.servers.map((s) => s.config));
      if (this.currentServer) {
        await this.stateManager.set('currentServer', this.currentServer.config);
      } else {
        await this.stateManager.clear('currentServer');
      }
    } catch (error) {
      this.logger.error('Failed to save connection state', error as Error);
    }
  }

  private loadState(): void {
    try {
      const serverConfigs = this.stateManager.get<ServerConfig[]>('servers') || [];
      this.servers = serverConfigs.map((config) => new Server(config));

      const currentConfig = this.stateManager.get<ServerConfig>('currentServer');
      if (currentConfig) {
        this.currentServer = new Server(currentConfig);
        this.currentClient = new AirflowApiClient(currentConfig);
      }

      this.logger.info(`Loaded ${this.servers.length} servers from state`);
    } catch (error) {
      this.logger.error('Failed to load connection state', error as Error);
    }
  }
}
