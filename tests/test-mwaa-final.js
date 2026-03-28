const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaWithCookiesParam() {
  console.log('=== Testing MWAA with Cookies Parameter (AWS Docs Method) ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Step 1: Get web token
    console.log('Step 1: Getting web token...');
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;
    console.log('  ✅ Token obtained\n');

    // Step 2: POST to login endpoint
    console.log('Step 2: Logging in...');
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
    const sessionValue = sessionCookie?.split('=')[1]?.split(';')[0];
    
    console.log('  ✅ Session cookie obtained');
    console.log('  - Cookie length:', sessionValue?.length);
    console.log('');

    // Step 3: Test with Cookie header (what we were doing)
    console.log('Step 3: Testing with Cookie header...');
    try {
      const r1 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 'Cookie': `session=${sessionValue}` },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ Success with Cookie header');
      console.log('  - Total DAGs:', r1.data.total_entries);
    } catch (error) {
      console.log('  ❌ Failed with Cookie header - Status:', error.response?.status);
    }
    console.log('');

    // Step 4: Test with jar/cookies parameter (AWS docs method)
    console.log('Step 4: Testing with jar parameter (AWS docs method)...');
    try {
      const r2 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        jar: true,
        withCredentials: true,
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ Success with jar parameter');
      console.log('  - Total DAGs:', r2.data.total_entries);
    } catch (error) {
      console.log('  ❌ Failed with jar - Status:', error.response?.status);
    }
    console.log('');

    // Step 5: Test POST request (trigger DAG)
    console.log('Step 5: Testing POST request (list DAG runs)...');
    try {
      const r3 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 
          'Cookie': `session=${sessionValue}`,
          'Content-Type': 'application/json'
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ Success');
      console.log('  - Total DAGs:', r3.data.total_entries);
      console.log('  - DAG IDs:', r3.data.dags?.map(d => d.dag_id));
      console.log('');
      
      // Try to get DAG runs for first DAG
      if (r3.data.dags && r3.data.dags.length > 0) {
        const firstDagId = r3.data.dags[0].dag_id;
        console.log(`  - Testing DAG runs for: ${firstDagId}`);
        
        const r4 = await axios.get(`https://${webserverUrl}/api/v1/dags/${firstDagId}/dagRuns`, {
          headers: { 
            'Cookie': `session=${sessionValue}`,
            'Content-Type': 'application/json'
          },
          params: { limit: 5 },
          timeout: 10000
        });
        console.log('  ✅ DAG runs retrieved');
        console.log('  - Total runs:', r4.data.total_entries);
      }
    } catch (error) {
      console.log('  ❌ Failed - Status:', error.response?.status);
      console.log('  - Error:', error.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('  - Status:', error.response.status);
      console.error('  - Data:', error.response.data);
    }
  }

  console.log('\n=== Test Complete ===');
}

testMwaaWithCookiesParam().catch(console.error);
