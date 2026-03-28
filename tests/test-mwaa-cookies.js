const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaAllCookies() {
  console.log('=== Testing MWAA with All Cookies ===\n');

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
    
    console.log('Web token obtained\n');

    // POST to login
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
    
    console.log('Login successful\n');
    
    const cookies = loginResponse.headers['set-cookie'] || [];
    console.log('All cookies received:');
    cookies.forEach(cookie => {
      const name = cookie.split('=')[0];
      const value = cookie.split('=')[1]?.split(';')[0];
      console.log(`  - ${name}: ${value?.substring(0, 20)}... (length: ${value?.length})`);
    });
    console.log('');

    // Test 1: Single session cookie
    console.log('Test 1: Using only session cookie');
    const sessionCookie = cookies.find(c => c.startsWith('session='));
    const sessionValue = sessionCookie?.split('=')[1]?.split(';')[0];
    
    try {
      const r1 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 'Cookie': `session=${sessionValue}` },
        params: { limit: 1 },
        timeout: 10000
      });
      console.log('  ✅ Success - Status:', r1.status);
    } catch (error) {
      console.log('  ❌ Failed - Status:', error.response?.status);
    }
    console.log('');

    // Test 2: All cookies
    console.log('Test 2: Using all cookies');
    const allCookies = cookies.map(c => c.split(';')[0]).join('; ');
    
    try {
      const r2 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
        headers: { 'Cookie': allCookies },
        params: { limit: 1 },
        timeout: 10000
      });
      console.log('  ✅ Success - Status:', r2.status);
      console.log('  - Total DAGs:', r2.data.total_entries);
    } catch (error) {
      console.log('  ❌ Failed - Status:', error.response?.status);
    }
    console.log('');

    // Test 3: With CSRF token if present
    console.log('Test 3: Checking for CSRF token in response');
    const csrfCookie = cookies.find(c => c.startsWith('csrf_'));
    if (csrfCookie) {
      console.log('  - CSRF cookie found:', csrfCookie.split('=')[0]);
      const csrfValue = csrfCookie.split('=')[1]?.split(';')[0];
      
      try {
        const r3 = await axios.get(`https://${webserverUrl}/api/v1/dags`, {
          headers: { 
            'Cookie': allCookies,
            'X-CSRFToken': csrfValue
          },
          params: { limit: 1 },
          timeout: 10000
        });
        console.log('  ✅ Success with CSRF - Status:', r3.status);
      } catch (error) {
        console.log('  ❌ Failed with CSRF - Status:', error.response?.status);
      }
    } else {
      console.log('  - No CSRF cookie found');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

testMwaaAllCookies().catch(console.error);
