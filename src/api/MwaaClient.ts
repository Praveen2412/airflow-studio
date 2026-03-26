import { IAirflowClient, ClearTaskOptions } from './IAirflowClient';
import { DagSummary, DagRun, TaskInstance, Variable, Pool, Connection, HealthStatus } from '../models';
import { MWAAClient, CreateWebLoginTokenCommand } from '@aws-sdk/client-mwaa';
import { HttpClient } from './HttpClient';
import { AirflowStableClient } from './AirflowStableClient';
import { AirflowV2Client } from './AirflowV2Client';
import { Logger } from '../utils/logger';
import axios from 'axios';

export class MwaaClient implements IAirflowClient {
  private mwaaClient: MWAAClient;
  private environmentName: string;
  private apiVersion: 'v1' | 'v2';
  private delegateClient?: IAirflowClient;
  private webserverUrl?: string;
  private tokenExpiry?: number;

  constructor(environmentName: string, region: string, apiVersion: 'v1' | 'v2' = 'v1') {
    this.environmentName = environmentName;
    this.apiVersion = apiVersion;
    this.mwaaClient = new MWAAClient({ region });
    Logger.info('MwaaClient: Initialized', { environmentName, region, apiVersion });
  }

  private async refreshToken(): Promise<void> {
    try {
      Logger.debug('MwaaClient.refreshToken: Starting', { apiVersion: this.apiVersion });
      
      // Step 1: Get AWS Web Login Token
      const command = new CreateWebLoginTokenCommand({ Name: this.environmentName });
      const response = await this.mwaaClient.send(command);
      
      this.webserverUrl = response.WebServerHostname || '';
      const webToken = response.WebToken || '';
      
      // Step 2: Exchange for JWT token via login endpoint
      const loginPath = this.apiVersion === 'v1' 
        ? '/aws_mwaa/login' 
        : '/pluginsv2/aws_mwaa/login';
      
      const loginResponse = await axios.get(`https://${this.webserverUrl}${loginPath}`, {
        params: { your_token_here: webToken },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      });
      
      // Step 3: Extract JWT token from _token cookie
      const cookies = loginResponse.headers['set-cookie'] || [];
      const jwtToken = cookies.find(c => c.startsWith('_token='))?.split('=')[1]?.split(';')[0];
      
      if (!jwtToken) {
        throw new Error('Failed to extract JWT token from MWAA login response');
      }
      
      // Step 4: Create delegate client (v1 or v2) with JWT token
      const baseUrl = `https://${this.webserverUrl}`;
      const headers = { 'Authorization': `Bearer ${jwtToken}` };
      
      if (this.apiVersion === 'v2') {
        this.delegateClient = await AirflowV2Client.create(baseUrl, undefined, undefined, headers);
        const httpClient = new HttpClient(baseUrl, headers);
        (this.delegateClient as any).http = httpClient;
      } else {
        this.delegateClient = new AirflowStableClient(baseUrl, undefined, undefined, headers);
        const httpClient = new HttpClient(baseUrl, headers);
        (this.delegateClient as any).http = httpClient;
      }
      
      // Cache token for 50 minutes (MWAA tokens typically valid for 60 minutes)
      this.tokenExpiry = Date.now() + (50 * 60 * 1000);
      
      Logger.info('MwaaClient.refreshToken: Success', { apiVersion: this.apiVersion });
    } catch (error: any) {
      Logger.error('MwaaClient.refreshToken: Failed', error, { environmentName: this.environmentName });
      throw error;
    }
  }

  private async ensureClient(): Promise<IAirflowClient> {
    if (!this.delegateClient || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
      await this.refreshToken();
    }
    return this.delegateClient!;
  }

  async listDags(): Promise<DagSummary[]> {
    const client = await this.ensureClient();
    return client.listDags();
  }

  async getDag(dagId: string): Promise<DagSummary> {
    const client = await this.ensureClient();
    return client.getDag(dagId);
  }

  async pauseDag(dagId: string, paused: boolean): Promise<void> {
    const client = await this.ensureClient();
    return client.pauseDag(dagId, paused);
  }

  async deleteDag(dagId: string): Promise<void> {
    const client = await this.ensureClient();
    return client.deleteDag(dagId);
  }

