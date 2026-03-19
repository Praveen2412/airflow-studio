/* eslint-disable @typescript-eslint/naming-convention */
import { encode } from 'base-64';
import { exec } from 'child_process';
import { promisify } from 'util';
import { IAirflowClient, ApiResponse } from '../../core/interfaces/IAirflowClient';
import { ServerConfig } from '../../core/models/Server';
import { Logger } from '../logging/Logger';

const execAsync = promisify(exec);

const fetch = async (url: string, init?: any) => {
  const module = await import('node-fetch');
  return module.default(url, init);
};

export class AirflowApiClient implements IAirflowClient {
  private logger = Logger.getInstance();
  private jwtToken: string | undefined;
  private mwaaToken: string | undefined;
  private mwaaHostname: string | undefined;

  constructor(private config: ServerConfig) {}

  private get version(): 'v1' | 'v2' {
    if (this.config.type === 'mwaa') {
      return 'v2';
    }
    return this.config.apiUrl.includes('v1') ? 'v1' : 'v2';
  }

  private async getMWAAToken(): Promise<{ token: string; hostname: string } | undefined> {
    if (this.mwaaToken && this.mwaaHostname) {
      return { token: this.mwaaToken, hostname: this.mwaaHostname };
    }

    try {
      const profile = this.config.awsProfile ? `--profile ${this.config.awsProfile}` : '';
      const region = this.config.region || 'us-east-1';
      const envName = this.config.apiUrl;

      const command = `aws mwaa create-cli-token --name ${envName} --region ${region} ${profile}`;
      this.logger.debug(`Executing: ${command}`);

      const { stdout } = await execAsync(command);
      const result = JSON.parse(stdout) as any;

      if (result.CliToken && result.WebServerHostname) {
        this.mwaaToken = result.CliToken as string;
        this.mwaaHostname = result.WebServerHostname as string;
        return { token: this.mwaaToken, hostname: this.mwaaHostname };
      }

      return undefined;
    } catch (error) {
      this.logger.error('Failed to get MWAA token', error as Error);
      return undefined;
    }
  }

