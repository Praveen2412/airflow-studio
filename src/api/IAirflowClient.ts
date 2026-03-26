import { DagSummary, DagRun, TaskInstance, Variable, Pool, Connection, HealthStatus } from '../models';

export interface IAirflowClient {
  // DAG operations
  listDags(): Promise<DagSummary[]>;
  getDag(dagId: string): Promise<DagSummary>;
  pauseDag(dagId: string, paused: boolean): Promise<void>;
  deleteDag(dagId: string): Promise<void>;
  getDagDetails(dagId: string): Promise<any>;
  setDagRunState(dagId: string, dagRunId: string, state: string): Promise<void>;
  
  // DAG Run operations
  listDagRuns(dagId: string, limit?: number): Promise<DagRun[]>;
  triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun>;
  
  // Task operations
  listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]>;
  getTaskLogs(dagId: string, taskId: string, dagRunId: string, tryNumber: number, mapIndex?: number): Promise<string>;
  getRenderedTemplate(dagId: string, taskId: string, dagRunId: string, mapIndex?: number): Promise<any>;
  clearTaskInstances(dagId: string, dagRunId: string, taskIds: string[], options?: ClearTaskOptions): Promise<void>;
  setTaskInstanceState(dagId: string, dagRunId: string, taskId: string, state: string, mapIndex?: number): Promise<void>;
  
  // Variables
  listVariables(): Promise<Variable[]>;
  getVariable(key: string): Promise<Variable>;
  upsertVariable(key: string, value: string, description?: string): Promise<void>;
  deleteVariable(key: string): Promise<void>;
  
  // Pools
  listPools(): Promise<Pool[]>;
  getPool(name: string): Promise<Pool>;
  upsertPool(name: string, slots: number, description?: string): Promise<void>;
  deletePool(name: string): Promise<void>;
  
  // Connections
  listConnections(): Promise<Connection[]>;
  getConnection(connectionId: string): Promise<Connection>;
  upsertConnection(connection: Connection): Promise<void>;
  deleteConnection(connectionId: string): Promise<void>;
  
  // Config & Info
  getHealth(): Promise<HealthStatus>;
  getDagStats(): Promise<any>;
  getVersion(): Promise<string>;
  getConfig(): Promise<any>;
  listPlugins(): Promise<any[]>;
  listProviders(): Promise<any[]>;
  
  // DAG Source
  getDagSource(dagId: string): Promise<string>;
}

export interface ClearTaskOptions {
  includeUpstream?: boolean;
  includeDownstream?: boolean;
  includeFuture?: boolean;
  onlyFailed?: boolean;
}
