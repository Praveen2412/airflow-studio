import { IAirflowClient } from './IAirflowClient';
import { AirflowStableClient } from './AirflowStableClient';
import { AirflowV2Client } from './AirflowV2Client';
import { AirflowSessionClient } from './AirflowSessionClient';
import { MwaaClient } from './MwaaClient';
import { Logger } from '../utils/logger';

export type AuthBackend = 'basic' | 'session' | 'jwt' | 'aws';
export type ApiVersion = 'v1' | 'v2';

export interface AuthDetectionResult {
  apiVersion: ApiVersion;
  authBackend: AuthBackend;
  client: IAirflowClient;
}

export class AirflowClientFactory {
  /**
   * Detects the API version and auth backend, then creates the appropriate client
   */
  static async createClient(
    baseUrl: string,
    username?: string,
    password?: string,
    headers?: Record<string, string>,
    type?: 'self-hosted' | 'mwaa',
    awsRegion?: string,
    environmentName?: string
  ): Promise<AuthDetectionResult> {
    Logger.info('AirflowClientFactory: Starting auth detection', { baseUrl, type });

    // MWAA has its own flow
    if (type === 'mwaa' && environmentName && awsRegion) {
      return await this.createMwaaClient(environmentName, awsRegion);
    }

    // For self-hosted, try different combinations
    return await this.detectSelfHosted(baseUrl, username, password, headers);
  }

  /**
   * Create MWAA client (tries v2 first, then v1)
   */
  private static async createMwaaClient(environmentName: string, awsRegion: string): Promise<AuthDetectionResult> {
    // Try API v2 first
    try {
      Logger.debug('AirflowClientFactory: Testing MWAA with API v2');
      const client = new MwaaClient(environmentName, awsRegion, 'v2');
      await client.getHealth();
      Logger.info('AirflowClientFactory: MWAA API v2 works');
      return { apiVersion: 'v2', authBackend: 'aws', client };
    } catch (error) {
      Logger.debug('AirflowClientFactory: MWAA API v2 failed, trying v1');
    }

    // Fallback to API v1
    try {
      const client = new MwaaClient(environmentName, awsRegion, 'v1');
      await client.getHealth();
      Logger.info('AirflowClientFactory: MWAA API v1 works');
      return { apiVersion: 'v1', authBackend: 'aws', client };
    } catch (error) {
      Logger.error('AirflowClientFactory: MWAA both versions failed', error);
      throw new Error('Failed to connect to MWAA environment');
    }
  }

  /**
   * Detect self-hosted Airflow API version and auth backend
   */
  private static async detectSelfHosted(
    baseUrl: string,
    username?: string,
    password?: string,
    headers?: Record<string, string>
  ): Promise<AuthDetectionResult> {
    // Try API v2 with JWT first (Airflow 3.x)
    if (username && password) {
      const v2JwtResult = await this.tryV2Jwt(baseUrl, username, password, headers);
      if (v2JwtResult) return v2JwtResult;
    }

    // Try API v1 with different auth backends
    if (username && password) {
      // Try Basic Auth
      const v1BasicResult = await this.tryV1Basic(baseUrl, username, password, headers);
      if (v1BasicResult) return v1BasicResult;

      // Try Session Auth
      const v1SessionResult = await this.tryV1Session(baseUrl, username, password, headers);
      if (v1SessionResult) return v1SessionResult;
    }

    throw new Error('Failed to authenticate with any supported method. Please check your credentials and Airflow configuration.');
  }

  /**
   * Try Airflow 3.x API v2 with JWT token auth
   */
  private static async tryV2Jwt(
    baseUrl: string,
    username: string,
    password: string,
    headers?: Record<string, string>
  ): Promise<AuthDetectionResult | null> {
    try {
      Logger.debug('AirflowClientFactory: Testing API v2 with JWT');
      const client = await AirflowV2Client.create(baseUrl, username, password, headers);
      // Test with an authenticated endpoint (not health, as it may not require auth)
      await client.listDags();
      Logger.info('AirflowClientFactory: API v2 with JWT works');
      return { apiVersion: 'v2', authBackend: 'jwt', client };
    } catch (error: any) {
      Logger.debug('AirflowClientFactory: API v2 with JWT failed', { status: error.status, message: error.message });
      return null;
    }
  }

  /**
   * Try Airflow 2.x API v1 with Basic Auth
   */
  private static async tryV1Basic(
    baseUrl: string,
    username: string,
    password: string,
    headers?: Record<string, string>
  ): Promise<AuthDetectionResult | null> {
    try {
      Logger.debug('AirflowClientFactory: Testing API v1 with Basic Auth');
      const client = new AirflowStableClient(baseUrl, username, password, headers);
      // Test with an authenticated endpoint
      await client.listDags();
      Logger.info('AirflowClientFactory: API v1 with Basic Auth works');
      return { apiVersion: 'v1', authBackend: 'basic', client };
    } catch (error: any) {
      Logger.debug('AirflowClientFactory: API v1 with Basic Auth failed', { status: error.status, message: error.message });
      return null;
    }
  }

  /**
   * Try Airflow 2.x API v1 with Session Auth
   */
  private static async tryV1Session(
    baseUrl: string,
    username: string,
    password: string,
    headers?: Record<string, string>
  ): Promise<AuthDetectionResult | null> {
    try {
      Logger.debug('AirflowClientFactory: Testing API v1 with Session Auth');
      const client = await AirflowSessionClient.create(baseUrl, username, password, headers);
      // Test with an authenticated endpoint
      await client.listDags();
      Logger.info('AirflowClientFactory: API v1 with Session Auth works');
      return { apiVersion: 'v1', authBackend: 'session', client };
    } catch (error: any) {
      Logger.debug('AirflowClientFactory: API v1 with Session Auth failed', { status: error.status, message: error.message });
      return null;
    }
  }

  /**
   * Create client from known auth backend (skip detection)
   */
  static async createClientFromProfile(
    baseUrl: string,
    apiVersion: ApiVersion,
    authBackend: AuthBackend,
    username?: string,
    password?: string,
    headers?: Record<string, string>,
    environmentName?: string,
    awsRegion?: string
  ): Promise<IAirflowClient> {
    Logger.debug('AirflowClientFactory: Creating client from profile', { apiVersion, authBackend });

    if (authBackend === 'aws' && environmentName && awsRegion) {
      return new MwaaClient(environmentName, awsRegion, apiVersion === 'v2' ? 'v2' : 'v1');
    }

    if (apiVersion === 'v2' && authBackend === 'jwt' && username && password) {
      return await AirflowV2Client.create(baseUrl, username, password, headers);
    }

    if (apiVersion === 'v1' && authBackend === 'basic' && username && password) {
      return new AirflowStableClient(baseUrl, username, password, headers);
    }

    if (apiVersion === 'v1' && authBackend === 'session' && username && password) {
      return await AirflowSessionClient.create(baseUrl, username, password, headers);
    }

    throw new Error(`Unsupported combination: API ${apiVersion} with ${authBackend} auth`);
  }
}
