const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function testMwaaWithHeaders() {
  console.log('=== Testing MWAA with Different POST Methods ===\n');

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

    // Test 1: POST with JSON
    console.log('Test 1: POST with JSON body');
    try {
      const r1 = await axios.post(
        `https://${webserverUrl}/aws_mwaa/login`,
        { token: webToken },
        { 
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000 
        }
      );
      console.log('  ✅ Success - Status:', r1.status);
      console.log('  - Cookies:', r1.headers['set-cookie']?.map(c => c.split('=')[0]));
      console.log('');
    } catch (error) {
      console.log('  ❌ Failed - Status:', error.response?.status);
      console.log('');
    }

    // Test 2: POST with form data
    console.log('Test 2: POST with form-urlencoded');
    try {
      const params = new URLSearchParams();
      params.append('token', webToken);
      
      const r2 = await axios.post(
        `https://${webserverUrl}/aws_mwaa/login`,
        params,
        { 
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000 
        }
      );
      console.log('  ✅ Success - Status:', r2.status);
      console.log('  - Cookies:', r2.headers['set-cookie']?.map(c => c.split('=')[0]));
      console.log('');
    } catch (error) {
      console.log('  ❌ Failed - Status:', error.response?.status);
      console.log('');
    }

    // Test 3: GET with query param
    console.log('Test 3: GET with query parameter');
    try {
      const r3 = await axios.get(
        `https://${webserverUrl}/aws_mwaa/login`,
        { 
          params: { token: webToken },
          timeout: 10000 
        }
      );
      console.log('  ✅ Success - Status:', r3.status);
      console.log('  - Cookies:', r3.headers['set-cookie']?.map(c => c.split('=')[0]));
      console.log('');
    } catch (error) {
      console.log('  ❌ Failed - Status:', error.response?.status);
      console.log('');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('=== Test Complete ===');
}

testMwaaWithHeaders().catch(console.error);
