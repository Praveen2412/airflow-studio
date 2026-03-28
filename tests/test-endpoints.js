const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testEndpoints() {
  console.log('=== Testing Different Endpoints with Clean Axios ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Get web token and login
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;

    const params = new URLSearchParams();
    params.append('token', webToken);
    
    const loginResponse = await axios.post(
      `https://${webserverUrl}/aws_mwaa/login`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    
    const cookies = loginResponse.headers['set-cookie'] || [];
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    const sessionValue = sessionCookie.split('=')[1]?.split(';')[0];
    console.log('✅ Session cookie obtained\n');

    // Create clean axios instance
    const axiosClean = axios.create({
      baseURL: `https://${webserverUrl}`
    });
    
    delete axiosClean.defaults.headers.common['Accept'];
    delete axiosClean.defaults.headers.common['Content-Type'];
    delete axiosClean.defaults.headers.get['Accept'];
    delete axiosClean.defaults.headers.get['Content-Type'];

    // Test health endpoint
    console.log('Test 1: /api/v1/health');
    try {
      const r1 = await axiosClean.get('/api/v1/health', {
        headers: { 'Cookie': `session=${sessionValue}` }
      });
      console.log('  ✅ SUCCESS - Status:', r1.status);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
    }

    // Test dags endpoint WITHOUT params
    console.log('\nTest 2: /api/v1/dags (no params)');
    try {
      const r2 = await axiosClean.get('/api/v1/dags', {
        headers: { 'Cookie': `session=${sessionValue}` }
      });
      console.log('  ✅ SUCCESS - Status:', r2.status);
      console.log('  - Total DAGs:', r2.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
    }

    // Test dags endpoint WITH params
    console.log('\nTest 3: /api/v1/dags?limit=5');
    try {
      const r3 = await axiosClean.get('/api/v1/dags?limit=5', {
        headers: { 'Cookie': `session=${sessionValue}` }
      });
      console.log('  ✅ SUCCESS - Status:', r3.status);
      console.log('  - Total DAGs:', r3.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
    }

    // Test dags endpoint WITH params object
    console.log('\nTest 4: /api/v1/dags with params object');
    try {
      const r4 = await axiosClean.get('/api/v1/dags', {
        headers: { 'Cookie': `session=${sessionValue}` },
        params: { limit: 5 }
      });
      console.log('  ✅ SUCCESS - Status:', r4.status);
      console.log('  - Total DAGs:', r4.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
    }

    // Test version endpoint
    console.log('\nTest 5: /api/v1/version');
    try {
      const r5 = await axiosClean.get('/api/v1/version', {
        headers: { 'Cookie': `session=${sessionValue}` }
      });
      console.log('  ✅ SUCCESS - Status:', r5.status);
      console.log('  - Version:', r5.data.version);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
    }

    // Test pools endpoint
    console.log('\nTest 6: /api/v1/pools');
    try {
      const r6 = await axiosClean.get('/api/v1/pools', {
        headers: { 'Cookie': `session=${sessionValue}` }
      });
      console.log('  ✅ SUCCESS - Status:', r6.status);
      console.log('  - Total pools:', r6.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
    }

    // Test variables endpoint
    console.log('\nTest 7: /api/v1/variables');
    try {
      const r7 = await axiosClean.get('/api/v1/variables', {
        headers: { 'Cookie': `session=${sessionValue}` }
      });
      console.log('  ✅ SUCCESS - Status:', r7.status);
      console.log('  - Total variables:', r7.data.total_entries);
    } catch (error) {
      console.log('  ❌ FAILED - Status:', error.response?.status);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

testEndpoints().catch(console.error);
