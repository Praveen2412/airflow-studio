const { MwaaClient } = require('../out/api/MwaaClient');

async function testMwaaIntegration() {
  console.log('=== Testing MWAA Integration with New Implementation ===\n');

  const environmentName = 'Airflow-Vscode-Test';
  const region = 'us-east-2';
  const profile = 'admin';

  try {
    console.log('Step 1: Creating MwaaClient...');
    const client = new MwaaClient(environmentName, region, 'v1', profile);
    console.log('  ✅ MwaaClient created\n');

    console.log('Step 2: Testing listDags...');
    const dags = await client.listDags();
    console.log('  ✅ SUCCESS!');
    console.log('  - Total DAGs:', dags.length);
    dags.forEach(dag => {
      console.log(`    • ${dag.dagId} (${dag.paused ? 'paused' : 'active'})`);
    });
    console.log('');

    console.log('Step 3: Testing getHealth...');
    const health = await client.getHealth();
    console.log('  ✅ SUCCESS!');
    console.log('  - Scheduler:', health.scheduler?.status);
    console.log('  - Metadatabase:', health.metadatabase?.status);
    console.log('');

    console.log('Step 4: Testing listVariables...');
    const variables = await client.listVariables();
    console.log('  ✅ SUCCESS!');
    console.log('  - Total variables:', variables.length);
    console.log('');

    console.log('Step 5: Testing listPools...');
    const pools = await client.listPools();
    console.log('  ✅ SUCCESS!');
    console.log('  - Total pools:', pools.length);
    pools.forEach(pool => {
      console.log(`    • ${pool.name}: ${pool.slots} slots (${pool.occupiedSlots} occupied)`);
    });
    console.log('');

    if (dags.length > 0) {
      const testDag = dags[0];
      console.log(`Step 6: Testing getDag for '${testDag.dagId}'...`);
      const dag = await client.getDag(testDag.dagId);
      console.log('  ✅ SUCCESS!');
      console.log('  - DAG ID:', dag.dagId);
      console.log('  - Paused:', dag.paused);
      console.log('  - Schedule:', dag.schedule);
      console.log('  - Owner:', dag.owner);
      console.log('');

      console.log(`Step 7: Testing listDagRuns for '${testDag.dagId}'...`);
      const runs = await client.listDagRuns(testDag.dagId, 5);
      console.log('  ✅ SUCCESS!');
      console.log('  - Total runs:', runs.length);
      if (runs.length > 0) {
        console.log('  - Latest run:', runs[0].dagRunId, '-', runs[0].state);
      }
      console.log('');
    }

    console.log('Step 8: Testing getVersion...');
    const version = await client.getVersion();
    console.log('  ✅ SUCCESS!');
    console.log('  - Airflow version:', version);
    console.log('');

    console.log('=== ALL TESTS PASSED ===');
    console.log('✅ Native HTTPS implementation works perfectly!');
    console.log('✅ All MWAA operations functional');
    console.log('✅ Session cookie authentication working');
    console.log('');
    console.log('The extension is ready to use with MWAA!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('  - Status:', error.response.status);
      console.error('  - Data:', error.response.data);
    }
    console.error('  - Stack:', error.stack);
  }

  console.log('\n=== Test Complete ===');
}

testMwaaIntegration().catch(console.error);
