import { Dag, DagData, DagState } from '../models/Dag';
import { IAirflowClient, ApiResponse } from '../interfaces/IAirflowClient';
import { Logger } from '../../infrastructure/logging/Logger';
import { EventBus, Events } from '../../shared/events/EventBus';

export class DagService {
  private logger = Logger.getInstance();
  private eventBus = EventBus.getInstance();

  constructor(private client: IAirflowClient) {}

  async loadDags(): Promise<Dag[]> {
    this.logger.info('Loading DAGs...');
    const response = await this.client.getDags();

    if (!response.success || !response.data) {
      this.logger.error('Failed to load DAGs', response.error);
      return [];
    }

    return response.data.map((data: DagData) => new Dag(data));
  }

  async triggerDag(dag: Dag, config?: string): Promise<boolean> {
    this.logger.info(`Triggering DAG: ${dag.id}`);

    if (dag.isPaused) {
      throw new Error('Cannot trigger a paused DAG');
    }

    if (dag.isRunning()) {
      throw new Error('DAG is already running');
    }

    const response = await this.client.triggerDag(dag.id, config);

    if (response.success && response.data) {
      const runId = response.data.dag_run_id;
      const state = response.data.state;
      dag.updateState(runId, state);
      this.eventBus.emit(Events.DAG_TRIGGERED, dag.id, runId);
      return true;
    }

    this.logger.error(`Failed to trigger DAG: ${dag.id}`, response.error);
    return false;
  }

  async pauseDag(dag: Dag): Promise<boolean> {
    this.logger.info(`Pausing DAG: ${dag.id}`);
    const response = await this.client.pauseDag(dag.id, true);

    if (response.success) {
      dag.setPaused(true);
      this.eventBus.emit(Events.DAG_PAUSED, dag.id);
      return true;
    }

    this.logger.error(`Failed to pause DAG: ${dag.id}`, response.error);
    return false;
  }

  async unpauseDag(dag: Dag): Promise<boolean> {
    this.logger.info(`Unpausing DAG: ${dag.id}`);
    const response = await this.client.pauseDag(dag.id, false);

    if (response.success) {
      dag.setPaused(false);
      this.eventBus.emit(Events.DAG_UNPAUSED, dag.id);
      return true;
    }

    this.logger.error(`Failed to unpause DAG: ${dag.id}`, response.error);
    return false;
  }

  async cancelDagRun(dag: Dag): Promise<boolean> {
    if (!dag.isRunning() || !dag.latestRunId) {
      throw new Error('No running DAG to cancel');
    }

    this.logger.info(`Cancelling DAG run: ${dag.id}/${dag.latestRunId}`);
    const response = await this.client.cancelDagRun(dag.id, dag.latestRunId);

    if (response.success) {
      dag.updateState(dag.latestRunId, 'failed');
      this.eventBus.emit(Events.DAG_RUN_CANCELLED, dag.id, dag.latestRunId);
      return true;
    }

    this.logger.error(`Failed to cancel DAG run: ${dag.id}`, response.error);
    return false;
  }

  async refreshDagState(dag: Dag): Promise<void> {
    if (!dag.isRunning() || !dag.latestRunId) {
      return;
    }

    const response = await this.client.getDagRun(dag.id, dag.latestRunId);

    if (response.success && response.data) {
      const newState = response.data.state as DagState;
      if (newState !== dag.latestState) {
        dag.updateState(dag.latestRunId, newState);
        this.eventBus.emit(Events.DAG_STATE_CHANGED, dag.id, newState);
      }
    }
  }

  async getDagLogs(dag: Dag): Promise<string> {
    this.logger.info(`Fetching logs for DAG: ${dag.id}`);
    
    const historyResponse = await this.client.getDagRunHistory(dag.id);
    if (!historyResponse.success || !historyResponse.data?.dag_runs?.length) {
      throw new Error('No DAG runs found');
    }

    const dagRunId = historyResponse.data.dag_runs[0].dag_run_id;
    const tasksResponse = await this.client.getTaskInstances(dag.id, dagRunId);

    if (!tasksResponse.success || !tasksResponse.data?.task_instances) {
      throw new Error('Failed to fetch task instances');
    }

    let logContent = '';
    for (const task of tasksResponse.data.task_instances) {
      const logResponse = await this.client.getTaskLog(
        dag.id,
        dagRunId,
        task.task_id,
        task.try_number
      );

      if (logResponse.success && logResponse.data) {
        logContent += `\n\n${'='.repeat(60)}\n`;
        logContent += `Task: ${task.task_id} (Try ${task.try_number})\n`;
        logContent += `${'='.repeat(60)}\n`;
        logContent += JSON.stringify(logResponse.data, null, 2);
      }
    }

    return logContent;
  }

  async getDagSourceCode(dag: Dag): Promise<string> {
    this.logger.info(`Fetching source code for DAG: ${dag.id}`);
    const response = await this.client.getSourceCode(dag.id, dag.fileToken);

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch source code');
    }

    return response.data;
  }

  async getDagInfo(dag: Dag): Promise<any> {
    this.logger.info(`Fetching info for DAG: ${dag.id}`);
    const response = await this.client.getDagInfo(dag.id);

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch DAG info');
    }

    return response.data;
  }
}
