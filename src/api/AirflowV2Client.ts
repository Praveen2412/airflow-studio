import { IAirflowClient, ClearTaskOptions } from './IAirflowClient';
import { HttpClient } from './HttpClient';
import { DagSummary, DagRun, TaskInstance, Variable, Pool, Connection, HealthStatus } from '../models';
import { Logger } from '../utils/logger';

export class AirflowV2Client implements IAirflowClient {
  private http: HttpClient;

  private constructor(baseUrl: string, headers?: Record<string, string>) {
    this.http = new HttpClient(baseUrl, headers);
    Logger.info('AirflowV2Client: Initialized');
  }

  static async create(baseUrl: string, username?: string, password?: string, headers?: Record<string, string>): Promise<AirflowV2Client> {
    const client = new AirflowV2Client(baseUrl, headers);
    if (username && password) {
      await client.http.setTokenAuth(username, password);
    }
    return client;
  }

  async listDags(): Promise<DagSummary[]> {
    try {
      const response = await this.http.get<any>('/api/v2/dags?limit=100');
      Logger.debug('AirflowV2Client.listDags: Success', { count: response.dags?.length });
      return response.dags.map((dag: any) => ({
        dagId: dag.dag_id,
        paused: dag.is_paused,
        schedule: dag.timetable_description || dag.timetable_summary || 'None',
        owner: dag.owners?.[0] || 'unknown',
        tags: dag.tags?.map((t: any) => typeof t === 'string' ? t : t.name) || [],
        lastRunState: dag.last_run_state || undefined
      }));
    } catch (error: any) {
      Logger.error('AirflowV2Client.listDags: Failed', error);
      throw error;
    }
  }

  async getDag(dagId: string): Promise<DagSummary> {
    try {
      const dag = await this.http.get<any>(`/api/v2/dags/${dagId}`);
      Logger.debug('AirflowV2Client.getDag: Success', { dagId });
      return {
        dagId: dag.dag_id,
        paused: dag.is_paused,
        schedule: dag.timetable_description || dag.timetable_summary || 'None',
        owner: dag.owners?.[0] || 'unknown',
        tags: dag.tags?.map((t: any) => typeof t === 'string' ? t : t.name) || []
      };
    } catch (error: any) {
      Logger.error('AirflowV2Client.getDag: Failed', error, { dagId });
      throw error;
    }
  }

  async pauseDag(dagId: string, paused: boolean): Promise<void> {
    try {
      await this.http.patch(`/api/v2/dags/${dagId}`, { is_paused: paused });
      Logger.info('AirflowV2Client.pauseDag: Success', { dagId, paused });
    } catch (error: any) {
      Logger.error('AirflowV2Client.pauseDag: Failed', error, { dagId, paused });
      throw error;
    }
  }

  async deleteDag(dagId: string): Promise<void> {
    try {
      await this.http.delete(`/api/v2/dags/${dagId}`);
      Logger.info('AirflowV2Client.deleteDag: Success', { dagId });
    } catch (error: any) {
      Logger.error('AirflowV2Client.deleteDag: Failed', error, { dagId });
      throw error;
    }
  }

  async getDagDetails(dagId: string): Promise<any> {
    try {
      const response = await this.http.get<any>(`/api/v2/dags/${dagId}/details`);
      Logger.debug('AirflowV2Client.getDagDetails: Success', { dagId });
      return response;
    } catch (error: any) {
      Logger.error('AirflowV2Client.getDagDetails: Failed', error, { dagId });
      throw error;
    }
  }

  async listDagRuns(dagId: string, limit: number = 25): Promise<DagRun[]> {
    try {
      const response = await this.http.get<any>(`/api/v2/dags/${dagId}/dagRuns?limit=${limit}`);
      Logger.debug('AirflowV2Client.listDagRuns: Success', { dagId, count: response.dag_runs?.length });
      return response.dag_runs.map((run: any) => ({
        dagRunId: run.dag_run_id,
        dagId: run.dag_id,
        state: run.state,
        executionDate: run.logical_date || run.execution_date,
        startDate: run.start_date,
        endDate: run.end_date,
        conf: run.conf
      }));
    } catch (error: any) {
      Logger.error('AirflowV2Client.listDagRuns: Failed', error, { dagId });
      throw error;
    }
  }

