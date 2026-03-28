const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const https = require('https');

async function testSessionExpiry() {
  console.log('=== Testing Session Cookie Expiry ===\n');

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

    console.log('Step 1: Login and get session cookie');
    const loginData = new URLSearchParams({ token: webToken }).toString();
    
    const sessionCookie = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/aws_mwaa/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        const cookies = res.headers['set-cookie'] || [];
        const session = cookies.find(c => c.startsWith('session='));
        if (session) {
          const value = session.split('=')[1]?.split(';')[0];
          console.log('  ✅ Session cookie obtained:', value.substring(0, 20) + '...');
          console.log('  Full cookie header:', session);
          resolve(value);
        } else {
          reject(new Error('No session cookie'));
        }
      });
      req.on('error', reject);
      req.write(loginData);
      req.end();
    });
    console.log('');

    // Test immediately
    console.log('Step 2: Test API call IMMEDIATELY after login');
    const test1 = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/api/v1/dags?limit=5',
        method: 'GET',
        headers: {
          'Cookie': `session=${sessionCookie}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, data });
        });
      });
      req.on('error', reject);
      req.end();
    });
    console.log('  Status:', test1.status);
    if (test1.status === 200) {
      const json = JSON.parse(test1.data);
      console.log('  ✅ SUCCESS! Total DAGs:', json.total_entries);
    } else {
      console.log('  ❌ FAILED!');
      console.log('  Response:', test1.data.substring(0, 200));
    }
    console.log('');

    // Test again after 2 seconds
    console.log('Step 3: Test API call 2 seconds later with SAME cookie');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const test2 = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/api/v1/health',
        method: 'GET',
        headers: {
          'Cookie': `session=${sessionCookie}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, data });
        });
      });
      req.on('error', reject);
      req.end();
    });
    console.log('  Status:', test2.status);
    if (test2.status === 200) {
      console.log('  ✅ Cookie still valid!');
    } else {
      console.log('  ❌ Cookie expired!');
    }
    console.log('');

    // Test again after 5 more seconds
    console.log('Step 4: Test API call 5 more seconds later');
    await new Promise(resolve => setTimeout(resolve, 5000));
    const test3 = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/api/v1/pools',
        method: 'GET',
        headers: {
          'Cookie': `session=${sessionCookie}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, data });
        });
      });
      req.on('error', reject);
      req.end();
    });
    console.log('  Status:', test3.status);
    if (test3.status === 200) {
      console.log('  ✅ Cookie still valid!');
    } else {
      console.log('  ❌ Cookie expired!');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

testSessionExpiry().catch(console.error);
