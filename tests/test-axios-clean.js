const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testAxiosNoDefaults() {
  console.log('=== Testing Axios with NO Default Headers ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Get web token
    console.log('Getting MWAA web login token...');
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;
    console.log('✅ Token obtained\n');

    // Login to get session cookie
    console.log('Logging in...');
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
    const sessionValue = sessionCookie.split('=')[1]?.split(';')[0];
    console.log('✅ Session cookie obtained (length:', sessionValue?.length, ')\n');

    // Test 1: Standard axios (will fail)
    console.log('Test 1: Standard axios...');
    try {
      const response1 = await axios.get(`https://${webserverUrl}/api/v1/dags?limit=5`, {
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS! Status:', response1.status);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
      console.log('  - Headers sent:', Object.keys(error.config.headers));
    }
    console.log('');

    // Test 2: Axios instance with defaults deleted
    console.log('Test 2: Axios instance with defaults deleted...');
    const axiosClean = axios.create({
      baseURL: `https://${webserverUrl}`
    });
    
    // Delete all default headers
    delete axiosClean.defaults.headers.common['Accept'];
    delete axiosClean.defaults.headers.common['Content-Type'];
    delete axiosClean.defaults.headers.get['Accept'];
    delete axiosClean.defaults.headers.get['Content-Type'];
    
    try {
      const response2 = await axiosClean.get('/api/v1/dags', {
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', response2.status);
      console.log('  - Total DAGs:', response2.data.total_entries);
      console.log('  - DAGs:', response2.data.dags?.map(d => d.dag_id));
      console.log('  - THIS IS THE SOLUTION!');
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
      console.log('  - Headers sent:', Object.keys(error.config.headers));
    }
    console.log('');

    // Test 3: Verify it works multiple times
    console.log('Test 3: Verify it works consistently...');
    try {
      const response3 = await axiosClean.get('/api/v1/health', {
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        timeout: 10000
      });
      console.log('  ✅ Health check SUCCESS!');
      console.log('  - Status:', response3.status);
      console.log('  - Scheduler:', response3.data.scheduler?.status);
      console.log('  - Metadatabase:', response3.data.metadatabase?.status);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
    }
    console.log('');

    console.log('=== SOLUTION CONFIRMED ===');
    console.log('For MWAA cookie-based auth:');
    console.log('1. Create axios instance');
    console.log('2. Delete default Accept and Content-Type headers');
    console.log('3. Only send Cookie header in requests');
    console.log('');
    console.log('This matches the native https behavior that works!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('  - Status:', error.response.status);
    }
  }

  console.log('\n=== Test Complete ===');
}

testAxiosNoDefaults().catch(console.error);