  async triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun> {
    try {
      const payload: any = {
        logical_date: logicalDate || new Date().toISOString()
      };
      if (conf) payload.conf = conf;
      
      const run = await this.http.post<any>(`/api/v2/dags/${dagId}/dagRuns`, payload);
      Logger.info('AirflowV2Client.triggerDagRun: Success', { dagId });
      return {
        dagRunId: run.dag_run_id,
        dagId: run.dag_id,
        state: run.state,
        executionDate: run.logical_date || run.execution_date,
        conf: run.conf
      };
    } catch (error: any) {
      Logger.error('AirflowV2Client.triggerDagRun: Failed', error, { dagId });
      throw error;
    }
  }

  async listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]> {
    try {
      const response = await this.http.get<any>(`/api/v2/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`);
      Logger.debug('AirflowV2Client.listTaskInstances: Success', { dagId, dagRunId });
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
    } catch (error: any) {
      Logger.error('AirflowV2Client.listTaskInstances: Failed', error, { dagId, dagRunId });
      throw error;
    }
  }

  async getTaskLogs(dagId: string, taskId: string, dagRunId: string, tryNumber: number, mapIndex?: number): Promise<string> {
    try {
      let url = `/api/v2/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${tryNumber}?full_content=true`;
      if (mapIndex !== undefined) url += `&map_index=${mapIndex}`;
      const response = await this.http.get<any>(url);
      Logger.debug('AirflowV2Client.getTaskLogs: Success', { dagId, taskId });
      return parseLogResponse(response);
    } catch (error: any) {
      Logger.error('AirflowV2Client.getTaskLogs: Failed', error, { dagId, taskId });
      throw error;
    }
  }

  async clearTaskInstances(dagId: string, dagRunId: string, taskIds: string[], options?: ClearTaskOptions): Promise<void> {
    try {
      await this.http.post(`/api/v2/dags/${dagId}/clearTaskInstances`, {
        dag_run_id: dagRunId,
        task_ids: taskIds,
        include_upstream: options?.includeUpstream,
        include_downstream: options?.includeDownstream,
        include_future: options?.includeFuture,
        only_failed: options?.onlyFailed
      });
      Logger.info('AirflowV2Client.clearTaskInstances: Success', { dagId, dagRunId });
    } catch (error: any) {
      Logger.error('AirflowV2Client.clearTaskInstances: Failed', error, { dagId, dagRunId });
      throw error;
    }
  }

  async listVariables(): Promise<Variable[]> {
    try {
      const response = await this.http.get<any>('/api/v2/variables?limit=100');
      Logger.debug('AirflowV2Client.listVariables: Success', { count: response.variables?.length });
      return response.variables.map((v: any) => ({
        key: v.key,
        value: v.value,
        description: v.description
      }));
    } catch (error: any) {
      Logger.error('AirflowV2Client.listVariables: Failed', error);
      throw error;
    }
  }

  async getVariable(key: string): Promise<Variable> {
    try {
      const v = await this.http.get<any>(`/api/v2/variables/${key}`);
      Logger.debug('AirflowV2Client.getVariable: Success', { key });
      return { key: v.key, value: v.value, description: v.description };
    } catch (error: any) {
      Logger.error('AirflowV2Client.getVariable: Failed', error, { key });
      throw error;
    }
  }

  async upsertVariable(key: string, value: string, description?: string): Promise<void> {
    try {
      // Try GET first to check if exists
      try {
        await this.http.get(`/api/v2/variables/${key}`);
        // Exists, update with PATCH
        await this.http.patch(`/api/v2/variables/${key}`, { key, value, description: description || '' });
      } catch (getError: any) {
        if (getError.status === 404) {
          // Doesn't exist, create with POST
          await this.http.post('/api/v2/variables', { key, value, description: description || '' });
        } else {
          throw getError;
        }
      }
      Logger.info('AirflowV2Client.upsertVariable: Success', { key });
    } catch (error: any) {
      Logger.error('AirflowV2Client.upsertVariable: Failed', error, { key });
      throw error;
    }
  }

  async deleteVariable(key: string): Promise<void> {
    try {
      await this.http.delete(`/api/v2/variables/${key}`);
      Logger.info('AirflowV2Client.deleteVariable: Success', { key });
    } catch (error: any) {
      Logger.error('AirflowV2Client.deleteVariable: Failed', error, { key });
      throw error;
    }
  }

  async listPools(): Promise<Pool[]> {
    try {
      const response = await this.http.get<any>('/api/v2/pools?limit=100');
      Logger.debug('AirflowV2Client.listPools: Success', { count: response.pools?.length });
      return response.pools.map((p: any) => ({
        name: p.name,
        slots: p.slots,
        occupiedSlots: p.occupied_slots,
        runningSlots: p.running_slots,
        queuedSlots: p.queued_slots,
        description: p.description
      }));
    } catch (error: any) {
      Logger.error('AirflowV2Client.listPools: Failed', error);
      throw error;
    }
  }

  async getPool(name: string): Promise<Pool> {
    try {
      const p = await this.http.get<any>(`/api/v2/pools/${name}`);
      Logger.debug('AirflowV2Client.getPool: Success', { name });
      return {
        name: p.name,
        slots: p.slots,
        occupiedSlots: p.occupied_slots,
        runningSlots: p.running_slots,
        queuedSlots: p.queued_slots,
        description: p.description
      };
    } catch (error: any) {
      Logger.error('AirflowV2Client.getPool: Failed', error, { name });
      throw error;
    }
  }

  async upsertPool(name: string, slots: number, description?: string): Promise<void> {
    try {
      // Try GET first to check if exists
      try {
        await this.http.get(`/api/v2/pools/${name}`);
        // Exists, update with PATCH - include_deferred is required in v2 API
        await this.http.patch(`/api/v2/pools/${name}`, { name, slots, description: description || '', include_deferred: false });
      } catch (getError: any) {
        if (getError.status === 404) {
          // Doesn't exist, create with POST
          await this.http.post('/api/v2/pools', { name, slots, description: description || '', include_deferred: false });
        } else {
          throw getError;
        }
      }
      Logger.info('AirflowV2Client.upsertPool: Success', { name });
    } catch (error: any) {
      Logger.error('AirflowV2Client.upsertPool: Failed', error, { name });
      throw error;
    }
  }

  async deletePool(name: string): Promise<void> {
    try {
      await this.http.delete(`/api/v2/pools/${name}`);
      Logger.info('AirflowV2Client.deletePool: Success', { name });
    } catch (error: any) {
      Logger.error('AirflowV2Client.deletePool: Failed', error, { name });
      throw error;
    }
  }

  async listConnections(): Promise<Connection[]> {
    try {
      const response = await this.http.get<any>('/api/v2/connections?limit=100');
      Logger.debug('AirflowV2Client.listConnections: Success', { count: response.connections?.length });
      return response.connections.map((c: any) => ({
        connectionId: c.connection_id,
        connType: c.conn_type,
        host: c.host,
        schema: c.schema,
        login: c.login,
        port: c.port,
        extra: c.extra
      }));
    } catch (error: any) {
      Logger.error('AirflowV2Client.listConnections: Failed', error);
      throw error;
    }
  }

  async getConnection(connectionId: string): Promise<Connection> {
    try {
      const c = await this.http.get<any>(`/api/v2/connections/${connectionId}`);
      Logger.debug('AirflowV2Client.getConnection: Success', { connectionId });
      return {
        connectionId: c.connection_id,
        connType: c.conn_type,
        host: c.host,
        schema: c.schema,
        login: c.login,
        port: c.port,
        extra: c.extra
      };
    } catch (error: any) {
      Logger.error('AirflowV2Client.getConnection: Failed', error, { connectionId });
      throw error;
    }
  }

  async upsertConnection(connection: Connection): Promise<void> {
    try {
      const payload = {
        connection_id: connection.connectionId,
        conn_type: connection.connType,
        host: connection.host,
        schema: connection.schema,
        login: connection.login,
        port: connection.port,
        extra: connection.extra
      };
      // Try GET first to check if exists
      try {
        await this.http.get(`/api/v2/connections/${connection.connectionId}`);
        // Exists, update with PATCH
        await this.http.patch(`/api/v2/connections/${connection.connectionId}`, payload);
      } catch (getError: any) {
        if (getError.status === 404) {
          // Doesn't exist, create with POST
          await this.http.post('/api/v2/connections', payload);
        } else {
          throw getError;
        }
      }
      Logger.info('AirflowV2Client.upsertConnection: Success', { connectionId: connection.connectionId });
    } catch (error: any) {
      Logger.error('AirflowV2Client.upsertConnection: Failed', error, { connectionId: connection.connectionId });
      throw error;
    }
  }

  async deleteConnection(connectionId: string): Promise<void> {
    try {
      await this.http.delete(`/api/v2/connections/${connectionId}`);
      Logger.info('AirflowV2Client.deleteConnection: Success', { connectionId });
    } catch (error: any) {
      Logger.error('AirflowV2Client.deleteConnection: Failed', error, { connectionId });
      throw error;
    }
  }

  async getHealth(): Promise<HealthStatus> {
    try {
      const health = await this.http.get<any>('/api/v2/monitor/health');
      Logger.debug('AirflowV2Client.getHealth: Success');
      return {
        metadatabase: { status: health.metadatabase?.status || 'unknown' },
        scheduler: { 
          status: health.scheduler?.status || 'unknown',
          latestHeartbeat: health.scheduler?.latest_scheduler_heartbeat
        },
        triggerer: health.triggerer ? { status: health.triggerer.status } : undefined,
        dagProcessor: health.dag_processor ? { status: health.dag_processor.status } : undefined
      };
    } catch (error: any) {
      Logger.error('AirflowV2Client.getHealth: Failed', error);
      throw error;
    }
  }

  async getDagSource(dagId: string): Promise<string> {
    try {
      const response = await this.http.get<any>(`/api/v2/dagSources/${dagId}`);
      Logger.debug('AirflowV2Client.getDagSource: Success', { dagId });
      return response.content || '';
    } catch (error: any) {
      Logger.error('AirflowV2Client.getDagSource: Failed', error, { dagId });
      throw error;
    }
  }

  async setTaskInstanceState(dagId: string, dagRunId: string, taskId: string, state: string, mapIndex?: number): Promise<void> {
    try {
      const url = mapIndex !== undefined 
        ? `/api/v2/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/${mapIndex}`
        : `/api/v2/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`;
      await this.http.patch(url, { state });
      Logger.info('AirflowV2Client.setTaskInstanceState: Success', { dagId, taskId, state });
    } catch (error: any) {
      Logger.error('AirflowV2Client.setTaskInstanceState: Failed', error, { dagId, taskId });
      throw error;
    }
  }

  async getDagStats(): Promise<any> {
    try {
      const response = await this.http.get<any>('/api/v2/dagStats');
      Logger.debug('AirflowV2Client.getDagStats: Success');
      // Aggregate stats across all dags
      let running = 0, queued = 0, success = 0, failed = 0;
      for (const dag of (response.dags || [])) {
        for (const s of (dag.stats || [])) {
          if (s.state === 'running') running += s.count;
          else if (s.state === 'queued') queued += s.count;
          else if (s.state === 'success') success += s.count;
          else if (s.state === 'failed') failed += s.count;
        }
      }
      return { running, queued, success, failed };
    } catch (error: any) {
      Logger.error('AirflowV2Client.getDagStats: Failed', error);
      return {};
    }
  }

  async getVersion(): Promise<string> {
    try {
      const response = await this.http.get<any>('/api/v2/version');
      return response.version || 'unknown';
    } catch (error: any) {
      Logger.error('AirflowV2Client.getVersion: Failed', error);
      return 'unknown';
    }
  }

  async setDagRunState(dagId: string, dagRunId: string, state: string): Promise<void> {
    try {
      await this.http.patch(`/api/v2/dags/${dagId}/dagRuns/${dagRunId}`, { state });
      Logger.info('AirflowV2Client.setDagRunState: Success', { dagId, dagRunId, state });
    } catch (error: any) {
      Logger.error('AirflowV2Client.setDagRunState: Failed', error, { dagId, dagRunId });
      throw error;
    }
  }
}

function parseLogResponse(response: any): string {
  if (!response) return '';
  if (typeof response === 'string') return response;
  if (response.content) {
    if (typeof response.content === 'string') return response.content;
    if (Array.isArray(response.content)) {
      return response.content.map((e: any) => {
        if (typeof e === 'string') return e;
        if (Array.isArray(e)) return e.join(' ');
        return e.message || e.content || JSON.stringify(e);
      }).join('\n');
    }
  }
  if (Array.isArray(response)) {
    return response.map((e: any) => {
      if (typeof e === 'string') return e;
      if (Array.isArray(e)) return e.join(' ');
      return e.message || e.content || JSON.stringify(e);
    }).join('\n');
  }
  return JSON.stringify(response, null, 2);
}
