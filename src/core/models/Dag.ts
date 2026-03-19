export type DagState = 'queued' | 'running' | 'success' | 'failed' | 'upstream_failed' | 'skipped';

export interface DagData {
  dag_id: string;
  is_paused: boolean;
  is_active: boolean;
  fileloc: string;
  file_token?: string;
  owners: string[];
  description: string | null;
  tags: { name: string }[];
  schedule_interval?: any;
  timetable_description?: string;
}

export class Dag {
  public latestRunId: string = '';
  public latestState: DagState | '' = '';
  public isFavorite: boolean = false;

  constructor(private data: DagData) {}

  get id(): string {
    return this.data.dag_id;
  }

  get isPaused(): boolean {
    return this.data.is_paused;
  }

  get isActive(): boolean {
    return this.data.is_active;
  }

  get fileToken(): string {
    return this.data.file_token || '';
  }

  get owners(): string[] {
    return this.data.owners;
  }

  get tags(): string[] {
    return this.data.tags.map((t) => t.name);
  }

  get description(): string | null {
    return this.data.description;
  }

  isRunning(): boolean {
    return this.latestState === 'queued' || this.latestState === 'running';
  }

  matchesFilter(filter: string): boolean {
    const lowerFilter = filter.toLowerCase();
    return (
      this.id.toLowerCase().includes(lowerFilter) ||
      this.owners.some((o) => o.toLowerCase().includes(lowerFilter)) ||
      this.tags.some((t) => t.toLowerCase().includes(lowerFilter)) ||
      (this.isPaused ? 'paused' : 'active').includes(lowerFilter)
    );
  }

  updateState(runId: string, state: DagState | ''): void {
    this.latestRunId = runId;
    this.latestState = state;
  }

  setPaused(paused: boolean): void {
    this.data.is_paused = paused;
  }

  setFavorite(favorite: boolean): void {
    this.isFavorite = favorite;
  }
}
