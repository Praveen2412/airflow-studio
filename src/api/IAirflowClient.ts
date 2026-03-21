import { DagSummary, DagRun, TaskInstance, Variable, Pool, Connection, HealthStatus } from '../models';

export interface IAirflowClient {
  // DAG operations
  listDags(): Promise<DagSummary[]>;
  getDag(dagId: string): Promise<DagSummary>;
  pauseDag(dagId: string, paused: boolean): Promise<void>;
  deleteDag(dagId: string): Promise<void>;
  
  // DAG Run operations
  listDagRuns(dagId: string, limit?: number): Promise<DagRun[]>;
  triggerDagRun(dagId: string, conf?: any, logicalDate?: string): Promise<DagRun>;
  
  // Task operations
  listTaskInstances(dagId: string, dagRunId: string): Promise<TaskInstance[]>;
  getTaskLogs(dagId: string, taskId: string, dagRunId: string, tryNumber: number, mapIndex?: number): Promise<string>;
  clearTaskInstances(dagId: string, dagRunId: string, taskIds: string[], options?: ClearTaskOptions): Promise<void>;
  
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
  
  // Health
  getHealth(): Promise<HealthStatus>;
}

export interface ClearTaskOptions {
  includeUpstream?: boolean;
  includeDownstream?: boolean;
  includeFuture?: boolean;
  onlyFailed?: boolean;
}
