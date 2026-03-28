const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaLogin() {
  console.log('=== Testing MWAA Login Flow ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Step 1: Get web login token
    console.log('Step 1: Getting MWAA web login token...');
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;
    
    console.log('  ✅ Token received');
    console.log('  - WebserverUrl:', webserverUrl);
    console.log('  - Token length:', webToken?.length);
    console.log('');

    // Step 2: Test different login paths
    const loginPaths = [
      '/aws_mwaa/aws-console-sso',
      '/aws_mwaa/login',
      '/login',
      '/api/v1/login',
      '/pluginsv2/aws_mwaa/login'
    ];

    console.log('Step 2: Testing login endpoints...\n');

    for (const path of loginPaths) {
      try {
        console.log(`Testing: https://${webserverUrl}${path}`);
        const loginResponse = await axios.get(`https://${webserverUrl}${path}`, {
          params: { token: webToken },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
          timeout: 5000
        });
        
        console.log(`  ✅ SUCCESS - Status: ${loginResponse.status}`);
        console.log(`  - Headers:`, Object.keys(loginResponse.headers));
        
        const cookies = loginResponse.headers['set-cookie'] || [];
        console.log(`  - Cookies:`, cookies.map(c => c.split('=')[0]));
        console.log('');
      } catch (error) {
        console.log(`  ❌ FAILED - Status: ${error.response?.status || 'N/A'} - ${error.message}`);
        console.log('');
      }
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('=== Test Complete ===');
}

testMwaaLogin().catch(console.error);
