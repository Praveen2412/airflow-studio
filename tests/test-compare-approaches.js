const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');
const https = require('https');

async function compareApproaches() {
  console.log('=== Comparing Cookie Handling Approaches ===\n');

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
    
    console.log('Session cookie:', sessionValue.substring(0, 20) + '...');
    console.log('');

    // Approach 1: Native HTTPS (we know this works)
    console.log('Approach 1: Native HTTPS');
    const nativeResult = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: webserverUrl,
        port: 443,
        path: '/api/v1/dags?limit=5',
        method: 'GET',
        headers: {
          'Cookie': `session=${sessionValue}`
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({ status: res.statusCode, data: data.substring(0, 100) });
        });
      });
      req.on('error', reject);
      req.end();
    });
    console.log('  Status:', nativeResult.status);
    console.log('  ✅ Works!');
    console.log('');

    // Approach 2: Axios with maxRedirects: 0
    console.log('Approach 2: Axios with maxRedirects: 0');
    const axiosNoRedirect = axios.create({
      baseURL: `https://${webserverUrl}`,
      maxRedirects: 0
    });
    delete axiosNoRedirect.defaults.headers.common['Accept'];
    delete axiosNoRedirect.defaults.headers.common['Content-Type'];
    delete axiosNoRedirect.defaults.headers.get['Accept'];
    delete axiosNoRedirect.defaults.headers.get['Content-Type'];
    
    try {
      const r2 = await axiosNoRedirect.get('/api/v1/dags', {
        headers: { 'Cookie': `session=${sessionValue}` },
        params: { limit: 5 }
      });
      console.log('  Status:', r2.status);
      console.log('  ✅ Works!');
    } catch (error) {
      console.log('  Status:', error.response?.status);
      console.log('  ❌ Failed');
    }
    console.log('');

    // Approach 3: Axios with validateStatus
    console.log('Approach 3: Axios with validateStatus accepting all');
    const axiosNoValidate = axios.create({
      baseURL: `https://${webserverUrl}`,
      validateStatus: () => true
    });
    delete axiosNoValidate.defaults.headers.common['Accept'];
    delete axiosNoValidate.defaults.headers.common['Content-Type'];
    delete axiosNoValidate.defaults.headers.get['Accept'];
    delete axiosNoValidate.defaults.headers.get['Content-Type'];
    
    const r3 = await axiosNoValidate.get('/api/v1/dags', {
      headers: { 'Cookie': `session=${sessionValue}` },
      params: { limit: 5 }
    });
    console.log('  Status:', r3.status);
    if (r3.status === 200) {
      console.log('  ✅ Works!');
    } else {
      console.log('  ❌ Failed');
      console.log('  Response:', r3.data);
    }
    console.log('');

    // Approach 4: Axios with httpAgent
    console.log('Approach 4: Axios with custom httpAgent');
    const axiosWithAgent = axios.create({
      baseURL: `https://${webserverUrl}`,
      httpsAgent: new https.Agent({ keepAlive: false })
    });
    delete axiosWithAgent.defaults.headers.common['Accept'];
    delete axiosWithAgent.defaults.headers.common['Content-Type'];
    delete axiosWithAgent.defaults.headers.get['Accept'];
    delete axiosWithAgent.defaults.headers.get['Content-Type'];
    
    try {
      const r4 = await axiosWithAgent.get('/api/v1/dags', {
        headers: { 'Cookie': `session=${sessionValue}` },
        params: { limit: 5 }
      });
      console.log('  Status:', r4.status);
      console.log('  ✅ Works!');
    } catch (error) {
      console.log('  Status:', error.response?.status);
      console.log('  ❌ Failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

compareApproaches().catch(console.error);
