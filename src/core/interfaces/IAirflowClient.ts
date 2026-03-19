import { ServerConfig } from '../models/Server';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: Error;
}

export interface IAirflowClient {
  checkConnection(): Promise<boolean>;
  getDags(): Promise<ApiResponse<any[]>>;
  triggerDag(dagId: string, config?: string, date?: string): Promise<ApiResponse<any>>;
  pauseDag(dagId: string, isPaused: boolean): Promise<ApiResponse<any>>;
  getDagRun(dagId: string, dagRunId: string): Promise<ApiResponse<any>>;
  getDagRunHistory(dagId: string, date?: string): Promise<ApiResponse<any>>;
  getTaskInstances(dagId: string, dagRunId: string): Promise<ApiResponse<any>>;
  getTaskLog(dagId: string, dagRunId: string, taskId: string, tryNumber: number): Promise<ApiResponse<any>>;
  getSourceCode(dagId: string, fileToken?: string): Promise<ApiResponse<string>>;
  getDagInfo(dagId: string): Promise<ApiResponse<any>>;
  cancelDagRun(dagId: string, dagRunId: string): Promise<ApiResponse<any>>;
}

export interface IStateManager {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): Promise<void>;
  clear(key: string): Promise<void>;
}
