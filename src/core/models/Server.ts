export interface ServerConfig {
  apiUrl: string;
  type: 'self-hosted' | 'mwaa';
  apiUserName?: string;
  apiPassword?: string;
  region?: string;
  awsProfile?: string;
}

export class Server {
  constructor(public readonly config: ServerConfig) {}

  get identifier(): string {
    if (this.config.type === 'mwaa') {
      return `mwaa:${this.config.region}:${this.config.apiUrl}`;
    }
    return `${this.config.apiUrl}:${this.config.apiUserName}`;
  }

  get displayName(): string {
    if (this.config.type === 'mwaa') {
      return `MWAA: ${this.config.apiUrl} (${this.config.region})`;
    }
    return `${this.config.apiUrl} - ${this.config.apiUserName}`;
  }

  get isMwaa(): boolean {
    return this.config.type === 'mwaa';
  }
}
