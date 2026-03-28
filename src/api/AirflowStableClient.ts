import { IAirflowClient, ClearTaskOptions } from './IAirflowClient';
import { HttpClient } from './HttpClient';
import { NativeHttpClient } from './NativeHttpClient';
import { DagSummary, DagRun, TaskInstance, Variable, Pool, Connection, HealthStatus } from '../models';
import { Logger } from '../utils/logger';
import { Constants } from '../utils/constants';
import { parseLogResponse } from '../utils/logParser';

export class AirflowStableClient implements IAirflowClient {
  private http: HttpClient | NativeHttpClient;

  constructor(baseUrl: string, username?: string, password?: string, headers?: Record<string, string>, useNativeHttp?: boolean) {
    if (useNativeHttp) {
      // Use NativeHttpClient for MWAA cookie authentication
      this.http = new NativeHttpClient(baseUrl, headers);
      Logger.info('AirflowStableClient: Initialized (API v1) with NativeHttpClient', { 
        hasHeaders: !!headers
      });
    } else {
      // Use standard HttpClient for self-hosted
      this.http = new HttpClient(baseUrl, headers);
      if (username && password) {
        (this.http as HttpClient).setAuth(username, password);
        Logger.info('AirflowStableClient: Initialized (API v1) with Basic Auth', { 
          username, 
          hasPassword: !!password,
          passwordLength: password?.length || 0
        });
      } else {
        Logger.info('AirflowStableClient: Initialized (API v1) without auth', { 
          hasUsername: !!username, 
          hasPassword: !!password,
          username: username || 'none'
        });
      }
    }
  }

  async listDags(): Promise<DagSummary[]> {
    try {
      const response = await this.http.get<any>(`/api/v1/dags?limit=${Constants.DEFAULT_API_LIMIT}`);
      Logger.debug('AirflowStableClient.listDags: Success', { count: response.dags?.length });
      return response.dags.map((dag: any) => ({
      dagId: dag.dag_id,
      paused: dag.is_paused,
      schedule: this.formatSchedule(dag.schedule_interval, dag.timetable_description),
      owner: dag.owners?.[0] || 'unknown',
      tags: dag.tags?.map((t: any) => t.name) || [],
      lastRunState: dag.last_parsed_time ? 'unknown' : undefined
    }));
    } catch (error: any) {
      Logger.error('AirflowStableClient.listDags: Failed', error);
      throw error;
    }
  }

  private formatSchedule(scheduleInterval: any, timetableDescription?: string): string {
    // Handle Dataset schedules (objects)
    if (scheduleInterval && typeof scheduleInterval === 'object') {
      if (scheduleInterval.__type === 'Dataset') {
        return `Dataset: ${scheduleInterval.uri || 'unknown'}`;
      }
      if (Array.isArray(scheduleInterval)) {
        return `Datasets: ${scheduleInterval.length} dataset(s)`;
      }
      return timetableDescription || 'Dataset-based';
    }
    // Handle string schedules (cron, timedelta, etc.)
    return scheduleInterval || timetableDescription || 'None';
  }

  async getDag(dagId: string): Promise<DagSummary> {
    try {
      const dag = await this.http.get<any>(`/api/v1/dags/${dagId}`);
      Logger.debug('AirflowStableClient.getDag: Success', { dagId });
      return {
      dagId: dag.dag_id,
      paused: dag.is_paused,
      schedule: this.formatSchedule(dag.schedule_interval, dag.timetable_description),
      owner: dag.owners?.[0] || 'unknown',
      tags: dag.tags?.map((t: any) => t.name) || []
    };
    } catch (error: any) {
      Logger.error('AirflowStableClient.getDag: Failed', error, { dagId });
      throw error;
    }
  }

  async pauseDag(dagId: string, paused: boolean): Promise<void> {
    try {
      await this.http.patch(`/api/v1/dags/${dagId}`, { is_paused: paused });
      Logger.info('AirflowStableClient.pauseDag: Success', { dagId, paused });
    } catch (error: any) {
      Logger.error('AirflowStableClient.pauseDag: Failed', error, { dagId, paused });
      throw error;
    }
  }

  async deleteDag(dagId: string): Promise<void> {
    try {
      await this.http.delete(`/api/v1/dags/${dagId}`);
      Logger.info('AirflowStableClient.deleteDag: Success', { dagId });
    } catch (error: any) {
      Logger.error('AirflowStableClient.deleteDag: Failed', error, { dagId });
      throw error;
    }
  }

