import * as vscode from 'vscode';
import { IStateManager } from '../../core/interfaces/IAirflowClient';
import { Logger } from '../logging/Logger';

export class StateManager implements IStateManager {
  private logger = Logger.getInstance();

  constructor(private context: vscode.ExtensionContext) {}

  get<T>(key: string): T | undefined {
    try {
      return this.context.globalState.get<T>(key);
    } catch (error) {
      this.logger.error(`Failed to get state for key: ${key}`, error as Error);
      return undefined;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await this.context.globalState.update(key, value);
      this.logger.debug(`State saved for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to save state for key: ${key}`, error as Error);
      throw error;
    }
  }

  async clear(key: string): Promise<void> {
    try {
      await this.context.globalState.update(key, undefined);
      this.logger.debug(`State cleared for key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to clear state for key: ${key}`, error as Error);
      throw error;
    }
  }
}
