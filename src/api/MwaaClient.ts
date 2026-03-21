import { IAirflowClient, ClearTaskOptions } from './IAirflowClient';
import { DagSummary, DagRun, TaskInstance, Variable, Pool, Connection, HealthStatus } from '../models';
import { MWAAClient, CreateCliTokenCommand } from '@aws-sdk/client-mwaa';
import { HttpClient } from './HttpClient';

export class MwaaClient implements IAirflowClient {
  private mwaaClient: MWAAClient;
  private environmentName: string;
  private http?: HttpClient;
  private webserverUrl?: string;

  constructor(environmentName: string, region: string) {
    this.environmentName = environmentName;
    this.mwaaClient = new MWAAClient({ region });
  }

  private async getWebserverUrl(): Promise<string> {
    if (this.webserverUrl) return this.webserverUrl;
    
    // Get environment details and CLI token
    const command = new CreateCliTokenCommand({ Name: this.environmentName });
    const response = await this.mwaaClient.send(command);
    
    this.webserverUrl = response.WebServerHostname || '';
    const token = response.CliToken || '';
    
    this.http = new HttpClient(`https://${this.webserverUrl}`, {
      'Authorization': `Bearer ${token}`
    });
    
    return this.webserverUrl;
  }

  private async ensureClient(): Promise<HttpClient> {
    if (!this.http) {
      await this.getWebserverUrl();
    }
    return this.http!;
  }

  async listDags(): Promise<DagSummary[]> {
    const http = await this.ensureClient();
    const response = await http.get<any>('/api/v1/dags?limit=100');
    return response.dags.map((dag: any) => ({
      dagId: dag.dag_id,
      paused: dag.is_paused,
      schedule: dag.schedule_interval,
      owner: dag.owners?.[0] || 'unknown',
      tags: dag.tags?.map((t: any) => t.name) || []
    }));
  }

  async getDag(dagId: string): Promise<DagSummary> {
    const http = await this.ensureClient();
    const dag = await http.get<any>(`/api/v1/dags/${dagId}`);
    return {
      dagId: dag.dag_id,
      paused: dag.is_paused,
      schedule: dag.schedule_interval,
      owner: dag.owners?.[0] || 'unknown',
      tags: dag.tags?.map((t: any) => t.name) || []
    };
  }

  async pauseDag(dagId: string, paused: boolean): Promise<void> {
    const http = await this.ensureClient();
    await http.patch(`/api/v1/dags/${dagId}`, { is_paused: paused });
  }

  async deleteDag(dagId: string): Promise<void> {
    const http = await this.ensureClient();
    await http.delete(`/api/v1/dags/${dagId}`);
  }

  async getDagDetails(dagId: string): Promise<any> {
    const http = await this.ensureClient();
    const response = await http.get<any>(`/api/v1/dags/${dagId}/details`);
    return response;
  }

  async listDagRuns(dagId: string, limit: number = 25): Promise<DagRun[]> {
    const http = await this.ensureClient();
    const response = await http.get<any>(`/api/v1/dags/${dagId}/dagRuns?limit=${limit}`);
    return response.dag_runs.map((run: any) => ({
      dagRunId: run.dag_run_id,
      dagId: run.dag_id,
      state: run.state,
      executionDate: run.execution_date,
      startDate: run.start_date,
      endDate: run.end_date,
      conf: run.conf
    }));
  }

  async triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun> {
    const http = await this.ensureClient();
    const payload: any = {};
    if (conf) payload.conf = conf;
    if (logicalDate) payload.logical_date = logicalDate;
    
    const run = await http.post<any>(`/api/v1/dags/${dagId}/dagRuns`, payload);
    return {
      dagRunId: run.dag_run_id,
      dagId: run.dag_id,
      state: run.state,
      executionDate: run.execution_date,
      conf: run.conf
    };
  }

