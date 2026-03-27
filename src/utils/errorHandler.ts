import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Centralized error handler for consistent error logging and user notifications
 */
export class ErrorHandler {
  /**
   * Handle an error with logging and optional user notification
   * @param error The error object
   * @param context Context string describing where the error occurred
   * @param showUser Whether to show error message to user (default: true)
   * @param additionalContext Additional context data for logging
   */
  static async handle(
    error: any,
    context: string,
    showUser: boolean = true,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    // Log error with context
    Logger.error(context, error, additionalContext);

    // Show user-friendly message if requested
    if (showUser) {
      const message = this.getUserFriendlyMessage(error, context);
      await vscode.window.showErrorMessage(message);
    }
  }

  /**
   * Handle an error and return a result object (for non-throwing error handling)
   * @param error The error object
   * @param context Context string describing where the error occurred
   * @param showUser Whether to show error message to user (default: true)
   * @returns Result object with success=false and error message
   */
  static async handleWithResult(
    error: any,
    context: string,
    showUser: boolean = true,
    additionalContext?: Record<string, any>
  ): Promise<{ success: false; message: string }> {
    await this.handle(error, context, showUser, additionalContext);
    return {
      success: false,
      message: this.getErrorMessage(error)
    };
  }

  /**
   * Extract error message from various error types
   */
  private static getErrorMessage(error: any): string {
    if (typeof error === 'string') {
      return error;
    }

    if (error?.message) {
      return error.message;
    }

    if (error?.response?.data?.message) {
      return error.response.data.message;
    }

    if (error?.response?.data?.detail) {
      return error.response.data.detail;
    }

    if (error?.response?.statusText) {
      return `${error.response.status}: ${error.response.statusText}`;
    }

    return 'An unknown error occurred';
  }

  /**
   * Get user-friendly error message with context
   */
  private static getUserFriendlyMessage(error: any, context: string): string {
    const errorMsg = this.getErrorMessage(error);
    
    // Special handling for common error types
    if (error?.response?.status === 401) {
      return `Authentication failed: ${errorMsg}. Please check your credentials.`;
    }

    if (error?.response?.status === 403) {
      return `Access denied: ${errorMsg}. You may not have permission for this operation.`;
    }

    if (error?.response?.status === 404) {
      return `Not found: ${errorMsg}`;
    }

    if (error?.response?.status === 500) {
      return `Server error: ${errorMsg}. Please check Airflow server logs.`;
    }

    if (error?.code === 'ECONNREFUSED') {
      return `Connection refused: Cannot connect to Airflow server. Please check the server URL and ensure Airflow is running.`;
    }

    if (error?.code === 'ETIMEDOUT') {
      return `Connection timeout: Airflow server did not respond in time. Please check your network connection.`;
    }

    // Default message with context
    return `${context}: ${errorMsg}`;
  }

  /**
   * Wrap an async operation with error handling
   * @param operation The async operation to execute
   * @param context Context string for error messages
   * @param showUser Whether to show errors to user
   * @returns Result of operation or undefined on error
   */
  static async wrap<T>(
    operation: () => Promise<T>,
    context: string,
    showUser: boolean = true
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error: any) {
      await this.handle(error, context, showUser);
      return undefined;
    }
  }

  /**
   * Wrap an async operation with error handling and return result object
   * @param operation The async operation to execute
   * @param context Context string for error messages
   * @param showUser Whether to show errors to user
   * @returns Result object with success flag and data/message
   */
  static async wrapWithResult<T>(
    operation: () => Promise<T>,
    context: string,
    showUser: boolean = true
  ): Promise<{ success: true; data: T } | { success: false; message: string }> {
    try {
      const data = await operation();
      return { success: true, data };
    } catch (error: any) {
      return await this.handleWithResult(error, context, showUser);
    }
  }
}
