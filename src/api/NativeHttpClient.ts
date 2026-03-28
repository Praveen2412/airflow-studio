import * as https from 'https';
import { URL } from 'url';
import { Logger } from '../utils/logger';
import { Constants } from '../utils/constants';

/**
 * Native HTTPS client for MWAA environments.
 * Uses Node.js https module instead of axios to avoid cookie authentication issues.
 * Axios has compatibility problems with MWAA's session cookie authentication.
 */
export class NativeHttpClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string> = {};
  private timeout: number;

  constructor(baseURL: string, headers?: Record<string, string>) {
    this.baseURL = baseURL;
    this.timeout = Constants.HTTP_TIMEOUT;
    
    if (headers) {
      this.defaultHeaders = { ...headers };
    }
    
    Logger.debug('NativeHttpClient: Initialized', { 
      baseURL,
      hasHeaders: !!headers,
      headerKeys: headers ? Object.keys(headers) : []
    });
  }

  setDefaultHeader(name: string, value: string): void {
    this.defaultHeaders[name] = value;
    Logger.debug('NativeHttpClient: Set default header', { name, valueLength: value.length });
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      params?: Record<string, any>;
      data?: any;
      headers?: Record<string, string>;
    } = {}
  ): Promise<T> {
    try {
      // Build full URL with query parameters
      const url = new URL(path, this.baseURL);
      
      if (options.params) {
        Object.keys(options.params).forEach(key => {
          url.searchParams.append(key, String(options.params![key]));
        });
      }

      // Merge headers
      const headers = { ...this.defaultHeaders, ...options.headers };

      // Prepare request body
      let body: string | undefined;
      if (options.data) {
        if (typeof options.data === 'string') {
          body = options.data;
        } else {
          body = JSON.stringify(options.data);
          // Only set Content-Type if not already set and we have JSON data
          if (!headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
          }
        }
        headers['Content-Length'] = String(Buffer.byteLength(body));
      }

      const requestOptions: https.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers,
        timeout: this.timeout
      };

      Logger.debug('NativeHttpClient Request', {
        method: requestOptions.method,
        url: url.pathname + url.search,
        hasBody: !!body,
        bodySize: body ? body.length : 0,
        headerKeys: Object.keys(headers)
      });

      return new Promise<T>((resolve, reject) => {
        const req = https.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            const statusCode = res.statusCode || 0;
            
            Logger.debug('NativeHttpClient Response', {
              status: statusCode,
              statusMessage: res.statusMessage,
              url: url.pathname,
              dataSize: data.length,
              contentType: res.headers['content-type']
            });

            if (statusCode >= 200 && statusCode < 300) {
              try {
                // Parse JSON response
                const parsed = data ? JSON.parse(data) : null;
                resolve(parsed as T);
              } catch (parseError) {
                Logger.error('NativeHttpClient: JSON parse error', parseError as Error, {
                  url: url.pathname,
                  dataPreview: data.substring(0, 200)
                });
                reject(new Error(`Failed to parse JSON response: ${parseError}`));
              }
            } else {
              // Error response
              let errorData: any;
              try {
                errorData = data ? JSON.parse(data) : null;
              } catch {
                errorData = data;
              }

              const error: any = new Error(`Request failed with status ${statusCode}`);
              error.response = {
                status: statusCode,
                statusText: res.statusMessage,
                data: errorData,
                headers: res.headers
              };
              error.status = statusCode;

              Logger.error('NativeHttpClient: HTTP error', error, {
                url: url.pathname,
                method: requestOptions.method,
                status: statusCode,
                responseData: errorData
              });

              reject(error);
            }
          });
        });

        req.on('error', (error) => {
          Logger.error('NativeHttpClient: Request error', error, {
            url: url.pathname,
            method: requestOptions.method
          });
          reject(error);
        });

        req.on('timeout', () => {
          req.destroy();
          const error = new Error(`Request timeout after ${this.timeout}ms`);
          Logger.error('NativeHttpClient: Timeout', error as Error, {
            url: url.pathname,
            timeout: this.timeout
          });
          reject(error);
        });

        // Write body if present
        if (body) {
          req.write(body);
        }

        req.end();
      });
    } catch (error: any) {
      Logger.error('NativeHttpClient: Request setup error', error, { path, method });
      throw error;
    }
  }

  async get<T>(path: string, options?: { params?: Record<string, any>; headers?: Record<string, string> }): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(path: string, data?: any, options?: { headers?: Record<string, string> }): Promise<T> {
    return this.request<T>('POST', path, { ...options, data });
  }

  async patch<T>(path: string, data?: any, options?: { headers?: Record<string, string> }): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, data });
  }

  async delete<T>(path: string, options?: { headers?: Record<string, string> }): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }
}
