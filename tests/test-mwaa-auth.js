const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaAuth() {
  console.log('=== Testing MWAA API Authentication ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Get session cookie
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
    
    console.log('Session cookie obtained\n');

    // Test with different header combinations
    const tests = [
      {
        name: 'Cookie only',
        headers: { 'Cookie': sessionCookie }
      },
      {
        name: 'Cookie + Bearer token',
        headers: { 
          'Cookie': sessionCookie,
          'Authorization': `Bearer ${webToken}`
        }
      },
      {
        name: 'Cookie + X-Auth-Request-Access-Token',
        headers: { 
          'Cookie': sessionCookie,
          'X-Auth-Request-Access-Token': webToken
        }
      }
    ];

    for (const test of tests) {
      console.log(`Testing: ${test.name}`);
      try {
        const dagResponse = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
          headers: test.headers,
          params: { limit: 1 },
          timeout: 5000
        });
        
        console.log(`  ✅ SUCCESS - Status: ${dagResponse.status}`);
        console.log(`  - DAGs count:`, dagResponse.data.total_entries);
        console.log('');
      } catch (error) {
        console.log(`  ❌ FAILED - Status: ${error.response?.status || 'N/A'}`);
        console.log(`  - Error: ${error.message}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('=== Test Complete ===');
}

testMwaaAuth().catch(console.error);
