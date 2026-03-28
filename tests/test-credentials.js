const { fromIni, fromNodeProviderChain } = require('@aws-sdk/credential-providers');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');

async function inspectCredentials() {
  console.log('=== Inspecting AWS Credentials ===\n');

  const region = 'us-east-2';
  const profile = 'admin';

  // Test 1: fromIni with profile
  console.log('Test 1: fromIni with profile "admin"');
  try {
    const credentials1 = fromIni({ profile });
    const stsClient1 = new STSClient({ region, credentials: credentials1 });
    const identity1 = await stsClient1.send(new GetCallerIdentityCommand({}));
    
    console.log('  ✅ SUCCESS');
    console.log('  - Account:', identity1.Account);
    console.log('  - UserId:', identity1.UserId);
    console.log('  - Arn:', identity1.Arn);
  } catch (error) {
    console.log('  ❌ FAILED');
    console.log('  - Error:', error.name, '-', error.message);
  }

  console.log('\n---\n');

  // Test 2: fromNodeProviderChain
  console.log('Test 2: fromNodeProviderChain (default)');
  try {
    const credentials2 = fromNodeProviderChain();
    const stsClient2 = new STSClient({ region, credentials: credentials2 });
    const identity2 = await stsClient2.send(new GetCallerIdentityCommand({}));
    
    console.log('  ✅ SUCCESS');
    console.log('  - Account:', identity2.Account);
    console.log('  - UserId:', identity2.UserId);
    console.log('  - Arn:', identity2.Arn);
  } catch (error) {
    console.log('  ❌ FAILED');
    console.log('  - Error:', error.name, '-', error.message);
  }

  console.log('\n---\n');

  // Test 3: SDK default
  console.log('Test 3: SDK default (no credentials specified)');
  try {
    const stsClient3 = new STSClient({ region });
    const identity3 = await stsClient3.send(new GetCallerIdentityCommand({}));
    
    console.log('  ✅ SUCCESS');
    console.log('  - Account:', identity3.Account);
    console.log('  - UserId:', identity3.UserId);
    console.log('  - Arn:', identity3.Arn);
  } catch (error) {
    console.log('  ❌ FAILED');
    console.log('  - Error:', error.name, '-', error.message);
  }

  console.log('\n---\n');

  // Test 4: AWS_PROFILE env var
  console.log('Test 4: AWS_PROFILE environment variable');
  try {
    process.env.AWS_PROFILE = profile;
    const stsClient4 = new STSClient({ region });
    const identity4 = await stsClient4.send(new GetCallerIdentityCommand({}));
    
    console.log('  ✅ SUCCESS');
    console.log('  - Account:', identity4.Account);
    console.log('  - UserId:', identity4.UserId);
    console.log('  - Arn:', identity4.Arn);
    
    delete process.env.AWS_PROFILE;
  } catch (error) {
    console.log('  ❌ FAILED');
    console.log('  - Error:', error.name, '-', error.message);
    delete process.env.AWS_PROFILE;
  }

  console.log('\n=== Inspection Complete ===');
}

inspectCredentials().catch(console.error);
