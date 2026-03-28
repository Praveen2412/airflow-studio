const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni } = require('@aws-sdk/credential-providers');
const axios = require('axios');

async function debugAxiosRequest() {
  console.log('=== Debugging Axios Request Headers ===\n');

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
    
    console.log('Session cookie value:', sessionValue);
    console.log('Session cookie length:', sessionValue.length);
    console.log('');

    // Create axios instance with request interceptor to log headers
    const axiosDebug = axios.create({
      baseURL: `https://${webserverUrl}`
    });
    
    // Delete default headers
    delete axiosDebug.defaults.headers.common['Accept'];
    delete axiosDebug.defaults.headers.common['Content-Type'];
    delete axiosDebug.defaults.headers.get['Accept'];
    delete axiosDebug.defaults.headers.get['Content-Type'];

    // Add request interceptor to log what's being sent
    axiosDebug.interceptors.request.use(request => {
      console.log('=== Axios Request ===');
      console.log('URL:', request.url);
      console.log('Method:', request.method);
      console.log('Headers:', JSON.stringify(request.headers, null, 2));
      console.log('');
      return request;
    });

    // Add response interceptor to log response
    axiosDebug.interceptors.response.use(
      response => {
        console.log('=== Axios Response ===');
        console.log('Status:', response.status);
        console.log('');
        return response;
      },
      error => {
        console.log('=== Axios Error ===');
        console.log('Status:', error.response?.status);
        console.log('Response headers:', error.response?.headers);
        console.log('');
        return Promise.reject(error);
      }
    );

    // Test request
    console.log('Making request to /api/v1/dags...\n');
    try {
      const result = await axiosDebug.get('/api/v1/dags', {
        headers: { 
          'Cookie': `session=${sessionValue}`
        },
        params: { limit: 5 }
      });
      console.log('✅ SUCCESS!');
      console.log('Total DAGs:', result.data.total_entries);
    } catch (error) {
      console.log('❌ FAILED');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

debugAxiosRequest().catch(console.error);
