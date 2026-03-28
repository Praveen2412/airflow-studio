const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const https = require('https');
const { URLSearchParams } = require('url');

async function testMwaaWithNativeHttps() {
  console.log('=== Testing MWAA with Native HTTPS Module ===\n');

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

    console.log('Step 1: Logging in...');
    
    // POST to login
    const loginData = new URLSearchParams({ token: webToken }).toString();
    
    const loginOptions = {
      hostname: webserverUrl,
      port: 443,
      path: '/aws_mwaa/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(loginData)
      }
    };

    const sessionCookie = await new Promise((resolve, reject) => {
      const req = https.request(loginOptions, (res) => {
        const cookies = res.headers['set-cookie'] || [];
        const session = cookies.find(c => c.startsWith('session='));
        if (session) {
          const value = session.split('=')[1]?.split(';')[0];
          resolve(value);
        } else {
          reject(new Error('No session cookie'));
        }
      });
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });

    console.log('  ✅ Session cookie obtained');
    console.log('  - Length:', sessionCookie.length);
    console.log('');

    console.log('Step 2: Testing API call with native https...');
    
    const apiOptions = {
      hostname: webserverUrl,
      port: 443,
      path: '/api/v1/dags?limit=5',
      method: 'GET',
      headers: {
        'Cookie': `session=${sessionCookie}`
      }
    };

    const apiResult = await new Promise((resolve, reject) => {
      const req = https.request(apiOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log('  ✅ SUCCESS!');
    console.log('  - Status:', apiResult.status);
    console.log('  - Total DAGs:', apiResult.data.total_entries);
    console.log('  - DAGs:', apiResult.data.dags?.map(d => d.dag_id));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

testMwaaWithNativeHttps().catch(console.error);
