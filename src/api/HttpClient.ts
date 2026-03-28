import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Logger } from '../utils/logger';
import { Constants } from '../utils/constants';

export class HttpClient {
  private client: AxiosInstance;
  private baseURL: string;
  private username?: string;
  private password?: string;
  private token?: string;
  private tokenExpiry?: number;
  private tokenPromise?: Promise<boolean>;

  // Expose axios instance for advanced configuration
  get axiosInstance(): AxiosInstance {
    return this.client;
  }

  constructor(baseURL: string, headers?: Record<string, string>) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: Constants.HTTP_TIMEOUT
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        const hasAuth = config.auth || config.headers?.Authorization;
        const authType = config.auth ? 'Basic Auth' : (config.headers?.Authorization ? 'Bearer Token' : 'none');
        Logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          auth: authType,
          hasAuthHeader: !!config.headers?.Authorization,
          hasAuthConfig: !!config.auth,
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
          dataType: Array.isArray(response.data) ? `Array(${response.data.length})` : typeof response.data
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

setAuth(username: string, password: string) {
    this.username = username;
    this.password = password;
    this.client.defaults.auth = { username, password };
    Logger.debug('HttpClient: Basic auth configured', { 
      username,
      passwordLength: password.length,
      hasSpecialChars: /[^a-zA-Z0-9]/.test(password)
    });
  }

  async setTokenAuth(username: string, password: string) {
    this.username = username;
    this.password = password;
    
    // Return existing token if still valid (cache for configured TTL)
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      Logger.debug('HttpClient: Using cached JWT token');
      return true;
    }
    
    // If token fetch is in progress, wait for it
    if (this.tokenPromise) {
      Logger.debug('HttpClient: Waiting for in-progress token fetch');
      return this.tokenPromise;
    }
    
    // Fetch new token
    this.tokenPromise = this.fetchToken(username, password);
    const result = await this.tokenPromise;
    this.tokenPromise = undefined;
    return result;
  }
  
  private async fetchToken(username: string, password: string): Promise<boolean> {
    try {
      Logger.debug('HttpClient: Fetching new JWT token');
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
      this.tokenExpiry = Date.now() + Constants.TOKEN_CACHE_TTL;
      this.client.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
      Logger.info('HttpClient: JWT token obtained and cached', { ttl: Constants.TOKEN_CACHE_TTL });
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
    try {
      // If Accept header is text/plain, set responseType to text
      const finalConfig = { ...config };
      if (config?.headers?.['Accept'] === 'text/plain') {
        finalConfig.responseType = 'text';
      }
      const response = await this.client.get<T>(url, finalConfig);
      return response.data;
    } catch (error: any) {
      // If 401 and we have JWT credentials, try to refresh token
      if (error.response?.status === 401 && this.username && this.password && this.token) {
        Logger.info('HttpClient: Token expired, refreshing...');
        this.token = undefined;
        this.tokenExpiry = undefined;
        await this.setTokenAuth(this.username, this.password);
        // Retry the request
        const finalConfig = { ...config };
        if (config?.headers?.['Accept'] === 'text/plain') {
          finalConfig.responseType = 'text';
        }
        const response = await this.client.get<T>(url, finalConfig);
        return response.data;
      }
      throw error;
    }
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.post<T>(url, data, config);
      return response.data;
    } catch (error: any) {
      // If 401 and we have JWT credentials, try to refresh token
      if (error.response?.status === 401 && this.username && this.password && this.token) {
        Logger.info('HttpClient: Token expired, refreshing...');
        this.token = undefined;
        this.tokenExpiry = undefined;
        await this.setTokenAuth(this.username, this.password);
        // Retry the request
        const response = await this.client.post<T>(url, data, config);
        return response.data;
      }
      throw error;
    }
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.patch<T>(url, data, config);
      return response.data;
    } catch (error: any) {
      // If 401 and we have JWT credentials, try to refresh token
      if (error.response?.status === 401 && this.username && this.password && this.token) {
        Logger.info('HttpClient: Token expired, refreshing...');
        this.token = undefined;
        this.tokenExpiry = undefined;
        await this.setTokenAuth(this.username, this.password);
        // Retry the request
        const response = await this.client.patch<T>(url, data, config);
        return response.data;
      }
      throw error;
    }
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.delete<T>(url, config);
      return response.data;
    } catch (error: any) {
      // If 401 and we have JWT credentials, try to refresh token
      if (error.response?.status === 401 && this.username && this.password && this.token) {
        Logger.info('HttpClient: Token expired, refreshing...');
        this.token = undefined;
        this.tokenExpiry = undefined;
        await this.setTokenAuth(this.username, this.password);
        // Retry the request
        const response = await this.client.delete<T>(url, config);
        return response.data;
      }
      throw error;
    }
  }
}
