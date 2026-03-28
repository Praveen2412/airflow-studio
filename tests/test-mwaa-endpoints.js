const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaEndpoints() {
  console.log('=== Testing MWAA API Endpoints ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Step 1: Get token and login
    console.log('Step 1: Getting session cookie...');
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;
    
    const loginResponse = await axios.get(`https://${webserverUrl}/aws_mwaa/aws-console-sso`, {
      params: { token: webToken },
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400
    });
    
    const cookies = loginResponse.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.startsWith('session='))?.split(';')[0];
    
    console.log('  ✅ Session cookie obtained\n');

    // Step 2: Test different API endpoints
    const endpoints = [
      { path: '/api/v1/health', version: 'v1' },
      { path: '/api/v2/health', version: 'v2' },
      { path: '/health', version: 'unknown' },
      { path: '/api/v1/dags', version: 'v1' },
      { path: '/api/v2/dags', version: 'v2' },
      { path: '/api/v1/version', version: 'v1' }
    ];

    console.log('Step 2: Testing API endpoints...\n');

    for (const endpoint of endpoints) {
      try {
        const testResponse = await axios.get(`https://${webserverUrl}${endpoint.path}`, {
          headers: { 'Cookie': sessionCookie },
          timeout: 5000
        });
        
        console.log(`✅ ${endpoint.path} (${endpoint.version})`);
        console.log(`   Status: ${testResponse.status}`);
        if (endpoint.path.includes('version')) {
          console.log(`   Response:`, testResponse.data);
        }
        console.log('');
      } catch (error) {
        console.log(`❌ ${endpoint.path} (${endpoint.version})`);
        console.log(`   Status: ${error.response?.status || 'N/A'} - ${error.message}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('=== Test Complete ===');
}

testMwaaEndpoints().catch(console.error);
