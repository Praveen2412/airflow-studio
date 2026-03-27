const axios = require('axios');

const baseURL = 'https://cc13-2a02-6ea0-5601-6475-00-11.ngrok-free.app';
const username = 'admin';
const password = 'admin';

async function testTaskStateResponse() {
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
    console.log('=== BEFORE STATE CHANGE ===');
    const beforeResponse = await axios.get(
      `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
      {
        headers: { 'Cookie': sessionCookies.join('; ') },
        validateStatus: () => true
      }
    );
    console.log('Current state:', beforeResponse.data.state);
    console.log('Current try_number:', beforeResponse.data.try_number);
    console.log('Current start_date:', beforeResponse.data.start_date);
    console.log('Current end_date:', beforeResponse.data.end_date);
    
    // Try to change state
    console.log('\n=== CHANGING STATE TO SUCCESS ===');
    const changeResponse = await axios.patch(
      `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
      { new_state: 'success' },
      {
        headers: {
          'Cookie': sessionCookies.join('; '),
          'Content-Type': 'application/json'
        },
        validateStatus: () => true
      }
    );
    
    console.log('PATCH Response Status:', changeResponse.status);
    console.log('PATCH Response Data:', JSON.stringify(changeResponse.data, null, 2));
    
    // Wait a bit for Airflow to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get state after change
    console.log('\n=== AFTER STATE CHANGE ===');
    const afterResponse = await axios.get(
      `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
      {
        headers: { 'Cookie': sessionCookies.join('; ') },
        validateStatus: () => true
      }
    );
    console.log('New state:', afterResponse.data.state);
    console.log('New try_number:', afterResponse.data.try_number);
    console.log('New start_date:', afterResponse.data.start_date);
    console.log('New end_date:', afterResponse.data.end_date);
    
    if (beforeResponse.data.state === afterResponse.data.state) {
      console.log('\n⚠️  STATE DID NOT CHANGE!');
      console.log('This is an Airflow limitation - task states can only be changed for certain task states.');
      console.log('Running tasks cannot have their state changed via API.');
    } else {
      console.log('\n✓ STATE CHANGED SUCCESSFULLY!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testTaskStateResponse();
