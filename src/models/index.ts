export interface CodeConfig {
  // MWAA: S3 source
  s3Bucket?: string;       // e.g. "my-mwaa-bucket"
  s3Prefix?: string;       // e.g. "dags/"

  // Self-hosted local
  localDagsPath?: string;  // e.g. "/usr/local/airflow/dags"

  // Self-hosted remote (SSH)
  remoteHost?: string;
  remoteUser?: string;
  remoteDagsPath?: string; // e.g. "/opt/airflow/dags"
  remoteKeyPath?: string;  // e.g. "~/.ssh/id_rsa"

  // Common
  localWorkspacePath?: string; // local folder where files are synced to
}

export interface ServerProfile {
  id: string;
  name: string;
  type: 'self-hosted' | 'mwaa';
  baseUrl: string;
  awsRegion?: string;
  awsProfile?: string;  // AWS CLI profile name
  authBackend?: 'basic' | 'session' | 'jwt' | 'aws' | 'auto';  // Detected auth backend
  username?: string;
  apiMode: 'stable-v1' | 'stable-v2' | 'auto';
  defaultRefreshInterval: number;
  headers?: Record<string, string>;
  lastHealthStatus: 'unknown' | 'healthy' | 'degraded' | 'down';
  lastSyncedTimestamp?: number;
  isFavorite?: boolean;
  favoriteDags?: string[];
  codeConfig?: CodeConfig;
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
