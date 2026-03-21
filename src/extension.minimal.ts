import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
  console.log('=== MINIMAL AIRFLOW EXTENSION ACTIVATED ===');
  vscode.window.showInformationMessage('Airflow Extension Activated!');
  
  const outputChannel = vscode.window.createOutputChannel('Airflow Extension');
  outputChannel.appendLine('=== Extension Activated Successfully ===');
  outputChannel.show();
  
  context.subscriptions.push(outputChannel);
}

export function deactivate() {
  console.log('=== AIRFLOW EXTENSION DEACTIVATED ===');
}
