const { fromIni } = require('@aws-sdk/credential-providers');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const fs = require('fs');
const os = require('os');

async function testSessionToken() {
  console.log('=== Testing Session Token Field Names ===\n');

  const credentialsPath = `${os.homedir()}/.aws/credentials`;
  const content = fs.readFileSync(credentialsPath, 'utf8');
  
  console.log('Checking credentials file for admin profile...\n');
  
  const adminSection = content.split('[admin]')[1]?.split('[')[0];
  if (adminSection) {
    console.log('Admin profile content:');
    console.log(adminSection.trim());
    console.log('\n');
    
    // Check field names
    const hasSessionToken = adminSection.includes('AWS_SESSION_TOKEN');
    const hasAwsSessionToken = adminSection.includes('aws_session_token');
    
    console.log('Field name analysis:');
    console.log('  - Has AWS_SESSION_TOKEN (uppercase):', hasSessionToken);
    console.log('  - Has aws_session_token (lowercase):', hasAwsSessionToken);
    console.log('\n');
    
    if (hasSessionToken && !hasAwsSessionToken) {
      console.log('⚠️  Issue found: Session token uses uppercase AWS_SESSION_TOKEN');
      console.log('   AWS SDK expects lowercase: aws_session_token');
      console.log('\n');
      console.log('Solution: Update ~/.aws/credentials to use lowercase field name');
    }
  }

  console.log('\n=== Test Complete ===');
}

testSessionToken().catch(console.error);
