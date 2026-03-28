import { IAirflowClient, ClearTaskOptions } from './IAirflowClient';
import { DagSummary, DagRun, TaskInstance, Variable, Pool, Connection, HealthStatus } from '../models';
import { MWAAClient, CreateWebLoginTokenCommand } from '@aws-sdk/client-mwaa';
import { fromIni, fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { AirflowStableClient } from './AirflowStableClient';
import { AirflowV2Client } from './AirflowV2Client';
import { Logger } from '../utils/logger';
import * as https from 'https';

export class MwaaClient implements IAirflowClient {
  private mwaaClient: MWAAClient;
  private environmentName: string;
  private apiVersion: 'v1' | 'v2';
  private delegateClient?: IAirflowClient;
  private webserverUrl?: string;
  private tokenExpiry?: number;

  constructor(environmentName: string, region: string, apiVersion: 'v1' | 'v2' = 'v1', awsProfile?: string) {
    this.environmentName = environmentName;
    this.apiVersion = apiVersion;
    
    // Use specified AWS profile or default credentials
    const clientConfig: any = { region };
    
    if (awsProfile) {
      Logger.debug('MwaaClient: Using AWS profile', { profile: awsProfile });
      // Use fromIni with explicit profile name and force cache refresh
      clientConfig.credentials = fromIni({
        profile: awsProfile,
        ignoreCache: true  // Force reload credentials from file
      });
    } else {
      Logger.debug('MwaaClient: Using default credential chain');
      // Use default credential provider chain
      clientConfig.credentials = fromNodeProviderChain();
    }
    
    this.mwaaClient = new MWAAClient(clientConfig);
    
    Logger.info('MwaaClient: Initialized', { environmentName, region, apiVersion, awsProfile: awsProfile || 'default' });
  }

  private async refreshToken(): Promise<void> {
    try {
      Logger.debug('MwaaClient.refreshToken: Starting', { apiVersion: this.apiVersion });
      
      // Step 1: Get AWS Web Login Token
      const command = new CreateWebLoginTokenCommand({ Name: this.environmentName });
      const response = await this.mwaaClient.send(command);
      
      this.webserverUrl = response.WebServerHostname || '';
      const webToken = response.WebToken || '';
      
      Logger.debug('MwaaClient.refreshToken: Got web token', { 
        webserverUrl: this.webserverUrl,
        tokenLength: webToken.length 
      });
      
      // Step 2: Exchange web token for session/JWT token via POST to MWAA login endpoint
      // MWAA provides custom login endpoints that return authentication tokens:
      // - Airflow 2.x (v1): POST to /aws_mwaa/login → returns 'session' cookie
      // - Airflow 3.x (v2): POST to /pluginsv2/aws_mwaa/login → returns '_token' JWT cookie
      // After authentication, standard Airflow API endpoints are used (/api/v1/* or /api/v2/*)
      const loginPath = this.apiVersion === 'v2' 
        ? '/pluginsv2/aws_mwaa/login' 
        : '/aws_mwaa/login';
      const loginData = new URLSearchParams({ token: webToken }).toString();
      
      Logger.debug('MwaaClient.refreshToken: Logging in to MWAA', { loginPath, apiVersion: this.apiVersion });
      
      // Use native HTTPS to avoid axios cookie compatibility issues
      const authToken = await new Promise<{ type: 'session' | 'jwt', value: string }>((resolve, reject) => {
        const req = https.request({
          hostname: this.webserverUrl,
          port: 443,
          path: loginPath,
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(loginData)
          }
        }, (res) => {
          const cookies = res.headers['set-cookie'] || [];
          
          if (this.apiVersion === 'v2') {
            // Airflow 3.x: Extract JWT token from _token cookie
            const tokenCookie = cookies.find(c => c.startsWith('_token='));
            if (tokenCookie) {
              const value = tokenCookie.split('=')[1]?.split(';')[0];
              Logger.debug('MwaaClient.refreshToken: JWT token obtained', { 
                tokenLength: value?.length 
              });
              resolve({ type: 'jwt', value });
            } else {
              reject(new Error('Failed to extract _token JWT cookie from MWAA v2 login response'));
            }
          } else {
            // Airflow 2.x: Extract session cookie
            const sessionCookie = cookies.find(c => c.startsWith('session='));
            if (sessionCookie) {
              const value = sessionCookie.split('=')[1]?.split(';')[0];
              Logger.debug('MwaaClient.refreshToken: Session cookie obtained', { 
                cookieLength: value?.length 
              });
              resolve({ type: 'session', value });
            } else {
              reject(new Error('Failed to extract session cookie from MWAA v1 login response'));
            }
          }
        });
        
        req.on('error', (error) => {
          Logger.error('MwaaClient.refreshToken: Login request failed', error);
          reject(error);
        });
        
        req.write(loginData);
        req.end();
      });
      
      // Step 3: Create standard Airflow client with MWAA authentication
      // Use NativeHttpClient instead of axios to avoid cookie/JWT compatibility issues
      // The clients use standard Airflow API endpoints (/api/v1/* or /api/v2/*)
      const baseURL = `https://${this.webserverUrl}`;
      
      if (authToken.type === 'jwt') {
        // Airflow 3.x: Use AirflowV2Client with JWT Bearer token
        const headers = {
          'Authorization': `Bearer ${authToken.value}`,
          'Content-Type': 'application/json'
        };
        this.delegateClient = await AirflowV2Client.create(baseURL, undefined, undefined, headers, true);
      } else {
        // Airflow 2.x: Use AirflowStableClient with session cookie
        const headers = {
          'Cookie': `session=${authToken.value}`
        };
        this.delegateClient = new AirflowStableClient(baseURL, undefined, undefined, headers, true);
      }
      
      // Cache token for 11 hours (MWAA tokens expire after 12 hours)
      this.tokenExpiry = Date.now() + (11 * 60 * 60 * 1000);
      
      Logger.info('MwaaClient.refreshToken: Success', { 
        apiVersion: this.apiVersion,
        authType: authToken.type,
        tokenExpiryHours: 11
      });
    } catch (error: any) {
      Logger.error('MwaaClient.refreshToken: Failed', error, { 
        environmentName: this.environmentName,
        apiVersion: this.apiVersion
      });
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
