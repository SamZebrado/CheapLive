import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function reservePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address !== 'object') throw new Error('Failed to reserve a test port');
  return address.port;
}

const port = await reservePort();
const playwright = path.join(repoRoot, 'node_modules', '.bin', 'playwright');
const result = spawnSync(playwright, ['test', ...process.argv.slice(2)], {
  cwd: repoRoot,
  env: {
    ...process.env,
    CHEAPLIVE_TEST_PORT: String(port),
    CHEAPLIVE_TEST_BASE_URL: `http://127.0.0.1:${port}`,
  },
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
