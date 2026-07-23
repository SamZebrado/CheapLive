import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const requestedBase = baseIndex >= 0 ? args[baseIndex + 1] : process.env.SECURITY_BASE_SHA;
const includeWorktree = args.includes('--include-worktree');

function gitDiff(diffArgs) {
  const result = spawnSync('git', ['diff', '--unified=0', '--no-ext-diff', ...diffArgs], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr.trim() || `git diff failed (${result.status})`);
  return result.stdout;
}

let base = requestedBase;
if (!base || /^0+$/.test(base)) base = 'HEAD^';
const patches = [includeWorktree ? gitDiff([base]) : gitDiff([`${base}...HEAD`])];

const forbiddenUserPath = new RegExp('/' + 'Users/');
const forbiddenWindowsUserPath = new RegExp('[A-Za-z]:\\\\' + 'Users\\\\', 'i');
const credentialPrefixes = ['github' + '_pat_', 'gh' + 'o_', 'gh' + 'p_', 'gh' + 's_', 'gh' + 'u_'];
const patterns = [
  ['local-absolute-path', (line) => forbiddenUserPath.test(line) || forbiddenWindowsUserPath.test(line)],
  ['private-key', (line) => line.includes('-----BEGIN ' + 'PRIVATE KEY-----') || line.includes('-----BEGIN RSA ' + 'PRIVATE KEY-----')],
  ['credential-shape', (line) => credentialPrefixes.some((prefix) => line.includes(prefix)) || /AIza[0-9A-Za-z_-]{20,}/.test(line)],
  ['github-device-code', (line) => /\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/.test(line)],
  ['private-ip-address', (line) => /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})\b/.test(line)],
];

const findings = [];
for (const patch of patches) {
  let file = '';
  let newLine = 0;
  for (const line of patch.split('\n')) {
    if (line.startsWith('+++ b/')) {
      file = line.slice(6);
      continue;
    }
    const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (hunk) {
      newLine = Number(hunk[1]);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      const added = line.slice(1);
      for (const [category, matches] of patterns) {
        if (matches(added)) findings.push({ file, line: newLine, category });
      }
      newLine++;
    } else if (!line.startsWith('-') && !line.startsWith('\\')) {
      newLine++;
    }
  }
}

if (findings.length) {
  for (const finding of findings) console.error(`${finding.file}:${finding.line}: ${finding.category}`);
  console.error(`Security consistency check failed: findings=${findings.length}; matched values were intentionally suppressed`);
  process.exit(1);
}
console.log(`Security consistency check passed: base=${base} worktree=${includeWorktree}`);
