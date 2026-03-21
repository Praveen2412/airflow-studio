import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

export class HttpClient {
  private client: AxiosInstance;

  constructor(baseURL: string, headers?: Record<string, string>) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      timeout: 30000
    });
  }

  setAuth(username: string, password: string) {
    this.client.defaults.auth = { username, password };
  }

  setToken(token: string) {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    console.log(`[HttpClient] GET ${url}`);
    const response = await this.client.get<T>(url, config);
    console.log(`[HttpClient] GET ${url} - Success`);
    return response.data;
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    console.log(`[HttpClient] POST ${url}`);
    const response = await this.client.post<T>(url, data, config);
    console.log(`[HttpClient] POST ${url} - Success`);
    return response.data;
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    console.log(`[HttpClient] PATCH ${url}`);
    const response = await this.client.patch<T>(url, data, config);
    console.log(`[HttpClient] PATCH ${url} - Success`);
    return response.data;
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    console.log(`[HttpClient] DELETE ${url}`);
    const response = await this.client.delete<T>(url, config);
    console.log(`[HttpClient] DELETE ${url} - Success`);
    return response.data;
  }
}
