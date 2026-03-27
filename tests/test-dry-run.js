const axios = require('axios');

const baseURL = 'https://cc13-2a02-6ea0-5601-6475-00-11.ngrok-free.app';
const username = 'admin';
const password = 'admin';

async function testWithDryRun() {
  try {
    // Login
    const loginPageResponse = await axios.get(`${baseURL}/login/`, {
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    const cookies = loginPageResponse.headers['set-cookie'];
    const csrfMatch = loginPageResponse.data.match(/name="csrf_token"[^>]*value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    
    const loginData = new URLSearchParams({
      username,
      password,
      csrf_token: csrfToken
    });
    
    const loginResponse = await axios.post(`${baseURL}/login/`, loginData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
        'Referer': `${baseURL}/login/`
      },
      maxRedirects: 0,
      validateStatus: () => true
    });
    
    const sessionCookies = loginResponse.headers['set-cookie'] || cookies;
    
    const dagId = 'dataset_consumes_1';
    const dagRunId = 'manual__2026-03-27T21:29:49.664298+00:00';
    const taskId = 'consuming_1';
    
    // Get current state
    console.log('=== CURRENT STATE ===');
    const beforeResponse = await axios.get(
      `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
      {
        headers: { 'Cookie': sessionCookies.join('; ') },
        validateStatus: () => true
      }
    );
    console.log('State:', beforeResponse.data.state);
    
    // Try with dry_run: false explicitly
    console.log('\n=== TRYING WITH dry_run: false ===');
    const changeResponse = await axios.patch(
      `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
      { 
        dry_run: false,
        new_state: 'failed'
      },
      {
        headers: {
          'Cookie': sessionCookies.join('; '),
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      }
    );
    
    console.log('Response Status:', changeResponse.status);
    console.log('Response Data:', JSON.stringify(changeResponse.data, null, 2));
    
    // Wait and check
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('\n=== AFTER CHANGE ===');
    const afterResponse = await axios.get(
      `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
      {
        headers: { 'Cookie': sessionCookies.join('; ') },
        validateStatus: () => true
      }
    );
    console.log('State:', afterResponse.data.state);
    
    if (beforeResponse.data.state !== afterResponse.data.state) {
      console.log('\n✓ STATE CHANGED!');
    } else {
      console.log('\n✗ State did not change');
      console.log('This confirms the API limitation exists');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testWithDryRun();
