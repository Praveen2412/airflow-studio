const axios = require('axios');

const baseURL = 'https://cc13-2a02-6ea0-5601-6475-00-11.ngrok-free.app';
const username = 'admin';
const password = 'admin';

async function testSetTaskState() {
  try {
    // Step 1: Login to get session
    console.log('Step 1: Getting session...');
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
    console.log('✓ Session obtained');
    
    // Step 2: Try to set task state
    console.log('\nStep 2: Setting task state...');
    const dagId = 'dataset_consumes_1';
    const dagRunId = 'manual__2026-03-27T21:29:49.664298+00:00';
    const taskId = 'consuming_1';
    
    // Try different payloads
    const payloads = [
      { new_state: 'success' },
      { state: 'success' },
      { dry_run: false, new_state: 'success' }
    ];
    
    for (const payload of payloads) {
      console.log(`\nTrying payload:`, JSON.stringify(payload));
      try {
        const response = await axios.patch(
          `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
          payload,
          {
            headers: {
              'Cookie': sessionCookies.join('; '),
              'Content-Type': 'application/json'
            },
            validateStatus: () => true
          }
        );
        
        console.log('  Status:', response.status);
        console.log('  Response:', JSON.stringify(response.data, null, 2));
        
        if (response.status === 200) {
          console.log('  ✓ SUCCESS!');
          break;
        }
      } catch (error) {
        console.log('  Error:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSetTaskState();
