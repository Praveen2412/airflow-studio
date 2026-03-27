const axios = require('axios');

const baseURL = 'https://cc13-2a02-6ea0-5601-6475-00-11.ngrok-free.app';
const username = 'admin';
const password = 'admin';

async function debugLogin() {
  console.log('=== Debugging Airflow Login ===\n');

  try {
    // Step 1: Get login page
    console.log('Step 1: Getting login page...');
    const loginPageResponse = await axios.get(`${baseURL}/login/`, {
      maxRedirects: 5,
      validateStatus: () => true
    });
    
    console.log('  Status:', loginPageResponse.status);
    console.log('  Headers:', JSON.stringify(loginPageResponse.headers, null, 2));
    
    const cookies = loginPageResponse.headers['set-cookie'];
    console.log('  Cookies:', cookies);
    
    // Extract CSRF token
    const csrfMatch = loginPageResponse.data.match(/name="csrf_token"[^>]*value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    console.log('  CSRF Token:', csrfToken);

    if (!csrfToken || !cookies) {
      console.log('\n✗ Missing CSRF token or cookies');
      return;
    }

    // Step 2: Try to login
    console.log('\nStep 2: Attempting login...');
    
    const loginData = new URLSearchParams({
      username: username,
      password: password,
      csrf_token: csrfToken
    });
    
    console.log('  Login data:', loginData.toString());
    
    const loginResponse = await axios.post(`${baseURL}/login/`, loginData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies.join('; '),
        'Referer': `${baseURL}/login/`
      },
      maxRedirects: 0,
      validateStatus: () => true
    });
    
    console.log('  Status:', loginResponse.status);
    console.log('  Status Text:', loginResponse.statusText);
    console.log('  Headers:', JSON.stringify(loginResponse.headers, null, 2));
    
    if (loginResponse.status === 302 || loginResponse.status === 303) {
      console.log('  Redirect to:', loginResponse.headers.location);
      console.log('  ✓ Login appears successful (redirect)');
      
      const sessionCookies = loginResponse.headers['set-cookie'] || cookies;
      console.log('  Session cookies:', sessionCookies);
      
      // Step 3: Try to access API with session
      console.log('\nStep 3: Accessing API with session...');
      const apiResponse = await axios.get(`${baseURL}/api/v1/dags?limit=5`, {
        headers: {
          'Cookie': sessionCookies.join('; ')
        },
        validateStatus: () => true
      });
      
      console.log('  API Status:', apiResponse.status);
      if (apiResponse.status === 200) {
        console.log('  ✓ API access successful!');
        console.log('  DAGs count:', apiResponse.data.dags?.length || 0);
      } else {
        console.log('  ✗ API access failed');
        console.log('  Response:', apiResponse.data);
      }
    } else if (loginResponse.status === 200) {
      console.log('  ✗ Login failed (returned to login page)');
      console.log('  Response snippet:', loginResponse.data.substring(0, 500));
    } else {
      console.log('  ✗ Unexpected status');
      console.log('  Response:', loginResponse.data);
    }

  } catch (error) {
    console.log('\n✗ Error:', error.message);
    if (error.response) {
      console.log('  Status:', error.response.status);
      console.log('  Data:', error.response.data);
    }
  }
}

debugLogin();
