import * as vscode from 'vscode';

export class Logger {
  private static outputChannel: vscode.OutputChannel;
  private static logLevel: 'debug' | 'info' | 'warn' | 'error' = 'info'; // Changed default from 'debug' to 'info'

  static initialize(context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Airflow Studio');
    context.subscriptions.push(this.outputChannel);
    this.updateLogLevel();
    this.info('Logger initialized');
    
    // Watch for configuration changes
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('airflowStudio.verboseLogging')) {
          this.updateLogLevel();
        }
      })
    );
  }
  
  private static updateLogLevel() {
    const config = vscode.workspace.getConfiguration('airflowStudio');
    const verboseLogging = config.get<boolean>('verboseLogging', false);
    this.logLevel = verboseLogging ? 'debug' : 'info';
    this.info(`Log level set to: ${this.logLevel}`);
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