  async getDagDetails(dagId: string): Promise<any> {
    try {
      // Get DAG tasks structure - this works even when there are no runs
      const response = await this.http.get<any>(`/api/v1/dags/${dagId}/tasks`);
      Logger.debug('AirflowStableClient.getDagDetails: Success', { dagId, taskCount: response.tasks?.length });
      return { tasks: response.tasks || [] };
    } catch (error: any) {
      Logger.error('AirflowStableClient.getDagDetails: Failed', error, { dagId });
      throw error;
    }
  }

  async listDagRuns(dagId: string, limit: number = Constants.DEFAULT_DAG_RUN_LIMIT): Promise<DagRun[]> {
    try {
      const response = await this.http.get<any>(`/api/v1/dags/${dagId}/dagRuns?limit=${limit}`);
      Logger.debug('AirflowStableClient.listDagRuns: Success', { dagId, count: response.dag_runs?.length });
      return response.dag_runs.map((run: any) => ({
        dagRunId: run.dag_run_id,
        dagId: run.dag_id,
        state: run.state,
        executionDate: run.execution_date,
        startDate: run.start_date,
        endDate: run.end_date,
        conf: run.conf
      }));
    } catch (error: any) {
      Logger.error('AirflowStableClient.listDagRuns: Failed', error, { dagId });
      throw error;
    }
  }

  async triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun> {
    try {
      const payload: any = {};
      if (conf) payload.conf = conf;
      if (logicalDate) payload.logical_date = logicalDate;
      
      const run = await this.http.post<any>(`/api/v1/dags/${dagId}/dagRuns`, payload);
      Logger.info('AirflowStableClient.triggerDagRun: Success', { dagId });
    return {
      dagRunId: run.dag_run_id,
      dagId: run.dag_id,
      state: run.state,
      executionDate: run.execution_date,
      conf: run.conf
    };
    } catch (error: any) {
      Logger.error('AirflowStableClient.triggerDagRun: Failed', error, { dagId });
      throw error;
    }
  }

