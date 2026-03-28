const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaCorrectFlow() {
  console.log('=== Testing MWAA Authentication (AWS Docs Method) ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Step 1: Get web token
    console.log('Step 1: Getting web login token...');
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;
    
    console.log('  ✅ Token obtained');
    console.log('  - Webserver:', webserverUrl);
    console.log('  - Token length:', webToken?.length);
    console.log('');

    // Step 2: POST to login endpoint (Airflow 2.x)
    console.log('Step 2: POSTing to /aws_mwaa/login (Airflow 2.x)...');
    const loginResponse = await axios.post(
      `https://${webserverUrl}/aws_mwaa/login`,
      { token: webToken },
      { timeout: 10000 }
    );
    
    console.log('  ✅ Login successful');
    console.log('  - Status:', loginResponse.status);
    
    const cookies = loginResponse.headers['set-cookie'] || [];
    console.log('  - Cookies:', cookies.map(c => c.split('=')[0]));
    
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    if (!sessionCookie) {
      console.log('  ❌ No session cookie found!');
      return;
    }
    
    const sessionValue = sessionCookie.split('=')[1]?.split(';')[0];
    console.log('  - Session value length:', sessionValue?.length);
    console.log('');

    // Step 3: Test API call with session cookie
    console.log('Step 3: Testing API call with session cookie...');
    const dagResponse = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
      headers: { 
        'Cookie': `session=${sessionValue}`
      },
      params: { limit: 5 },
      timeout: 10000
    });
    
    console.log('  ✅ API call successful!');
    console.log('  - Status:', dagResponse.status);
    console.log('  - Total DAGs:', dagResponse.data.total_entries);
    console.log('  - DAGs:', dagResponse.data.dags?.map(d => d.dag_id));
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('  - Status:', error.response.status);
      console.error('  - Data:', error.response.data);
    }
  }

  console.log('=== Test Complete ===');
}

testMwaaCorrectFlow().catch(console.error);