  private async getJwtToken(): Promise<string | undefined> {
    if (this.jwtToken) {
      return this.jwtToken;
    }

    try {
      const response = await fetch(this.config.apiUrl.replace('/api/v2', '') + '/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: this.config.apiUserName,
          password: this.config.apiPassword,
        }),
      });

      const result = (await response.json()) as any;
      if (response.status === 201 || response.status === 200) {
        this.jwtToken = result['access_token'];
        return this.jwtToken;
      }
    } catch (error) {
      this.logger.error('Failed to get JWT token', error as Error);
    }
    return undefined;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.type === 'mwaa') {
      const mwaaAuth = await this.getMWAAToken();
      if (mwaaAuth) {
        headers['Authorization'] = 'Bearer ' + mwaaAuth.token;
      }
    } else if (this.version === 'v1') {
      headers['Authorization'] =
        'Basic ' + encode(`${this.config.apiUserName}:${this.config.apiPassword}`);
    } else if (this.version === 'v2') {
      const token = await this.getJwtToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }
    }
    return headers;
  }

  private getBaseUrl(): string {
    if (this.config.type === 'mwaa' && this.mwaaHostname) {
      return `https://${this.mwaaHostname}/api/v2`;
    }
    return this.config.apiUrl;
  }

  async checkConnection(): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/dags?limit=1`, { method: 'GET', headers });
      return response.status === 200;
    } catch (error) {
      this.logger.error('Connection check failed', error as Error);
      return false;
    }
  }

  async getDags(): Promise<ApiResponse<any[]>> {
    const allDags: any[] = [];
    let offset = 0;
    const limit = 100;

    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();

      while (true) {
        const response = await fetch(`${baseUrl}/dags?limit=${limit}&offset=${offset}`, {
          method: 'GET',
          headers,
        });
        const data = (await response.json()) as any;

        if (response.status === 200) {
          allDags.push(...(data['dags'] as any[]));
          if (data['dags'].length < limit) {
            break;
          }
          offset += limit;
        } else {
          return { success: false, error: new Error(data.detail || 'Failed to fetch DAGs') };
        }
      }
      return { success: true, data: allDags };
    } catch (error) {
      this.logger.error('Failed to get DAGs', error as Error);
      return { success: false, error: error as Error };
    }
  }

  async triggerDag(dagId: string, config: string = '{}', date?: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      let body: any = { conf: JSON.parse(config) };

      if (this.version === 'v1' && date) {
        body.logical_date = date + 'T00:00:00Z';
      } else if (this.version === 'v2') {
        body.logical_date = date ? date + 'T00:00:00Z' : new Date().toISOString();
      }

      const response = await fetch(`${baseUrl}/dags/${dagId}/dagRuns`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as any;
      if (response.status === 200 || response.status === 201) {
        return { success: true, data };
      }
      return { success: false, error: new Error(data.detail || 'Failed to trigger DAG') };
    } catch (error) {
      this.logger.error(`Failed to trigger DAG: ${dagId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }

  async pauseDag(dagId: string, isPaused: boolean): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/dags/${dagId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ is_paused: isPaused }),
      });
      const data = (await response.json()) as any;

      if (response.status === 200) {
        return { success: true, data };
      }
      return { success: false, error: new Error(data.detail || 'Failed to pause DAG') };
    } catch (error) {
      this.logger.error(`Failed to pause DAG: ${dagId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }

  async getDagRun(dagId: string, dagRunId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/dags/${dagId}/dagRuns/${dagRunId}`, {
        method: 'GET',
        headers,
      });
      const data = (await response.json()) as any;

      if (response.status === 200) {
        return { success: true, data };
      }
      return { success: false, error: new Error(data.detail || 'Failed to get DAG run') };
    } catch (error) {
      this.logger.error(`Failed to get DAG run: ${dagId}/${dagRunId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }

  async getDagRunHistory(dagId: string, date?: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      let url = `${baseUrl}/dags/${dagId}/dagRuns?order_by=-execution_date`;

      if (date) {
        url += `&execution_date_gte=${date}T00:00:00Z`;
      }

      const response = await fetch(url, { method: 'GET', headers });
      const data = (await response.json()) as any;

      if (response.status === 200) {
        return { success: true, data };
      }
      return { success: false, error: new Error(data.detail || 'Failed to get DAG run history') };
    } catch (error) {
      this.logger.error(`Failed to get DAG run history: ${dagId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }

  async getTaskInstances(dagId: string, dagRunId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`, {
        method: 'GET',
        headers,
      });
      const data = (await response.json()) as any;

      if (response.status === 200) {
        return { success: true, data };
      }
      return { success: false, error: new Error(data.detail || 'Failed to get task instances') };
    } catch (error) {
      this.logger.error(`Failed to get task instances: ${dagId}/${dagRunId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }

  async getTaskLog(
    dagId: string,
    dagRunId: string,
    taskId: string,
    tryNumber: number
  ): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      const response = await fetch(
        `${baseUrl}/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${tryNumber}`,
        { method: 'GET', headers }
      );
      const data = (await response.json()) as any;

      if (response.status === 200) {
        return { success: true, data };
      }
      return { success: false, error: new Error(data.detail || 'Failed to get task log') };
    } catch (error) {
      this.logger.error(`Failed to get task log: ${dagId}/${dagRunId}/${taskId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }

  async getSourceCode(dagId: string, fileToken?: string): Promise<ApiResponse<string>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      let url = `${baseUrl}/dagSources/${dagId}`;

      if (this.version === 'v1' && fileToken) {
        url = `${baseUrl}/dagSources/${fileToken}`;
      }

      const response = await fetch(url, { method: 'GET', headers });
      const data = (await response.json()) as any;

      if (response.status === 200) {
        return { success: true, data: (data.content as string) || JSON.stringify(data, null, 2) };
      }
      return { success: false, error: new Error(data.detail || 'Failed to get source code') };
    } catch (error) {
      this.logger.error(`Failed to get source code: ${dagId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }

  async getDagInfo(dagId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/dags/${dagId}/details`, {
        method: 'GET',
        headers,
      });
      const data = (await response.json()) as any;

      if (response.status === 200) {
        return { success: true, data };
      }
      return { success: false, error: new Error(data.detail || 'Failed to get DAG info') };
    } catch (error) {
      this.logger.error(`Failed to get DAG info: ${dagId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }

  async cancelDagRun(dagId: string, dagRunId: string): Promise<ApiResponse<any>> {
    try {
      const headers = await this.getHeaders();
      const baseUrl = this.getBaseUrl();
      const response = await fetch(`${baseUrl}/dags/${dagId}/dagRuns/${dagRunId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ state: 'failed' }),
      });
      const data = (await response.json()) as any;

      if (response.status === 200) {
        return { success: true, data };
      }
      return { success: false, error: new Error(data.detail || 'Failed to cancel DAG run') };
    } catch (error) {
      this.logger.error(`Failed to cancel DAG run: ${dagId}/${dagRunId}`, error as Error);
      return { success: false, error: error as Error };
    }
  }
}