  async listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]> {
    const http = await this.ensureClient();
    const response = await http.get<any>(`/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`);
    return response.task_instances.map((task: any) => ({
      taskId: task.task_id,
      dagId: task.dag_id,
      dagRunId: task.dag_run_id,
      state: task.state,
      tryNumber: task.try_number,
      startDate: task.start_date,
      endDate: task.end_date,
      duration: task.duration,
      mapIndex: task.map_index
    }));
  }

  async getTaskLogs(dagId: string, taskId: string, dagRunId: string, tryNumber: number, mapIndex?: number): Promise<string> {
    const http = await this.ensureClient();
    let url = `/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${tryNumber}`;
    if (mapIndex !== undefined) {
      url += `?map_index=${mapIndex}`;
    }
    const response = await http.get<any>(url);
    return response.content || '';
  }

  async clearTaskInstances(dagId: string, dagRunId: string, taskIds: string[], options?: ClearTaskOptions): Promise<void> {
    const http = await this.ensureClient();
    await http.post(`/api/v1/dags/${dagId}/clearTaskInstances`, {
      dag_run_id: dagRunId,
      task_ids: taskIds,
      include_upstream: options?.includeUpstream,
      include_downstream: options?.includeDownstream,
      include_future: options?.includeFuture,
      only_failed: options?.onlyFailed
    });
  }

  async listVariables(): Promise<Variable[]> {
    const http = await this.ensureClient();
    const response = await http.get<any>('/api/v1/variables?limit=100');
    return response.variables.map((v: any) => ({
      key: v.key,
      value: v.value,
      description: v.description
    }));
  }

  async getVariable(key: string): Promise<Variable> {
    const http = await this.ensureClient();
    const v = await http.get<any>(`/api/v1/variables/${key}`);
    return { key: v.key, value: v.value, description: v.description };
  }

  async upsertVariable(key: string, value: string, description?: string): Promise<void> {
    const http = await this.ensureClient();
    await http.patch(`/api/v1/variables/${key}`, { value, description });
  }

  async deleteVariable(key: string): Promise<void> {
    const http = await this.ensureClient();
    await http.delete(`/api/v1/variables/${key}`);
  }

  async listPools(): Promise<Pool[]> {
    const http = await this.ensureClient();
    const response = await http.get<any>('/api/v1/pools?limit=100');
    return response.pools.map((p: any) => ({
      name: p.name,
      slots: p.slots,
      occupiedSlots: p.occupied_slots,
      runningSlots: p.running_slots,
      queuedSlots: p.queued_slots,
      description: p.description
    }));
  }

  async getPool(name: string): Promise<Pool> {
    const http = await this.ensureClient();
    const p = await http.get<any>(`/api/v1/pools/${name}`);
    return {
      name: p.name,
      slots: p.slots,
      occupiedSlots: p.occupied_slots,
      runningSlots: p.running_slots,
      queuedSlots: p.queued_slots,
      description: p.description
    };
  }

  async upsertPool(name: string, slots: number, description?: string): Promise<void> {
    const http = await this.ensureClient();
    await http.patch(`/api/v1/pools/${name}`, { slots, description });
  }

  async deletePool(name: string): Promise<void> {
    const http = await this.ensureClient();
    await http.delete(`/api/v1/pools/${name}`);
  }

  async listConnections(): Promise<Connection[]> {
    const http = await this.ensureClient();
    const response = await http.get<any>('/api/v1/connections?limit=100');
    return response.connections.map((c: any) => ({
      connectionId: c.connection_id,
      connType: c.conn_type,
      host: c.host,
      schema: c.schema,
      login: c.login,
      port: c.port,
      extra: c.extra
    }));
  }

  async getConnection(connectionId: string): Promise<Connection> {
    const http = await this.ensureClient();
    const c = await http.get<any>(`/api/v1/connections/${connectionId}`);
    return {
      connectionId: c.connection_id,
      connType: c.conn_type,
      host: c.host,
      schema: c.schema,
      login: c.login,
      port: c.port,
      extra: c.extra
    };
  }

  async upsertConnection(connection: Connection): Promise<void> {
    const http = await this.ensureClient();
    await http.patch(`/api/v1/connections/${connection.connectionId}`, {
      conn_type: connection.connType,
      host: connection.host,
      schema: connection.schema,
      login: connection.login,
      port: connection.port,
      extra: connection.extra
    });
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const http = await this.ensureClient();
    await http.delete(`/api/v1/connections/${connectionId}`);
  }

  async getHealth(): Promise<HealthStatus> {
    const http = await this.ensureClient();
    const health = await http.get<any>('/api/v1/health');
    return {
      metadatabase: { status: health.metadatabase?.status || 'unknown' },
      scheduler: { 
        status: health.scheduler?.status || 'unknown',
        latestHeartbeat: health.scheduler?.latest_scheduler_heartbeat
      },
      triggerer: health.triggerer ? { status: health.triggerer.status } : undefined,
      dagProcessor: health.dag_processor ? { status: health.dag_processor.status } : undefined
    };
  }

  async getDagStats(): Promise<any> {
    const http = await this.ensureClient();
    const response = await http.get<any>('/api/v1/dags?limit=100');
    const dags = response.dags || [];
    return { total: dags.length, active: dags.filter((d: any) => !d.is_paused).length, paused: dags.filter((d: any) => d.is_paused).length };
  }

  async getVersion(): Promise<string> {
    try {
      const http = await this.ensureClient();
      const response = await http.get<any>('/api/v1/version');
      return response.version || 'unknown';
    } catch { return 'unknown'; }
  }

  async getDagSource(dagId: string): Promise<string> {
    const http = await this.ensureClient();
    const response = await http.get<any>(`/api/v1/dagSources/${dagId}`);
    return response.content || '';
  }

  async setTaskInstanceState(dagId: string, dagRunId: string, taskId: string, state: string, mapIndex?: number): Promise<void> {
    const http = await this.ensureClient();
    const url = mapIndex !== undefined 
      ? `/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/${mapIndex}`
      : `/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`;
    await http.patch(url, { state });
  }

  async setDagRunState(dagId: string, dagRunId: string, state: string): Promise<void> {
    const http = await this.ensureClient();
    await http.patch(`/api/v1/dags/${dagId}/dagRuns/${dagRunId}`, { state });
  }
}
