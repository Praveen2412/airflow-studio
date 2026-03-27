const axios = require('axios');

const baseURL = 'https://cc13-2a02-6ea0-5601-6475-00-11.ngrok-free.app';
const username = 'admin';
const password = 'admin';

// Create axios instance with cookie jar support
const axiosWithCookies = axios.create({
  baseURL: baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

async function testBasicAuth() {
  console.log('\n=== TEST 1: Basic Auth ===');
  try {
    const response = await axios.get(`${baseURL}/api/v1/dags?limit=5`, {
      auth: {
        username: username,
        password: password
      }
    });
    console.log('✓ Basic Auth WORKS!');
    console.log('  Status:', response.status);
    console.log('  DAGs count:', response.data.dags?.length || 0);
    return true;
  } catch (error) {
    console.log('✗ Basic Auth failed:', error.response?.status, error.response?.statusText);
    return false;
  }
}

async function testSessionAuth() {
  console.log('\n=== TEST 2: Session Auth (Login + Cookie) ===');
  try {
    // Step 1: Login to get session cookie
    console.log('  Step 1: Logging in...');
    const loginResponse = await axiosWithCookies.post('/login/', 
      `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      }
    );
    
    const cookies = loginResponse.headers['set-cookie'];
    console.log('  Login status:', loginResponse.status);
    console.log('  Cookies received:', cookies ? 'Yes' : 'No');
    
    if (!cookies) {
      console.log('✗ No cookies received from login');
      return false;
    }

    // Step 2: Use session cookie to access API
    console.log('  Step 2: Accessing API with session cookie...');
    const apiResponse = await axios.get(`${baseURL}/api/v1/dags?limit=5`, {
      headers: {
        'Cookie': cookies.join('; ')
      }
    });
    
    console.log('✓ Session Auth WORKS!');
    console.log('  Status:', apiResponse.status);
    console.log('  DAGs count:', apiResponse.data.dags?.length || 0);
    return true;
  } catch (error) {
    console.log('✗ Session Auth failed:', error.response?.status, error.message);
    return false;
  }
}

async function testJWTAuth() {
  console.log('\n=== TEST 3: JWT Token Auth (Airflow 3.x) ===');
  try {
    // Step 1: Get JWT token
    console.log('  Step 1: Getting JWT token...');
    const tokenResponse = await axios.post(`${baseURL}/auth/token`,
      new URLSearchParams({
        username: username,
        password: password
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    
    const token = tokenResponse.data.access_token;
    console.log('  Token received:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('✗ No token received');
      return false;
    }

    // Step 2: Use JWT token to access API
    console.log('  Step 2: Accessing API with JWT token...');
    const apiResponse = await axios.get(`${baseURL}/api/v1/dags?limit=5`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✓ JWT Auth WORKS!');
    console.log('  Status:', apiResponse.status);
    console.log('  DAGs count:', apiResponse.data.dags?.length || 0);
    return true;
  } catch (error) {
    console.log('✗ JWT Auth failed:', error.response?.status, error.message);
    return false;
  }
}

async function testCSRFSessionAuth() {
  console.log('\n=== TEST 4: Session Auth with CSRF Token ===');
  try {
    // Step 1: Get CSRF token from login page
    console.log('  Step 1: Getting CSRF token...');
    const loginPageResponse = await axiosWithCookies.get('/login/');
    const loginPageHtml = loginPageResponse.data;
    
    // Extract CSRF token from HTML
    const csrfMatch = loginPageHtml.match(/name="csrf_token"[^>]*value="([^"]+)"/);
    const csrfToken = csrfMatch ? csrfMatch[1] : null;
    const cookies = loginPageResponse.headers['set-cookie'];
    
    console.log('  CSRF token found:', csrfToken ? 'Yes' : 'No');
    console.log('  Cookies received:', cookies ? 'Yes' : 'No');
    
    if (!csrfToken) {
      console.log('✗ No CSRF token found');
      return false;
    }

    // Step 2: Login with CSRF token
    console.log('  Step 2: Logging in with CSRF token...');
    const loginResponse = await axios.post(`${baseURL}/login/`,
      `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&csrf_token=${encodeURIComponent(csrfToken)}`,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies.join('; ')
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400
      }
    );
    
    const sessionCookies = loginResponse.headers['set-cookie'] || cookies;
    console.log('  Login status:', loginResponse.status);
    
    // Step 3: Use session cookie to access API
    console.log('  Step 3: Accessing API with session cookie...');
    const apiResponse = await axios.get(`${baseURL}/api/v1/dags?limit=5`, {
      headers: {
        'Cookie': sessionCookies.join('; ')
      }
    });
    
    console.log('✓ Session Auth with CSRF WORKS!');
    console.log('  Status:', apiResponse.status);
    console.log('  DAGs count:', apiResponse.data.dags?.length || 0);
    return true;
  } catch (error) {
    console.log('✗ Session Auth with CSRF failed:', error.response?.status, error.message);
    return false;
  }
}

async function testNoAuth() {
  console.log('\n=== TEST 5: No Auth (Open Access) ===');
  try {
    const response = await axios.get(`${baseURL}/api/v1/dags?limit=5`);
    console.log('✓ No Auth WORKS! (API is open)');
    console.log('  Status:', response.status);
    console.log('  DAGs count:', response.data.dags?.length || 0);
    return true;
  } catch (error) {
    console.log('✗ No Auth failed:', error.response?.status);
    return false;
  }
}

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Airflow Authentication Backend Detection                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\nBase URL:', baseURL);
  console.log('Username:', username);
  console.log('Password:', '***' + password.slice(-2));
  console.log('\nTesting different authentication methods...\n');

  const results = {
    basicAuth: await testBasicAuth(),
    sessionAuth: await testSessionAuth(),
    jwtAuth: await testJWTAuth(),
    csrfSessionAuth: await testCSRFSessionAuth(),
    noAuth: await testNoAuth()
  };

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  RESULTS SUMMARY                                           ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('\n  Basic Auth:              ', results.basicAuth ? '✓ WORKS' : '✗ Failed');
  console.log('  Session Auth:            ', results.sessionAuth ? '✓ WORKS' : '✗ Failed');
  console.log('  JWT Auth (Airflow 3.x):  ', results.jwtAuth ? '✓ WORKS' : '✗ Failed');
  console.log('  Session + CSRF:          ', results.csrfSessionAuth ? '✓ WORKS' : '✗ Failed');
  console.log('  No Auth:                 ', results.noAuth ? '✓ WORKS' : '✗ Failed');

  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║  RECOMMENDATION                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (results.basicAuth) {
    console.log('  ✓ Your Airflow supports Basic Auth');
    console.log('  → The extension should work as-is');
  } else if (results.jwtAuth) {
    console.log('  ✓ Your Airflow supports JWT tokens (Airflow 3.x)');
    console.log('  → The extension should work with API v2 mode');
  } else if (results.sessionAuth || results.csrfSessionAuth) {
    console.log('  ⚠ Your Airflow only supports Session-based auth');
    console.log('  → The extension needs to be updated to support session auth');
    console.log('  → Add this to airflow.cfg to enable Basic Auth:');
    console.log('     [api]');
    console.log('     auth_backends = airflow.api.auth.backend.basic_auth,airflow.api.auth.backend.session');
  } else if (results.noAuth) {
    console.log('  ⚠ Your Airflow has no authentication enabled');
    console.log('  → This is a security risk for production');
  } else {
    console.log('  ✗ Could not authenticate with any method');
    console.log('  → Check your credentials and Airflow configuration');
  }

  console.log('\n');
}

runAllTests().catch(console.error);
