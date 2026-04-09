const { execSync } = require('child_process');

try {
  console.log('Running Dashboard tests...\n');
  const output = execSync('npx vitest run tests/unit/mobile-client/Dashboard.test.tsx --reporter=verbose --no-coverage', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024
  });
  console.log(output);
  console.log('\n✓ Tests completed successfully');
} catch (error) {
  if (error.stdout) console.log('STDOUT:\n', error.stdout);
  if (error.stderr) console.log('STDERR:\n', error.stderr);
  console.log('\n✗ Tests failed with exit code:', error.status);
  process.exit(error.status || 1);
}
