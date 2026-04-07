import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ServerProfile, CodeConfig } from '../models';
import { Logger } from '../utils/logger';

const execFileAsync = promisify(execFile);

export interface SyncResult {
  success: boolean;
  filesChanged: number;
  message: string;
}

export interface RemoteFile {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size?: number;
  lastModified?: Date;
}

export class CodeSyncManager {
  private static instance: CodeSyncManager;

  static getInstance(): CodeSyncManager {
    if (!CodeSyncManager.instance) {
      CodeSyncManager.instance = new CodeSyncManager();
    }
    return CodeSyncManager.instance;
  }

  getLocalWorkspacePath(server: ServerProfile): string {
    const cfg = server.codeConfig;
    if (cfg?.localWorkspacePath) {
      return cfg.localWorkspacePath.replace('~', os.homedir());
    }
    return path.join(os.homedir(), '.airflow-studio', 'workspaces', server.id);
  }

  async ensureLocalWorkspace(server: ServerProfile): Promise<string> {
    const localPath = this.getLocalWorkspacePath(server);
    await fs.promises.mkdir(localPath, { recursive: true });
    return localPath;
  }

  // ─── MWAA / S3 ────────────────────────────────────────────────────────────

  async pullFromS3(server: ServerProfile, deleteLocal: boolean = true): Promise<SyncResult> {
    const cfg = server.codeConfig!;
    const localPath = await this.ensureLocalWorkspace(server);
    const s3Uri = `s3://${cfg.s3Bucket}/${cfg.s3Prefix ?? ''}`;

    Logger.info('CodeSyncManager.pullFromS3: Starting', { s3Uri, localPath, deleteLocal });

    const args = ['s3', 'sync', s3Uri, localPath];
    if (deleteLocal) args.push('--delete');
    if (server.awsProfile) args.push('--profile', server.awsProfile);
    if (server.awsRegion) args.push('--region', server.awsRegion);

    try {
      const { stdout } = await execFileAsync('aws', args);
      const lines = stdout.trim().split('\n').filter(Boolean);
      Logger.info('CodeSyncManager.pullFromS3: Done', { files: lines.length });
      return { success: true, filesChanged: lines.length, message: `Pulled ${lines.length} file(s) from S3` };
    } catch (error: any) {
      Logger.error('CodeSyncManager.pullFromS3: Failed', error);
      throw new Error(`S3 pull failed: ${error.message}`);
    }
  }

  async pushToS3(server: ServerProfile): Promise<SyncResult> {
    const cfg = server.codeConfig!;
    const localPath = this.getLocalWorkspacePath(server);
    const s3Uri = `s3://${cfg.s3Bucket}/${cfg.s3Prefix ?? ''}`;

    Logger.info('CodeSyncManager.pushToS3: Starting', { localPath, s3Uri });

    const args = ['s3', 'sync', localPath, s3Uri, '--delete'];
    if (server.awsProfile) args.push('--profile', server.awsProfile);
    if (server.awsRegion) args.push('--region', server.awsRegion);

    try {
      const { stdout } = await execFileAsync('aws', args);
      const lines = stdout.trim().split('\n').filter(Boolean);
      Logger.info('CodeSyncManager.pushToS3: Done', { files: lines.length });
      return { success: true, filesChanged: lines.length, message: `Pushed ${lines.length} file(s) to S3` };
    } catch (error: any) {
      Logger.error('CodeSyncManager.pushToS3: Failed', error);
      throw new Error(`S3 push failed: ${error.message}`);
    }
  }

  async uploadFileToS3(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath).replace(/\\/g, '/');
    const s3Key = `${cfg.s3Prefix ?? ''}${relative}`;

    Logger.info('CodeSyncManager.uploadFileToS3', { localFilePath, s3Key });

    const args = ['s3', 'cp', localFilePath, `s3://${cfg.s3Bucket}/${s3Key}`];
    if (server.awsProfile) args.push('--profile', server.awsProfile);
    if (server.awsRegion) args.push('--region', server.awsRegion);

