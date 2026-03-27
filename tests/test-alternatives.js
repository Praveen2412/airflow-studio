const axios = require('axios');

const baseURL = 'https://cc13-2a02-6ea0-5601-6475-00-11.ngrok-free.app';
const username = 'admin';
const password = 'admin';

async function testAlternatives() {
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
    
    console.log('Testing different approaches to change task state:\n');
    
    // Approach 1: PATCH with dry_run false
    console.log('1. PATCH with dry_run=false');
    try {
      const r1 = await axios.patch(
        `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
        { new_state: 'failed', dry_run: false },
        {
          headers: { 'Cookie': sessionCookies.join('; '), 'Content-Type': 'application/json' },
          validateStatus: () => true
        }
      );
      console.log('   Status:', r1.status, r1.statusText);
      console.log('   Response:', JSON.stringify(r1.data).substring(0, 100));
    } catch (e) {
      console.log('   Error:', e.message);
    }
    
    // Approach 2: PUT instead of PATCH
    console.log('\n2. PUT instead of PATCH');
    try {
      const r2 = await axios.put(
        `${baseURL}/api/v1/dags/${dagId}/dagRuns/${dagRunId}/taskInstances/${taskId}`,
        { new_state: 'failed' },
        {
          headers: { 'Cookie': sessionCookies.join('; '), 'Content-Type': 'application/json' },
          validateStatus: () => true
        }
      );
      console.log('   Status:', r2.status, r2.statusText);
    } catch (e) {
      console.log('   Error:', e.message);
    }
    
    // Approach 3: Check Airflow version and docs
    console.log('\n3. Checking Airflow version');
    const versionResp = await axios.get(`${baseURL}/api/v1/version`, {
      headers: { 'Cookie': sessionCookies.join('; ') },
      validateStatus: () => true
    });
    console.log('   Airflow version:', versionResp.data.version);
    console.log('   Git version:', versionResp.data.git_version);
    
    console.log('\n=== IMPORTANT ===');
    console.log('According to Airflow 2.x documentation:');
    console.log('- PATCH /taskInstances/{task_id} only works for tasks in certain states');
    console.log('- To force a state change, you may need to:');
    console.log('  1. Clear the task first (POST /clearTaskInstances)');
    console.log('  2. Then set the state');
    console.log('- Or use the Airflow CLI: airflow tasks set-state');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testAlternatives();
