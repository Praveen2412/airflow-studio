const axios = require('axios');

const baseURL = 'https://cc13-2a02-6ea0-5601-6475-00-11.ngrok-free.app';
const username = 'admin';
const password = 'admin';

async function testAuth() {
  console.log('Testing Airflow Authentication...');
  console.log('Base URL:', baseURL);
  console.log('Username:', username);
  console.log('Password length:', password.length);
  console.log('---');

  // Test 1: Health endpoint (usually no auth required)
  try {
    console.log('\n1. Testing /api/v1/health (no auth)...');
    const healthResponse = await axios.get(`${baseURL}/api/v1/health`);
    console.log('✓ Health check passed:', healthResponse.status);
  } catch (error) {
    console.log('✗ Health check failed:', error.response?.status, error.message);
  }

  // Test 2: DAGs endpoint with Basic Auth
  try {
    console.log('\n2. Testing /api/v1/dags with Basic Auth...');
    const dagsResponse = await axios.get(`${baseURL}/api/v1/dags?limit=10`, {
      auth: {
        username: username,
        password: password
      }
    });
    console.log('✓ DAGs list passed:', dagsResponse.status);
    console.log('  DAGs count:', dagsResponse.data.dags?.length || 0);
  } catch (error) {
    console.log('✗ DAGs list failed:', error.response?.status, error.response?.statusText);
    console.log('  Error details:', error.response?.data);
  }

  // Test 3: Variables endpoint with Basic Auth
  try {
    console.log('\n3. Testing /api/v1/variables with Basic Auth...');
    const varsResponse = await axios.get(`${baseURL}/api/v1/variables?limit=10`, {
      auth: {
        username: username,
        password: password
      }
    });
    console.log('✓ Variables list passed:', varsResponse.status);
    console.log('  Variables count:', varsResponse.data.variables?.length || 0);
  } catch (error) {
    console.log('✗ Variables list failed:', error.response?.status, error.response?.statusText);
    console.log('  Error details:', error.response?.data);
  }

  // Test 4: Check what auth header is being sent
  console.log('\n4. Checking Authorization header...');
  const authString = Buffer.from(`${username}:${password}`).toString('base64');
  console.log('  Expected Authorization header:', `Basic ${authString}`);
}

testAuth().catch(console.error);
