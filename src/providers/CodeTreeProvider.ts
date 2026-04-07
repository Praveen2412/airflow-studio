import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ServerProfile } from '../models';
import { CodeSyncManager } from '../managers/CodeSyncManager';
import { Logger } from '../utils/logger';

// ─── Tree item types ──────────────────────────────────────────────────────────

export class CodeFolderItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile) {
    super('Code', vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = 'codeFolder';
    this.iconPath = new vscode.ThemeIcon('code');

    if (!server.codeConfig) {
      this.description = 'Not configured';
      this.tooltip = 'Click to configure code management';
    } else if (server.type === 'mwaa') {
      this.description = `s3://${server.codeConfig.s3Bucket}/${server.codeConfig.s3Prefix ?? ''}`;
    } else if (server.codeConfig.remoteHost) {
      this.description = `${server.codeConfig.remoteUser}@${server.codeConfig.remoteHost}`;
    } else {
      this.description = server.codeConfig.localDagsPath ?? '';
    }
  }
}

export class CodeFileItem extends vscode.TreeItem {
  constructor(
    public readonly server: ServerProfile,
    public readonly filePath: string,   // absolute local path
    public readonly fileName: string,
    public readonly isDirectory: boolean
  ) {
    super(
      fileName,
      isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
    );
    this.contextValue = isDirectory ? 'codeDirectory' : 'codeFile';
    this.resourceUri = vscode.Uri.file(filePath);

    if (!isDirectory) {
      this.iconPath = vscode.ThemeIcon.File;
      this.command = {
        command: 'airflow.code.openFile',
        title: 'Open File',
        arguments: [this]
      };
    } else {
      this.iconPath = vscode.ThemeIcon.Folder;
    }
  }
}

export class CodeNotConfiguredItem extends vscode.TreeItem {
  constructor(public readonly server: ServerProfile) {
    super('Code path not configured', vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'codeNotConfigured';
    this.iconPath = new vscode.ThemeIcon('info');
    this.tooltip = 'Edit server settings to configure DAG file path or S3 bucket';
    this.description = 'Edit server to configure';
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export class CodeTreeProvider {
  syncManager = CodeSyncManager.getInstance();

  async listDirPublic(server: ServerProfile, dirPath: string): Promise<CodeFileItem[]> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
          return a.name.localeCompare(b.name);
        })
        .map(e => new CodeFileItem(server, path.join(dirPath, e.name), e.name, e.isDirectory()));
    } catch {
      Logger.debug('CodeTreeProvider.listDir: Directory empty or not synced yet', { dirPath });
      return [];
    }
  }
}
