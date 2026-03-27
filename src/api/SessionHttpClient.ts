import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { Logger } from '../utils/logger';
import { Constants } from '../utils/constants';

export class SessionHttpClient {
  private client: AxiosInstance;
  private baseURL: string;
  private username?: string;
  private password?: string;
  private sessionCookie?: string;
  private sessionExpiry?: number;

  constructor(baseURL: string, headers?: Record<string, string>) {
    this.baseURL = baseURL;
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: Constants.HTTP_TIMEOUT,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        Logger.debug('HTTP Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          baseURL: config.baseURL,
          auth: config.headers?.Cookie ? 'Session Cookie' : 'none',
          hasSessionCookie: !!config.headers?.Cookie,
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

  async setSessionAuth(username: string, password: string): Promise<boolean> {
    this.username = username;
    this.password = password;

    // Return existing session if still valid (cache for 50 minutes)
    if (this.sessionCookie && this.sessionExpiry && Date.now() < this.sessionExpiry) {
      Logger.debug('SessionHttpClient: Using cached session cookie');
      return true;
    }

    // Fetch new session
    return await this.fetchSession(username, password);
  }

  private async fetchSession(username: string, password: string): Promise<boolean> {
    try {
      Logger.debug('SessionHttpClient: Fetching new session');

      // Step 1: Get login page to get CSRF token and initial session cookie
      const loginPageResponse = await axios.get(`${this.baseURL}/login/`, {
        maxRedirects: 5,
        validateStatus: () => true
      });

      const cookies = loginPageResponse.headers['set-cookie'];
      if (!cookies) {
        Logger.error('SessionHttpClient: No cookies received from login page');
        return false;
      }

      // Extract CSRF token from HTML
      const csrfMatch = loginPageResponse.data.match(/name="csrf_token"[^>]*value="([^"]+)"/);
      const csrfToken = csrfMatch ? csrfMatch[1] : null;

      if (!csrfToken) {
        Logger.error('SessionHttpClient: No CSRF token found in login page');
        return false;
      }

      Logger.debug('SessionHttpClient: CSRF token and cookies obtained');

      // Step 2: Login with credentials and CSRF token
      const loginData = new URLSearchParams({
        username,
        password,
        csrf_token: csrfToken
      });

      const loginResponse = await axios.post(`${this.baseURL}/login/`, loginData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.join('; '),
          'Referer': `${this.baseURL}/login/`
        },
        maxRedirects: 0,
        validateStatus: () => true
      });

      // Check if login was successful (redirect to /home)
      if (loginResponse.status === 302 || loginResponse.status === 303) {
        const sessionCookies = loginResponse.headers['set-cookie'] || cookies;
        this.sessionCookie = sessionCookies.join('; ');
        this.sessionExpiry = Date.now() + (50 * 60 * 1000); // 50 minutes

        // Set cookie for all future requests
        this.client.defaults.headers.common['Cookie'] = this.sessionCookie;

        Logger.info('SessionHttpClient: Session obtained and cached', { ttl: '50 minutes' });
        return true;
      } else {
        Logger.error('SessionHttpClient: Login failed', { status: loginResponse.status });
        return false;
      }
    } catch (error: any) {
      Logger.error('SessionHttpClient: Failed to get session', error);
      return false;
    }
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    try {
      const response = await this.client.get<T>(url, config);
      return response.data;
    } catch (error: any) {
      // If 401 and we have credentials, try to refresh session
      if (error.response?.status === 401 && this.username && this.password) {
        Logger.info('SessionHttpClient: Session expired, refreshing...');
        this.sessionCookie = undefined;
        this.sessionExpiry = undefined;
        await this.setSessionAuth(this.username, this.password);
        // Retry the request
        const response = await this.client.get<T>(url, config);
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
      // If 401 and we have credentials, try to refresh session
      if (error.response?.status === 401 && this.username && this.password) {
        Logger.info('SessionHttpClient: Session expired, refreshing...');
        this.sessionCookie = undefined;
        this.sessionExpiry = undefined;
        await this.setSessionAuth(this.username, this.password);
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
      // If 401 and we have credentials, try to refresh session
      if (error.response?.status === 401 && this.username && this.password) {
        Logger.info('SessionHttpClient: Session expired, refreshing...');
        this.sessionCookie = undefined;
        this.sessionExpiry = undefined;
        await this.setSessionAuth(this.username, this.password);
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
      // If 401 and we have credentials, try to refresh session
      if (error.response?.status === 401 && this.username && this.password) {
        Logger.info('SessionHttpClient: Session expired, refreshing...');
        this.sessionCookie = undefined;
        this.sessionExpiry = undefined;
        await this.setSessionAuth(this.username, this.password);
        // Retry the request
        const response = await this.client.delete<T>(url, config);
        return response.data;
      }
      throw error;
    }
  }
}