    try {
      await execFileAsync('aws', args);
    } catch (error: any) {
      throw new Error(`S3 upload failed: ${error.message}`);
    }
  }

  async deleteFileFromS3(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath).replace(/\\/g, '/');
    const s3Key = `${cfg.s3Prefix ?? ''}${relative}`;

    Logger.info('CodeSyncManager.deleteFileFromS3', { s3Key });

    const args = ['s3', 'rm', `s3://${cfg.s3Bucket}/${s3Key}`];
    if (server.awsProfile) args.push('--profile', server.awsProfile);
    if (server.awsRegion) args.push('--region', server.awsRegion);

    try {
      await execFileAsync('aws', args);
    } catch (error: any) {
      throw new Error(`S3 delete failed: ${error.message}`);
    }
  }

  async deleteFileFromLocal(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath);
    const target = path.join(cfg.localDagsPath!.replace('~', os.homedir()), relative);
    await fs.promises.unlink(target).catch(() => undefined);
  }

  async deleteFileFromRemote(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath).replace(/\\/g, '/');
    const remoteFile = `${cfg.remoteDagsPath}/${relative}`;

    const port = cfg.remotePort || 22;
    const sshArgs: string[] = ['-p', port.toString()];
    if (cfg.remoteKeyPath) sshArgs.push('-i', cfg.remoteKeyPath.replace('~', os.homedir()), '-o', 'StrictHostKeyChecking=no');
    sshArgs.push(`${cfg.remoteUser}@${cfg.remoteHost}`, `rm -f "${remoteFile}"`);

    try {
      await execFileAsync('ssh', sshArgs);
    } catch (error: any) {
      throw new Error(`Remote delete failed: ${error.message}`);
    }
  }

  // ─── Self-hosted local ─────────────────────────────────────────────────────

  async pullFromLocal(server: ServerProfile): Promise<SyncResult> {
    const cfg = server.codeConfig!;
    const src = cfg.localDagsPath!.replace('~', os.homedir());
    const dest = await this.ensureLocalWorkspace(server);

    Logger.info('CodeSyncManager.pullFromLocal', { src, dest });

    try {
      await this.copyDirRecursive(src, dest);
      const files = await this.countFiles(dest);
      return { success: true, filesChanged: files, message: `Pulled ${files} file(s) from local path` };
    } catch (error: any) {
      throw new Error(`Local pull failed: ${error.message}`);
    }
  }

  async pushToLocal(server: ServerProfile): Promise<SyncResult> {
    const cfg = server.codeConfig!;
    const src = this.getLocalWorkspacePath(server);
    const dest = cfg.localDagsPath!.replace('~', os.homedir());

    Logger.info('CodeSyncManager.pushToLocal', { src, dest });

    try {
      await this.copyDirRecursive(src, dest);
      const files = await this.countFiles(dest);
      return { success: true, filesChanged: files, message: `Pushed ${files} file(s) to local path` };
    } catch (error: any) {
      throw new Error(`Local push failed: ${error.message}`);
    }
  }

  // ─── Self-hosted remote (SSH/rsync) ───────────────────────────────────────

  async pullFromRemote(server: ServerProfile): Promise<SyncResult> {
    const cfg = server.codeConfig!;
    const localPath = await this.ensureLocalWorkspace(server);
    const remote = `${cfg.remoteUser}@${cfg.remoteHost}:${cfg.remoteDagsPath}/`;

    Logger.info('CodeSyncManager.pullFromRemote', { remote, localPath });

    const args = ['-avz', '--delete'];
    const port = cfg.remotePort || 22;
    if (cfg.remoteKeyPath) {
      args.push('-e', `ssh -p ${port} -i ${cfg.remoteKeyPath.replace('~', os.homedir())} -o StrictHostKeyChecking=no`);
    } else {
      args.push('-e', `ssh -p ${port} -o StrictHostKeyChecking=no`);
    }
    args.push(remote, localPath + '/');

    try {
      const { stdout } = await execFileAsync('rsync', args);
      const lines = stdout.trim().split('\n').filter(l => l && !l.startsWith('sending') && !l.startsWith('sent') && !l.startsWith('total'));
      return { success: true, filesChanged: lines.length, message: `Pulled ${lines.length} file(s) from remote` };
    } catch (error: any) {
      throw new Error(`Remote pull failed: ${error.message}`);
    }
  }

  async pushToRemote(server: ServerProfile): Promise<SyncResult> {
    const cfg = server.codeConfig!;
    const localPath = this.getLocalWorkspacePath(server);
    const remote = `${cfg.remoteUser}@${cfg.remoteHost}:${cfg.remoteDagsPath}/`;

    Logger.info('CodeSyncManager.pushToRemote', { localPath, remote });

    const args = ['-avz', '--delete'];
    const port = cfg.remotePort || 22;
    if (cfg.remoteKeyPath) {
      args.push('-e', `ssh -p ${port} -i ${cfg.remoteKeyPath.replace('~', os.homedir())} -o StrictHostKeyChecking=no`);
    } else {
      args.push('-e', `ssh -p ${port} -o StrictHostKeyChecking=no`);
    }
    args.push(localPath + '/', remote);

    try {
      const { stdout } = await execFileAsync('rsync', args);
      const lines = stdout.trim().split('\n').filter(l => l && !l.startsWith('sending') && !l.startsWith('sent') && !l.startsWith('total'));
      return { success: true, filesChanged: lines.length, message: `Pushed ${lines.length} file(s) to remote` };
    } catch (error: any) {
      throw new Error(`Remote push failed: ${error.message}`);
    }
  }

  // ─── Unified pull/push dispatch ───────────────────────────────────────────

  async pull(server: ServerProfile): Promise<SyncResult> {
    if (server.type === 'mwaa') return this.pullFromS3(server, true);
    if (server.codeConfig?.remoteHost) return this.pullFromRemote(server);
    return this.pullFromLocal(server);
  }

  async pullOnly(server: ServerProfile): Promise<SyncResult> {
    if (server.type === 'mwaa') return this.pullFromS3(server, false);
    if (server.codeConfig?.remoteHost) return this.pullFromRemote(server);
    return this.pullFromLocal(server);
  }

  async push(server: ServerProfile): Promise<SyncResult> {
    if (server.type === 'mwaa') return this.pushToS3(server);
    if (server.codeConfig?.remoteHost) return this.pushToRemote(server);
    return this.pushToLocal(server);
  }

  async uploadFile(server: ServerProfile, localFilePath: string): Promise<void> {
    if (server.type === 'mwaa') {
      await this.uploadFileToS3(server, localFilePath);
    } else if (server.codeConfig?.remoteHost) {
      await this.uploadFileToRemote(server, localFilePath);
    } else {
      await this.uploadFileToLocal(server, localFilePath);
    }
  }

  async deleteFile(server: ServerProfile, localFilePath: string): Promise<void> {
    if (server.type === 'mwaa') {
      await this.deleteFileFromS3(server, localFilePath);
    } else if (server.codeConfig?.remoteHost) {
      await this.deleteFileFromRemote(server, localFilePath);
    } else {
      await this.deleteFileFromLocal(server, localFilePath);
    }
    await fs.promises.unlink(localFilePath).catch(() => undefined);
  }

  async downloadFile(server: ServerProfile, localFilePath: string): Promise<void> {
    if (server.type === 'mwaa') {
      await this.downloadFileFromS3(server, localFilePath);
    } else if (server.codeConfig?.remoteHost) {
      await this.downloadFileFromRemote(server, localFilePath);
    } else {
      await this.downloadFileFromLocal(server, localFilePath);
    }
  }

  private async uploadFileToLocal(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath);
    const dest = path.join(cfg.localDagsPath!.replace('~', os.homedir()), relative);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(localFilePath, dest);
  }

  private async uploadFileToRemote(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath).replace(/\\/g, '/');
    const remoteDest = `${cfg.remoteUser}@${cfg.remoteHost}:${cfg.remoteDagsPath}/${relative}`;

    const port = cfg.remotePort || 22;
    const args: string[] = ['-P', port.toString()];
    if (cfg.remoteKeyPath) args.push('-i', cfg.remoteKeyPath.replace('~', os.homedir()), '-o', 'StrictHostKeyChecking=no');
    args.push(localFilePath, remoteDest);

    try {
      await execFileAsync('scp', args);
    } catch (error: any) {
      throw new Error(`Remote upload failed: ${error.message}`);
    }
  }

  private async downloadFileFromS3(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath).replace(/\\/g, '/');
    const s3Key = `${cfg.s3Prefix ?? ''}${relative}`;

    const args = ['s3', 'cp', `s3://${cfg.s3Bucket}/${s3Key}`, localFilePath];
    if (server.awsProfile) args.push('--profile', server.awsProfile);
    if (server.awsRegion) args.push('--region', server.awsRegion);

    try {
      await execFileAsync('aws', args);
    } catch (error: any) {
      throw new Error(`S3 download failed: ${error.message}`);
    }
  }

  private async downloadFileFromLocal(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath);
    const src = path.join(cfg.localDagsPath!.replace('~', os.homedir()), relative);
    await fs.promises.copyFile(src, localFilePath);
  }

  private async downloadFileFromRemote(server: ServerProfile, localFilePath: string): Promise<void> {
    const cfg = server.codeConfig!;
    const localBase = this.getLocalWorkspacePath(server);
    const relative = path.relative(localBase, localFilePath).replace(/\\/g, '/');
    const remoteSrc = `${cfg.remoteUser}@${cfg.remoteHost}:${cfg.remoteDagsPath}/${relative}`;

    const port = cfg.remotePort || 22;
    const args: string[] = ['-P', port.toString()];
    if (cfg.remoteKeyPath) args.push('-i', cfg.remoteKeyPath.replace('~', os.homedir()), '-o', 'StrictHostKeyChecking=no');
    args.push(remoteSrc, localFilePath);

    try {
      await execFileAsync('scp', args);
    } catch (error: any) {
      throw new Error(`Remote download failed: ${error.message}`);
    }
  }

  // ─── Local file listing ───────────────────────────────────────────────────

  async listLocalFiles(dirPath: string): Promise<RemoteFile[]> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries.map(e => ({
        name: e.name,
        relativePath: e.name,
        isDirectory: e.isDirectory()
      }));
    } catch {
      return [];
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async copyDirRecursive(src: string, dest: string): Promise<void> {
    await fs.promises.mkdir(dest, { recursive: true });
    const entries = await fs.promises.readdir(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        await this.copyDirRecursive(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  private async countFiles(dir: string): Promise<number> {
    let count = 0;
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) count += await this.countFiles(path.join(dir, e.name));
        else count++;
      }
    } catch { /* ignore */ }
    return count;
  }
}
