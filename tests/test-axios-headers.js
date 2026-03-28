const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testAxiosHeaders() {
  console.log('=== Testing Axios with Different Header Configurations ===\n');

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

    // Test 1: Axios with ONLY Cookie header (like native https)
    console.log('Test 1: Axios with ONLY Cookie header...');
    try {
      const response1 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', response1.status);
      console.log('  - Total DAGs:', response1.data.total_entries);
      console.log('  - Headers sent:', Object.keys(response1.config.headers));
    } catch (error) {
      console.log('  ❌ FAILED');
      console.log('  - Status:', error.response?.status);
      console.log('  - Headers sent:', Object.keys(error.config.headers));
    }
    console.log('');

    // Test 2: Axios with Cookie + Accept header
    console.log('Test 2: Axios with Cookie + Accept header...');
    try {
      const response2 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 
          'Cookie': `session=${sessionValue}`,
          'Accept': 'application/json'
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', response2.status);
      console.log('  - Total DAGs:', response2.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED');
      console.log('  - Status:', error.response?.status);
    }
    console.log('');

    // Test 3: Axios with Cookie + Content-Type
    console.log('Test 3: Axios with Cookie + Content-Type: application/json...');
    try {
      const response3 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 
          'Cookie': `session=${sessionValue}`,
          'Content-Type': 'application/json'
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', response3.status);
      console.log('  - Total DAGs:', response3.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED');
      console.log('  - Status:', error.response?.status);
      console.log('  - This is the problem!');
    }
    console.log('');

    // Test 4: Create axios instance with default Content-Type
    console.log('Test 4: Axios instance with default Content-Type...');
    const axiosWithDefaults = axios.create({
      baseURL: `https://${webserverUrl}`,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    try {
      const response4 = await axiosWithDefaults.get('/api/v1/dags', {
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', response4.status);
      console.log('  - Total DAGs:', response4.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED');
      console.log('  - Status:', error.response?.status);
      console.log('  - Default Content-Type causes 401!');
    }
    console.log('');

    // Test 5: Axios instance WITHOUT default Content-Type
    console.log('Test 5: Axios instance WITHOUT default Content-Type...');
    const axiosNoDefaults = axios.create({
      baseURL: `https://${webserverUrl}`
    });
    try {
      const response5 = await axiosNoDefaults.get('/api/v1/dags', {
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        params: { limit: 5 },
        timeout: 10000
      });
      console.log('  ✅ SUCCESS!');
      console.log('  - Status:', response5.status);
      console.log('  - Total DAGs:', response5.data.total_entries);
      console.log('  - This works!');
    } catch (error) {
      console.log('  ❌ FAILED');
      console.log('  - Status:', error.response?.status);
    }
    console.log('');

    console.log('=== CONCLUSION ===');
    console.log('The Content-Type: application/json header causes MWAA to reject cookie auth!');
    console.log('Solution: Do NOT set default Content-Type for MWAA cookie-based auth.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

testAxiosHeaders().catch(console.error);
