const { MWAAClient, CreateWebLoginTokenCommand } = require('@aws-sdk/client-mwaa');
const { fromIni, fromNodeProviderChain } = require('@aws-sdk/credential-providers');

async function testAwsProfile() {
  console.log('=== Testing AWS Profile Credential Loading ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  // Test 1: Using fromIni with profile
  console.log('Test 1: Using fromIni with profile "admin"');
  try {
    const credentials1 = fromIni({ profile });
    const client1 = new MWAAClient({ region, credentials: credentials1 });
    
    console.log('  - Client created successfully');
    console.log('  - Attempting to call CreateWebLoginToken...');
    
    const command1 = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response1 = await client1.send(command1);
    
    console.log('  ✅ SUCCESS with fromIni!');
    console.log('  - WebServerHostname:', response1.WebServerHostname);
    console.log('  - WebToken length:', response1.WebToken?.length || 0);
  } catch (error) {
    console.log('  ❌ FAILED with fromIni');
    console.log('  - Error name:', error.name);
    console.log('  - Error message:', error.message);
  }

  console.log('\n---\n');

  // Test 2: Using fromNodeProviderChain (default)
  console.log('Test 2: Using fromNodeProviderChain (default)');
  try {
    const credentials2 = fromNodeProviderChain();
    const client2 = new MWAAClient({ region, credentials: credentials2 });
    
    console.log('  - Client created successfully');
    console.log('  - Attempting to call CreateWebLoginToken...');
    
    const command2 = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response2 = await client2.send(command2);
    
    console.log('  ✅ SUCCESS with fromNodeProviderChain!');
    console.log('  - WebServerHostname:', response2.WebServerHostname);
    console.log('  - WebToken length:', response2.WebToken?.length || 0);
  } catch (error) {
    console.log('  ❌ FAILED with fromNodeProviderChain');
    console.log('  - Error name:', error.name);
    console.log('  - Error message:', error.message);
  }

  console.log('\n---\n');

  // Test 3: No credentials specified (SDK default)
  console.log('Test 3: No credentials specified (SDK default behavior)');
  try {
    const client3 = new MWAAClient({ region });
    
    console.log('  - Client created successfully');
    console.log('  - Attempting to call CreateWebLoginToken...');
    
    const command3 = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response3 = await client3.send(command3);
    
    console.log('  ✅ SUCCESS with SDK default!');
    console.log('  - WebServerHostname:', response3.WebServerHostname);
    console.log('  - WebToken length:', response3.WebToken?.length || 0);
  } catch (error) {
    console.log('  ❌ FAILED with SDK default');
    console.log('  - Error name:', error.name);
    console.log('  - Error message:', error.message);
  }

  console.log('\n---\n');

  // Test 4: Set AWS_PROFILE environment variable
  console.log('Test 4: Using AWS_PROFILE environment variable');
  try {
    process.env.AWS_PROFILE = profile;
    const client4 = new MWAAClient({ region });
    
    console.log('  - Client created successfully');
    console.log('  - AWS_PROFILE set to:', process.env.AWS_PROFILE);
    console.log('  - Attempting to call CreateWebLoginToken...');
    
    const command4 = new CreateWebLoginTokenCommand({ Name: environmentName });
    const response4 = await client4.send(command4);
    
    console.log('  ✅ SUCCESS with AWS_PROFILE env var!');
    console.log('  - WebServerHostname:', response4.WebServerHostname);
    console.log('  - WebToken length:', response4.WebToken?.length || 0);
    
    delete process.env.AWS_PROFILE;
  } catch (error) {
    console.log('  ❌ FAILED with AWS_PROFILE env var');
    console.log('  - Error name:', error.name);
    console.log('  - Error message:', error.message);
    delete process.env.AWS_PROFILE;
  }

  console.log('\n=== Test Complete ===');
}

testAwsProfile().catch(console.error);