  async getDagDetails(dagId: string): Promise<any> {
    const client = await this.ensureClient();
    return client.getDagDetails(dagId);
  }

  async listDagRuns(dagId: string, limit: number = 25): Promise<DagRun[]> {
    const client = await this.ensureClient();
    return client.listDagRuns(dagId, limit);
  }

  async triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun> {
    const client = await this.ensureClient();
    return client.triggerDagRun(dagId, conf, logicalDate);
  }

  async listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]> {
    const client = await this.ensureClient();
    return client.listTaskInstances(dagId, dagRunId);
  }

  async getTaskLogs(dagId: string, taskId: string, dagRunId: string, tryNumber: number, mapIndex?: number): Promise<string> {
    const client = await this.ensureClient();
    return client.getTaskLogs(dagId, taskId, dagRunId, tryNumber, mapIndex);
  }

  async clearTaskInstances(dagId: string, dagRunId: string, taskIds: string[], options?: ClearTaskOptions): Promise<void> {
    const client = await this.ensureClient();
    return client.clearTaskInstances(dagId, dagRunId, taskIds, options);
  }

  async listVariables(): Promise<Variable[]> {
    const client = await this.ensureClient();
    return client.listVariables();
  }

  async getVariable(key: string): Promise<Variable> {
    const client = await this.ensureClient();
    return client.getVariable(key);
  }

  async upsertVariable(key: string, value: string, description?: string): Promise<void> {
    const client = await this.ensureClient();
    return client.upsertVariable(key, value, description);
  }

  async deleteVariable(key: string): Promise<void> {
    const client = await this.ensureClient();
    return client.deleteVariable(key);
  }

  async listPools(): Promise<Pool[]> {
    const client = await this.ensureClient();
    return client.listPools();
  }

  async getPool(name: string): Promise<Pool> {
    const client = await this.ensureClient();
    return client.getPool(name);
  }

  async upsertPool(name: string, slots: number, description?: string): Promise<void> {
    const client = await this.ensureClient();
    return client.upsertPool(name, slots, description);
  }

  async deletePool(name: string): Promise<void> {
    const client = await this.ensureClient();
    return client.deletePool(name);
  }

  async listConnections(): Promise<Connection[]> {
    const client = await this.ensureClient();
    return client.listConnections();
  }

  async getConnection(connectionId: string): Promise<Connection> {
    const client = await this.ensureClient();
    return client.getConnection(connectionId);
  }

  async upsertConnection(connection: Connection): Promise<void> {
    const client = await this.ensureClient();
    return client.upsertConnection(connection);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const client = await this.ensureClient();
    return client.deleteConnection(connectionId);
  }

  async getHealth(): Promise<HealthStatus> {
    const client = await this.ensureClient();
    return client.getHealth();
  }

  async getDagStats(): Promise<any> {
    const client = await this.ensureClient();
    return client.getDagStats();
  }

  async getVersion(): Promise<string> {
    const client = await this.ensureClient();
    return client.getVersion();
  }

  async getDagSource(dagId: string): Promise<string> {
    const client = await this.ensureClient();
    return client.getDagSource(dagId);
  }

  async setTaskInstanceState(dagId: string, dagRunId: string, taskId: string, state: string, mapIndex?: number): Promise<void> {
    const client = await this.ensureClient();
    return client.setTaskInstanceState(dagId, dagRunId, taskId, state, mapIndex);
  }

  async setDagRunState(dagId: string, dagRunId: string, state: string): Promise<void> {
    const client = await this.ensureClient();
    return client.setDagRunState(dagId, dagRunId, state);
  }

  async getRenderedTemplate(dagId: string, taskId: string, dagRunId: string, mapIndex?: number): Promise<any> {
    const client = await this.ensureClient();
    return client.getRenderedTemplate(dagId, taskId, dagRunId, mapIndex);
  }

  async getConfig(): Promise<any> {
    const client = await this.ensureClient();
    return client.getConfig();
  }

  async listPlugins(): Promise<any[]> {
    const client = await this.ensureClient();
    return client.listPlugins();
  }

  async listProviders(): Promise<any[]> {
    const client = await this.ensureClient();
    return client.listProviders();
  }
}
