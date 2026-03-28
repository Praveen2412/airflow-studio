const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaWebToken() {
  console.log('=== Testing MWAA Web Token for API Access ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Get web token
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;
    
    console.log('Web token obtained');
    console.log('Token length:', webToken?.length);
    console.log('');

    // Test using web token directly as Bearer token
    console.log('Testing: Bearer token (web token directly)');
    try {
      const dagResponse = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 
          'Authorization': `Bearer ${webToken}`
        },
        params: { limit: 5 },
        timeout: 10000
      });
      
      console.log(`  ✅ SUCCESS - Status: ${dagResponse.status}`);
      console.log(`  - Total DAGs:`, dagResponse.data.total_entries);
      console.log(`  - DAGs:`, dagResponse.data.dags?.map(d => d.dag_id));
      console.log('');
    } catch (error) {
      console.log(`  ❌ FAILED - Status: ${error.response?.status || 'N/A'}`);
      console.log(`  - Error: ${error.message}`);
      if (error.response?.data) {
        console.log(`  - Response:`, error.response.data);
      }
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('=== Test Complete ===');
}

testMwaaWebToken().catch(console.error);
