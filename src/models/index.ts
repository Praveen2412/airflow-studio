export interface ServerProfile {
  id: string;
  name: string;
  type: 'self-hosted' | 'mwaa';
  baseUrl: string;
  awsRegion?: string;
  authBackend?: 'basic' | 'session' | 'jwt' | 'aws' | 'auto';  // Detected auth backend
  username?: string;
  apiMode: 'stable-v1' | 'stable-v2' | 'auto';
  defaultRefreshInterval: number;
  headers?: Record<string, string>;
  lastHealthStatus: 'unknown' | 'healthy' | 'degraded' | 'down';
  lastSyncedTimestamp?: number;
  isFavorite?: boolean;
  favoriteDags?: string[];
}

export interface DagSummary {
  dagId: string;
  paused: boolean;
  schedule: string | null;
  owner: string;
  tags: string[];
  lastRunState?: 'success' | 'failed' | 'running' | 'queued' | 'unknown';
  lastRunTime?: string;
  nextRunTime?: string;
}

export interface DagRun {
  dagRunId: string;
  dagId: string;
  state: string;
  executionDate: string;
  startDate?: string;
  endDate?: string;
  conf?: any;
}

export interface TaskInstance {
  taskId: string;
  dagId: string;
  dagRunId: string;
  state: 'success' | 'failed' | 'running' | 'queued' | 'skipped' | 'upstream_failed' | 'up_for_retry';
  tryNumber: number;
  startDate?: string;
  endDate?: string;
  duration?: number;
  mapIndex?: number;
}

export interface Variable {
  key: string;
  value: string;
  description?: string;
}

export interface Pool {
  name: string;
  slots: number;
  occupiedSlots: number;
  runningSlots: number;
  queuedSlots: number;
  description?: string;
}

export interface Connection {
  connectionId: string;
  connType: string;
  host?: string;
  schema?: string;
  login?: string;
  port?: number;
  extra?: string;
}

export interface HealthStatus {
  metadatabase: { status: string };
  scheduler: { status: string; latestHeartbeat?: string };
  triggerer?: { status: string };
  dagProcessor?: { status: string };
}
