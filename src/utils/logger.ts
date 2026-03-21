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

  private static log(level: string, message: string, ...args: any[]) {
    if (!this.outputChannel) {
      console.log(`[Airflow ${level}] ${message}`, ...args);
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + JSON.stringify(args) : '';
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
        message: error.message,
        stack: error.stack,
        name: error.name,
        ...error
      } : undefined;
      this.log('ERROR', message, errorDetails, ...args);
    }
  }

  static show() {
    this.outputChannel?.show();
  }
}
