import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';

import test from 'node:test';

const execFileAsync = promisify(execFile);

test('research-core fitness gate script passes', async () => {
  const appRoot = path.resolve(import.meta.dirname, '../../../../');
  const scriptPath = path.join(appRoot, 'scripts/check-fitness.ts');
  const { stdout } = await execFileAsync(
    process.execPath,
    ['--experimental-strip-types', scriptPath],
    {
      cwd: appRoot,
      maxBuffer: 1024 * 1024,
    },
  );

  assert.match(stdout, /Research fitness gates: 19\/19 passed/);
});