  async listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]> {
    try {
      const response = await this.http.get<any>(`/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances`);
      Logger.debug('AirflowStableClient.listTaskInstances: Success', { dagId, dagRunId });
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
      Logger.error('AirflowStableClient.listTaskInstances: Failed', error, { dagId, dagRunId });
      throw error;
    }
  }

  async getTaskLogs(dagId: string, taskId: string, dagRunId: string, tryNumber: number, mapIndex?: number): Promise<string> {
    try {
      let url = `/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/logs/${tryNumber}`;
      if (mapIndex !== undefined) url += `?map_index=${mapIndex}`;
      const response = await this.http.get<any>(url);
      Logger.debug('AirflowStableClient.getTaskLogs: Success', { dagId, taskId });
      return parseLogResponse(response);
    } catch (error: any) {
      Logger.error('AirflowStableClient.getTaskLogs: Failed', error, { dagId, taskId });
      throw error;
    }
  }

  async clearTaskInstances(dagId: string, dagRunId: string, taskIds: string[], options?: ClearTaskOptions): Promise<void> {
    try {
      await this.http.post(`/api/v1/dags/${dagId}/clearTaskInstances`, {
        dag_run_id: dagRunId,
        task_ids: taskIds,
        dry_run: false,
        reset_dag_runs: true,  // Set DAG run state to RUNNING so tasks can be re-executed
        include_upstream: options?.includeUpstream ?? false,
        include_downstream: options?.includeDownstream ?? false,
        include_future: options?.includeFuture ?? false,
        only_failed: options?.onlyFailed ?? false
      });
      Logger.info('AirflowStableClient.clearTaskInstances: Success', { dagId, dagRunId });
    } catch (error: any) {
      Logger.error('AirflowStableClient.clearTaskInstances: Failed', error, { dagId, dagRunId });
      throw error;
    }
  }

  async listVariables(): Promise<Variable[]> {
    try {
      const response = await this.http.get<any>(`/api/v1/variables?limit=${Constants.DEFAULT_API_LIMIT}`);
      Logger.debug('AirflowStableClient.listVariables: Success', { count: response.variables?.length });
      return response.variables.map((v: any) => ({
        key: v.key,
        value: v.value,
        description: v.description
      }));
    } catch (error: any) {
      Logger.error('AirflowStableClient.listVariables: Failed', error);
      throw error;
    }
  }

  async getVariable(key: string): Promise<Variable> {
    try {
      const v = await this.http.get<any>(`/api/v1/variables/${key}`);
      Logger.debug('AirflowStableClient.getVariable: Success', { key });
      return { key: v.key, value: v.value, description: v.description };
    } catch (error: any) {
      Logger.error('AirflowStableClient.getVariable: Failed', error, { key });
      throw error;
    }
  }

  async upsertVariable(key: string, value: string, description?: string): Promise<void> {
    try {
      try {
        // API v1 PATCH requires all fields including 'key'
        await this.http.patch(`/api/v1/variables/${key}`, { key, value, description });
      } catch (patchError: any) {
        if (patchError.status === 404) {
          await this.http.post('/api/v1/variables', { key, value, description });
        } else {
          throw patchError;
        }
      }
      Logger.info('AirflowStableClient.upsertVariable: Success', { key });
    } catch (error: any) {
      Logger.error('AirflowStableClient.upsertVariable: Failed', error, { key });
      throw error;
    }
  }

  async deleteVariable(key: string): Promise<void> {
    try {
      await this.http.delete(`/api/v1/variables/${key}`);
      Logger.info('AirflowStableClient.deleteVariable: Success', { key });
    } catch (error: any) {
      Logger.error('AirflowStableClient.deleteVariable: Failed', error, { key });
      throw error;
    }
  }

  async listPools(): Promise<Pool[]> {
    try {
      const response = await this.http.get<any>(`/api/v1/pools?limit=${Constants.DEFAULT_API_LIMIT}`);
      Logger.debug('AirflowStableClient.listPools: Success', { count: response.pools?.length });
      return response.pools.map((p: any) => ({
        name: p.name,
        slots: p.slots,
        occupiedSlots: p.occupied_slots,
        runningSlots: p.running_slots,
        queuedSlots: p.queued_slots,
        description: p.description
      }));
    } catch (error: any) {
      Logger.error('AirflowStableClient.listPools: Failed', error);
      throw error;
    }
  }

  async getPool(name: string): Promise<Pool> {
    try {
      const p = await this.http.get<any>(`/api/v1/pools/${name}`);
      Logger.debug('AirflowStableClient.getPool: Success', { name });
      return {
        name: p.name,
        slots: p.slots,
        occupiedSlots: p.occupied_slots,
        runningSlots: p.running_slots,
        queuedSlots: p.queued_slots,
        description: p.description
      };
    } catch (error: any) {
      Logger.error('AirflowStableClient.getPool: Failed', error, { name });
      throw error;
    }
  }

  async upsertPool(name: string, slots: number, description?: string): Promise<void> {
    try {
      try {
        // API v1 PATCH requires all fields including 'name'
        await this.http.patch(`/api/v1/pools/${name}`, { name, slots, description });
      } catch (patchError: any) {
        if (patchError.status === 404) {
          await this.http.post('/api/v1/pools', { name, slots, description });
        } else {
          throw patchError;
        }
      }
      Logger.info('AirflowStableClient.upsertPool: Success', { name });
    } catch (error: any) {
      Logger.error('AirflowStableClient.upsertPool: Failed', error, { name });
      throw error;
    }
  }

  async deletePool(name: string): Promise<void> {
    try {
      await this.http.delete(`/api/v1/pools/${name}`);
      Logger.info('AirflowStableClient.deletePool: Success', { name });
    } catch (error: any) {
      Logger.error('AirflowStableClient.deletePool: Failed', error, { name });
      throw error;
    }
  }

  async listConnections(): Promise<Connection[]> {
    try {
      const response = await this.http.get<any>(`/api/v1/connections?limit=${Constants.DEFAULT_API_LIMIT}`);
      Logger.debug('AirflowStableClient.listConnections: Success', { count: response.connections?.length });
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
      Logger.error('AirflowStableClient.listConnections: Failed', error);
      throw error;
    }
  }

  async getConnection(connectionId: string): Promise<Connection> {
    try {
      const c = await this.http.get<any>(`/api/v1/connections/${connectionId}`);
      Logger.debug('AirflowStableClient.getConnection: Success', { connectionId });
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
      Logger.error('AirflowStableClient.getConnection: Failed', error, { connectionId });
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
      try {
        await this.http.patch(`/api/v1/connections/${connection.connectionId}`, payload);
      } catch (patchError: any) {
        if (patchError.status === 404) {
          await this.http.post('/api/v1/connections', payload);
        } else {
          throw patchError;
        }
      }
      Logger.info('AirflowStableClient.upsertConnection: Success', { connectionId: connection.connectionId });
    } catch (error: any) {
      Logger.error('AirflowStableClient.upsertConnection: Failed', error, { connectionId: connection.connectionId });
      throw error;
    }
  }

  async deleteConnection(connectionId: string): Promise<void> {
    try {
      await this.http.delete(`/api/v1/connections/${connectionId}`);
      Logger.info('AirflowStableClient.deleteConnection: Success', { connectionId });
    } catch (error: any) {
      Logger.error('AirflowStableClient.deleteConnection: Failed', error, { connectionId });
      throw error;
    }
  }

  async getHealth(): Promise<HealthStatus> {
    try {
      const health = await this.http.get<any>('/api/v1/health');
      Logger.debug('AirflowStableClient.getHealth: Success');
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
      Logger.error('AirflowStableClient.getHealth: Failed', error);
      throw error;
    }
  }

  async getDagStats(): Promise<any> {
    try {
      const response = await this.http.get<any>(`/api/v1/dags?limit=${Constants.DEFAULT_API_LIMIT}`);
      // v1 has no dagStats endpoint - compute from dag list
      const dags = response.dags || [];
      return { total: dags.length, active: dags.filter((d: any) => !d.is_paused).length, paused: dags.filter((d: any) => d.is_paused).length };
    } catch (error: any) {
      Logger.error('AirflowStableClient.getDagStats: Failed', error);
      throw error;
    }
  }

  async getVersion(): Promise<string> {
    try {
      const response = await this.http.get<any>('/api/v1/version');
      return response.version || 'unknown';
    } catch (error: any) {
      Logger.error('AirflowStableClient.getVersion: Failed', error);
      return 'unknown';
    }
  }

  async getDagSource(dagId: string): Promise<string> {
    try {
      // First get the file_token from dag details
      const dag = await this.http.get<any>(`/api/v1/dags/${dagId}`);
      const fileToken = dag.file_token;
      if (!fileToken) throw new Error('No file_token available for this DAG');
      // dagSources endpoint requires Accept: text/plain header
      const response = await this.http.get<any>(`/api/v1/dagSources/${fileToken}`, { headers: { 'Accept': 'text/plain' } });
      Logger.debug('AirflowStableClient.getDagSource: Success', { dagId });
      if (typeof response === 'string') return response;
      return response.content || '';
    } catch (error: any) {
      Logger.error('AirflowStableClient.getDagSource: Failed', error, { dagId });
      throw error;
    }
  }

  async setTaskInstanceState(dagId: string, dagRunId: string, taskId: string, state: string, mapIndex?: number): Promise<void> {
    try {
      const url = mapIndex !== undefined 
        ? `/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}/${mapIndex}`
        : `/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`;
      // API v1 requires dry_run: false to actually change the state (defaults to true)
      await this.http.patch(url, { dry_run: false, new_state: state });
      Logger.info('AirflowStableClient.setTaskInstanceState: Success', { dagId, taskId, state });
    } catch (error: any) {
      Logger.error('AirflowStableClient.setTaskInstanceState: Failed', error, { dagId, taskId });
      throw error;
    }
  }

  async setDagRunState(dagId: string, dagRunId: string, state: string): Promise<void> {
    try {
      await this.http.patch(`/api/v1/dags/${dagId}/dagRuns/${dagRunId}`, { state });
      Logger.info('AirflowStableClient.setDagRunState: Success', { dagId, dagRunId, state });
    } catch (error: any) {
      Logger.error('AirflowStableClient.setDagRunState: Failed', error, { dagId, dagRunId });
      throw error;
    }
  }

  async getRenderedTemplate(dagId: string, taskId: string, dagRunId: string, mapIndex?: number): Promise<any> {
    throw new Error('Rendered templates not supported in Airflow API v1');
  }

  async getConfig(): Promise<any> {
    try {
      const response = await this.http.get<any>('/api/v1/config');
      return response;
    } catch (error: any) {
      Logger.error('AirflowStableClient.getConfig: Failed', error);
      throw error;
    }
  }

  async listPlugins(): Promise<any[]> {
    try {
      const response = await this.http.get<any>('/api/v1/plugins');
      return response.plugins || [];
    } catch (error: any) {
      Logger.error('AirflowStableClient.listPlugins: Failed', error);
      throw error;
    }
  }

  async listProviders(): Promise<any[]> {
    throw new Error('Providers endpoint not available in Airflow API v1');
  }
}
