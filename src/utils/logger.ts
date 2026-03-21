import * as vscode from 'vscode';

export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'debug';

  static initialize(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Airflow Extension');
    context.subscriptions.push(this.outputChannel);
    this.info('Logger initialized');
  }

  static setLogLevel(level: 'debug' | 'info' | 'warn' | 'error') {
    this.logLevel = level;
  }

  private static shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  private static safeStringify(obj: any): string {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    });
  }

  private static log(level: string, message: string, ...args: any[]) {
    if (!this.outputChannel) {
      console.log(`[Airflow ${level}] ${message}`, ...args);
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + this.safeStringify(args) : '';
    const logMessage = `[${timestamp}] [${level}] ${message}${formattedArgs}`;
    
    this.outputChannel.appendLine(logMessage);
    console.log(`[Airflow ${level}] ${message}`, ...args);
  }

  static debug(message: string, ...args: any[]) {
    if (this.shouldLog('debug')) {
      this.log('DEBUG', message, ...args);
    }
  }

  static info(message: string, ...args: any[]) {
    if (this.shouldLog('info')) {
      this.log('INFO', message, ...args);
    }
  }

  static warn(message: string, ...args: any[]) {
    if (this.shouldLog('warn')) {
      this.log('WARN', message, ...args);
    }
  }

  static error(message: string, error?: any, ...args: any[]) {
    if (this.shouldLog('error')) {
      const errorDetails = error ? {
        message: error.message || String(error),
        stack: error.stack,
        name: error.name,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText
      } : undefined;
      this.log('ERROR', message, errorDetails, ...args);
    }
  }

  static show() {
    this.outputChannel?.show();
  }
}
