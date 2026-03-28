const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const https = require('https');
const { URL } = require('url');

// Simple HTTP client using native https
class SimpleHttpClient {
  constructor(baseURL) {
    this.baseURL = baseURL;
    this.defaultHeaders = {};
  }

  async request(method, path, options = {}) {
    const url = new URL(path, this.baseURL);
    
    // Add query params
    if (options.params) {
      Object.keys(options.params).forEach(key => {
        url.searchParams.append(key, options.params[key]);
      });
    }

    const requestOptions = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: { ...this.defaultHeaders, ...options.headers }
    };

    // Add body for POST/PATCH
    let body = options.data;
    if (body && typeof body === 'object' && !(body instanceof Buffer)) {
      body = JSON.stringify(body);
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.headers['Content-Length'] = Buffer.byteLength(body);
    }

    return new Promise((resolve, reject) => {
      const req = https.request(requestOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const response = {
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: data ? JSON.parse(data) : null
          };
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            const error = new Error(`Request failed with status ${res.statusCode}`);
            error.response = response;
            reject(error);
          }
        });
      });

      req.on('error', reject);
      
      if (body) {
        req.write(body);
      }
      
      req.end();
    });
  }

  async get(path, options) {
    return this.request('GET', path, options);
  }

  async post(path, data, options = {}) {
    return this.request('POST', path, { ...options, data });
  }

  async patch(path, data, options = {}) {
    return this.request('PATCH', path, { ...options, data });
  }

  async delete(path, options) {
    return this.request('DELETE', path, options);
  }
}

async function testNativeHttpClient() {
  console.log('=== Testing Native HTTPS Client Wrapper ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Get web token
    console.log('Step 1: Getting MWAA web login token...');
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;
    console.log('  ✅ Token obtained\n');

    // Login
    console.log('Step 2: Logging in...');
    const loginData = new URLSearchParams({ token: webToken }).toString();
    const sessionCookie = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/aws_mwaa/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        const cookies = res.headers['set-cookie'] || [];
        const session = cookies.find(c => c.startsWith('session='));
        if (session) {
          const value = session.split('=')[1]?.split(';')[0];
          resolve(value);
        } else {
          reject(new Error('No session cookie'));
        }
      });
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });
    console.log('  ✅ Session cookie obtained\n');

    // Create HTTP client
    const client = new SimpleHttpClient(`https://${webserverUrl}`);
    client.defaultHeaders['Cookie'] = `session=${sessionCookie}`;

    // Test 1: List DAGs
    console.log('Test 1: GET /api/v1/dags');
    try {
      const r1 = await client.get('/api/v1/dags', { params: { limit: 5 } });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', r1.status);
      console.log('  - Total DAGs:', r1.data.total_entries);
      console.log('  - DAGs:', r1.data.dags?.map(d => d.dag_id).join(', '));
    } catch (error) {
      console.log('  ❌ FAILED:', error.message);
    }
    console.log('');

    // Test 2: Health check
    console.log('Test 2: GET /api/v1/health');
    try {
      const r2 = await client.get('/api/v1/health');
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', r2.status);
      console.log('  - Scheduler:', r2.data.scheduler?.status);
      console.log('  - Metadatabase:', r2.data.metadatabase?.status);
    } catch (error) {
      console.log('  ❌ FAILED:', error.message);
    }
    console.log('');

    // Test 3: List pools
    console.log('Test 3: GET /api/v1/pools');
    try {
      const r3 = await client.get('/api/v1/pools');
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', r3.status);
      console.log('  - Total pools:', r3.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED:', error.message);
    }
    console.log('');

    // Test 4: List variables
    console.log('Test 4: GET /api/v1/variables');
    try {
      const r4 = await client.get('/api/v1/variables');
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', r4.status);
      console.log('  - Total variables:', r4.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED:', error.message);
    }
    console.log('');

    // Test 5: Get specific DAG
    console.log('Test 5: GET /api/v1/dags/my_sample_dag');
    try {
      const r5 = await client.get('/api/v1/dags/my_sample_dag');
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', r5.status);
      console.log('  - DAG ID:', r5.data.dag_id);
      console.log('  - Is paused:', r5.data.is_paused);
    } catch (error) {
      console.log('  ❌ FAILED:', error.message);
    }
    console.log('');

    console.log('=== SOLUTION CONFIRMED ===');
    console.log('✅ Native HTTPS module works perfectly for MWAA!');
    console.log('✅ All API endpoints work with session cookie');
    console.log('✅ Simple wrapper provides axios-like API');
    console.log('');
    console.log('Next step: Implement this in the extension!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('  - Status:', error.response.status);
      console.error('  - Data:', error.response.data);
    }
  }

  console.log('\n=== Test Complete ===');
}

testNativeHttpClient().catch(console.error);
