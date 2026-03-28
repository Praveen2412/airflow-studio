const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaExactFormat() {
  console.log('=== Testing MWAA with Exact Cookie Format ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;

    // Login
    const params = new URLSearchParams();
    params.append('token', webToken);
    
    const loginResponse = await axios.post(
      `https://${webserverUrl}/aws_mwaa/login`,
      params.toString(),
      { 
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000 
      }
    );
    
    const cookies = loginResponse.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    
    // Extract ONLY the value, no parsing
    const fullCookie = sessionCookie.split(';')[0]; // "session=value"
    const sessionValue = sessionCookie.split('=')[1]?.split(';')[0];
    
    console.log('Cookie info:');
    console.log('  - Full cookie:', fullCookie);
    console.log('  - Session value:', sessionValue);
    console.log('  - Value length:', sessionValue?.length);
    console.log('  - Has dots:', sessionValue?.includes('.'));
    console.log('  - Has dashes:', sessionValue?.includes('-'));
    console.log('');

    // Test 1: Using full cookie string
    console.log('Test 1: Using full cookie string');
    try {
      const r1 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 
          'Cookie': fullCookie  // Use full "session=value" string
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', r1.status);
      console.log('  - Total DAGs:', r1.data.total_entries);
      console.log('  - DAGs:', r1.data.dags?.map(d => d.dag_id));
    } catch (error) {
      console.log('  ❌ Failed - Status:', error.response?.status);
    }
    console.log('');

    // Test 2: Manual construction
    console.log('Test 2: Manual construction session=value');
    try {
      const r2 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', r2.status);
      console.log('  - Total DAGs:', r2.data.total_entries);
    } catch (error) {
      console.log('  ❌ Failed - Status:', error.response?.status);
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

testMwaaExactFormat().catch(console.error);
