import * as vscode from 'vscode';
import { Logger } from './logger';

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Convert any error to a user-friendly message
 */
export function getUserFriendlyError(error: any): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  // Handle HTTP errors
  if (error.status || error.statusCode) {
    const status = error.status || error.statusCode;
    switch (status) {
      case 400:
        return `Bad request: ${error.message || 'Invalid input'}`;
      case 401:
        return 'Authentication failed. Please check your credentials.';
      case 403:
        return 'Access denied. You do not have permission to perform this action.';
      case 404:
        return `Resource not found: ${error.message || 'The requested item does not exist'}`;
      case 408:
        return 'Request timeout. Please try again.';
      case 429:
        return 'Too many requests. Please wait a moment and try again.';
      case 500:
        return 'Server error. Please contact your Airflow administrator.';
      case 502:
      case 503:
      case 504:
        return 'Service temporarily unavailable. Please try again later.';
      default:
        return `Request failed (${status}): ${error.message || 'Unknown error'}`;
    }
  }

  // Handle network errors
  if (error.code === 'ECONNREFUSED') {
    return 'Connection refused. Please check if the server is running and the URL is correct.';
  }
  if (error.code === 'ENOTFOUND') {
    return 'Server not found. Please check the URL.';
  }
  if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
    return 'Connection timeout. Please check your network connection.';
  }
  if (error.code === 'ECONNRESET') {
    return 'Connection reset. Please try again.';
  }

  // Handle AWS SDK errors
  if (error.name === 'AccessDeniedException') {
    return 'AWS access denied. Please check your IAM permissions.';
  }
  if (error.name === 'UnrecognizedClientException' || error.name === 'InvalidClientTokenId') {
    return 'Invalid AWS credentials. Please check your AWS configuration.';
  }
  if (error.name === 'ExpiredTokenException') {
    return 'AWS credentials expired. Please refresh your credentials.';
  }

  // Handle validation errors
  if (error.name === 'ValidationError') {
    return `Validation error: ${error.message}`;
  }

  // Default to error message
  return error.message || error.toString() || 'An unexpected error occurred';
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  return fn().catch((error) => {
    Logger.error(`${context}: Error`, error);
    throw error;
  });
}

/**
 * Safe JSON parse with fallback
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json);
  } catch (error) {
    Logger.warn('safeJsonParse: Failed to parse JSON', { error });
    return fallback;
  }
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on authentication errors
      if (error.status === 401 || error.status === 403) {
        throw error;
      }
      
      // Don't retry on client errors (4xx except 408, 429)
      if (error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429) {
        throw error;
      }
      
      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        Logger.debug(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Centralized error handler for consistent error logging and user notifications
 */
export class ErrorHandler {
  static async handle(
    error: any,
    context: string,
    showUser: boolean = true,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    Logger.error(context, error, additionalContext);

    if (showUser) {
      const message = getUserFriendlyError(error);
      await vscode.window.showErrorMessage(`${context}: ${message}`);
    }
  }

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
}
