const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const https = require('https');

async function testMwaaV2Support() {
  console.log('=== Testing MWAA API v2 Support ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    // Step 1: Get MWAA web token
    console.log('Step 1: Getting MWAA web login token...');
    const credentials = fromIni({ profile });
    const mwaaClient = new MWAAClient({ region, credentials });
    const command = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response = await mwaaClient.send(command);
    
    const webserverUrl = response.WebServerHostname;
    const webToken = response.WebToken;
    console.log('  ✅ Token obtained');
    console.log('  - Webserver:', webserverUrl);
    console.log('');

    // Step 2: Check Airflow version
    console.log('Step 2: Checking Airflow version...');
    const versionResult = await new Promise((resolve) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/api/v1/version',
        method: 'GET'
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        });
      });
      req.on('error', () => resolve({ status: 0, data: null }));
      req.end();
    });
    
    if (versionResult.status === 200) {
      console.log('  ✅ Version detected');
      console.log('  - Airflow version:', versionResult.data.version);
      console.log('  - Git version:', versionResult.data.git_version);
      
      const version = versionResult.data.version;
      const majorVersion = parseInt(version.split('.')[0]);
      console.log('  - Major version:', majorVersion);
      console.log('  - API version:', majorVersion >= 3 ? 'v2' : 'v1');
    }
    console.log('');

    // Step 3: Test API v2 endpoints availability
    console.log('Step 3: Testing API v2 endpoints...');
    
    // Test if /api/v2/dags exists
    const v2DagsTest = await new Promise((resolve) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/api/v2/dags',
        method: 'GET'
      }, (res) => {
        resolve({ status: res.statusCode });
      });
      req.on('error', () => resolve({ status: 0 }));
      req.end();
    });
    
    console.log('  - /api/v2/dags:', v2DagsTest.status === 401 ? '✅ Exists (needs auth)' : v2DagsTest.status === 404 ? '❌ Not found' : `Status ${v2DagsTest.status}`);
    console.log('');

    // Step 4: Test v2 login endpoint
    console.log('Step 4: Testing API v2 login endpoint...');
    const loginData = new URLSearchParams({ token: webToken }).toString();
    
    const v2LoginResult = await new Promise((resolve) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/pluginsv2/aws_mwaa/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(loginData)
        }
      }, (res) => {
        const cookies = res.headers['set-cookie'] || [];
        resolve({ 
          status: res.statusCode, 
          cookies,
          hasTokenCookie: cookies.some(c => c.startsWith('_token='))
        });
      });
      req.on('error', (error) => resolve({ status: 0, error: error.message }));
      req.write(loginData);
      req.end();
    });
    
    console.log('  - Status:', v2LoginResult.status);
    if (v2LoginResult.status === 200) {
      console.log('  ✅ v2 login endpoint exists!');
      console.log('  - Has _token cookie:', v2LoginResult.hasTokenCookie);
      if (v2LoginResult.hasTokenCookie) {
        const tokenCookie = v2LoginResult.cookies.find(c => c.startsWith('_token='));
        const tokenValue = tokenCookie.split('=')[1]?.split(';')[0];
        console.log('  - Token length:', tokenValue?.length);
        
        // Test API v2 with JWT token
        console.log('');
        console.log('Step 5: Testing API v2 with JWT token...');
        const v2ApiTest = await new Promise((resolve) => {
          const req = https.request({
            hostname: webserverUrl,
            port: 443,
            path: '/api/v2/dags?limit=5',
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${tokenValue}`,
              'Content-Type': 'application/json'
            }
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
              resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
            });
          });
          req.on('error', () => resolve({ status: 0 }));
          req.end();
        });
        
        console.log('  - Status:', v2ApiTest.status);
        if (v2ApiTest.status === 200) {
          console.log('  ✅ API v2 works!');
          console.log('  - Total DAGs:', v2ApiTest.data.total_entries);
        } else {
          console.log('  ❌ API v2 failed');
        }
      }
    } else if (v2LoginResult.status === 404) {
      console.log('  ❌ v2 login endpoint not found');
      console.log('  - This MWAA environment uses Airflow 2.x (API v1 only)');
    } else {
      console.log('  ⚠️  Unexpected status:', v2LoginResult.status);
    }
    console.log('');

    // Step 5: Test v1 login (should work)
    console.log('Step 6: Testing API v1 login (current implementation)...');
    const v1LoginResult = await new Promise((resolve) => {
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
        resolve({ 
          status: res.statusCode, 
          cookies,
          hasSessionCookie: cookies.some(c => c.startsWith('session='))
        });
      });
      req.on('error', (error) => resolve({ status: 0, error: error.message }));
      req.write(loginData);
      req.end();
    });
    
    console.log('  - Status:', v1LoginResult.status);
    if (v1LoginResult.status === 200) {
      console.log('  ✅ v1 login works!');
      console.log('  - Has session cookie:', v1LoginResult.hasSessionCookie);
    }
    console.log('');

    console.log('=== CONCLUSION ===');
    if (v2LoginResult.status === 404) {
      console.log('❌ This MWAA environment does NOT support API v2');
      console.log('✅ Current implementation (API v1) is correct');
      console.log('ℹ️  MWAA currently runs Airflow 2.8.1 which uses API v1');
      console.log('ℹ️  When MWAA upgrades to Airflow 3.x, we will need to:');
      console.log('   1. Detect API version');
      console.log('   2. Use /pluginsv2/aws_mwaa/login for v2');
      console.log('   3. Extract _token cookie instead of session');
      console.log('   4. Use Bearer token authentication');
    } else if (v2LoginResult.status === 200) {
      console.log('✅ This MWAA environment SUPPORTS API v2!');
      console.log('⚠️  Need to implement v2 support in MwaaClient');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

testMwaaV2Support().catch(console.error);
