import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Logger } from '../utils/logger';

export class HttpClient {
  private client: AxiosInstance;
  private baseURL: string;
  private username?: string;
  private password?: string;
  private token?: string;

  constructor(baseURL: string, headers?: Record<string, string>) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 30000
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        Logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          auth: config.auth ? 'Basic Auth' : (config.headers?.Authorization ? 'Bearer Token' : 'none'),
          dataSize: config.data ? JSON.stringify(config.data).length : 0
        });
        return config;
      },
      (error) => {
        Logger.error('HTTP Request Setup Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        Logger.debug('HTTP Response Success', {
          status: response.status,
          statusText: response.statusText,
          url: response.config.url,
          dataType: Array.isArray(response.data) ? `Array(${response.data.length})` : typeof response.data,
          dataPreview: this.getResponsePreview(response.data)
        });
        return response;
      },
      (error) => {
        Logger.error('HTTP Response Error', error, {
          url: error.config?.url,
          method: error.config?.method?.toUpperCase(),
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data
        });
        return Promise.reject(error);
      }
    );
  }

  private getResponsePreview(data: any): any {
    if (!data) return null;
    if (typeof data === 'string') {
      return data.length > 100 ? data.substring(0, 100) + '...' : data;
    }
    if (Array.isArray(data)) {
      return data.length > 0 ? `First item keys: ${Object.keys(data[0] || {}).join(', ')}` : 'Empty array';
    }
    if (typeof data === 'object') {
      return `Keys: ${Object.keys(data).slice(0, 10).join(', ')}`;
    }
    return String(data);
  }

  setAuth(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.client.defaults.auth = { username, password };
    Logger.debug('HttpClient: Basic auth configured');
  }

  async setTokenAuth(username: string, password: string) {
    this.username = username;
    this.password = password;
    try {
      Logger.debug('HttpClient: Attempting to get JWT token');
      const response = await axios.post(`${this.baseURL}/auth/token`, 
        new URLSearchParams({
          username,
          password
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      this.token = response.data.access_token;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      Logger.info('HttpClient: JWT token obtained successfully');
      return true;
    } catch (error: any) {
      Logger.error('HttpClient: Failed to get JWT token', error);
      // Fallback to basic auth
      Logger.debug('HttpClient: Falling back to basic auth');
      this.client.defaults.auth = { username, password };
      return false;
    }
  }

  setToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }
}
