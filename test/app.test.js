'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifySignature } = require('../src/verify');
const { handle } = require('../src/handler');
const { createServer } = require('../src/server');
const { propose, CATALOG } = require('../src/oracle');
const { appJwt, loadPrivateKey } = require('../src/github');

const OLD_WF = `name: ci
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [14, 16]
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.node }}
      - run: npm ci
`;

// Mock GitHub API: records every call, serves one workflow file.
function fakeGh({ wf = OLD_WF } = {}) {
  const calls = [];
  return {
    calls,
    installationToken: async () => 'tok',
    async req(token, method, url, body) {
      calls.push({ method, url, body });
      if (method === 'GET' && /contents\/\.github\/workflows\?/.test(url)) return [{ type: 'file', name: 'ci.yml', path: '.github/workflows/ci.yml' }];
      if (method === 'GET' && /contents\/\.github\/workflows\/ci\.yml/.test(url)) return { sha: 'f1', content: Buffer.from(wf).toString('base64') };
      if (method === 'PUT') return { commit: { sha: 'fix1' } };
      if (method === 'POST' && url.endsWith('/pulls')) return { html_url: 'https://github.com/o/r/pull/1' };
      return {};
    },
  };
}
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lf-'));
const repo = { full_name: 'o/r', default_branch: 'main' };
const ev = (branch, conclusion, extra = {}) => ({
  action: 'completed', installation: { id: 1 }, repository: repo,
  workflow_run: { head_branch: branch, head_sha: branch.startsWith('lit-fixer/') ? 'fix1' : 'abc', conclusion, html_url: `https://github.com/o/r/actions/runs/${branch}`, ...extra },
});
const quiet = () => {};
const opts = (gh, dataDir, cfg = { maxSteps: 3, perDay: 10 }) => ({ gh, dataDir, cfg, log: quiet });
const writes = gh => gh.calls.filter(c => c.method !== 'GET');

test('signature check accepts valid and rejects bad or missing', () => {
  const body = Buffer.from('{"a":1}');
  const sig = 'sha256=' + crypto.createHmac('sha256', 's3').update(body).digest('hex');
  assert.equal(verifySignature('s3', body, sig), true);
  assert.equal(verifySignature('other', body, sig), false);
  assert.equal(verifySignature('s3', body, undefined), false);
  assert.equal(verifySignature('s3', body, 'sha256=00'), false);
});

test('server rejects unsigned webhook and serves / and /health', async () => {
  const srv = createServer({ secret: 'x', gh: fakeGh(), dataDir: tmp() }).listen(0);
  const base = `http://127.0.0.1:${srv.address().port}`;
  try {
    assert.equal((await fetch(base + '/webhook', { method: 'POST', body: '{}' })).status, 401);
    assert.equal(await (await fetch(base + '/health')).text(), 'lit\n');
    assert.match(await (await fetch(base + '/')).text(), /lit-fixer/);
  } finally { srv.close(); }
});

test('ignores lit runs on the default branch', async () => {
  const gh = fakeGh();
  const out = await handle('workflow_run', ev('main', 'success'), opts(gh, tmp()));
  assert.equal(out.status, 'lit');
  assert.equal(writes(gh).length, 0);
});

test('no action on events without an installation', async () => {
  const gh = fakeGh();
  const p = ev('main', 'failure'); delete p.installation;
  const out = await handle('workflow_run', p, opts(gh, tmp()));
  assert.equal(out.ignored, 'not installed');
  assert.equal(gh.calls.length, 0);
});

test('try loop: dark tries are deleted, the lit try gets the one PR', async () => {
  const gh = fakeGh(), d = tmp();
  let out = await handle('workflow_run', ev('main', 'failure'), opts(gh, d));
  assert.equal(out.trying, 'lit-fixer/try-1');
  assert.equal(out.fix, 'bump-checkout');
  assert.ok(!gh.calls.some(c => c.url.endsWith('/pulls')), 'no PR before lit');

  out = await handle('workflow_run', ev('lit-fixer/try-1', 'failure'), opts(gh, d));
  assert.ok(gh.calls.some(c => c.method === 'DELETE' && c.url.endsWith('heads/lit-fixer/try-1')));
  assert.equal(out.trying, 'lit-fixer/try-2');
  assert.equal(out.fix, 'bump-setup-node');
  assert.ok(!gh.calls.some(c => c.url.endsWith('/pulls')), 'no PR while dark');

  out = await handle('workflow_run', ev('lit-fixer/try-2', 'success'), opts(gh, d));
  assert.equal(out.pr, 'https://github.com/o/r/pull/1');
  const prs = gh.calls.filter(c => c.method === 'POST' && c.url.endsWith('/pulls'));
  assert.equal(prs.length, 1);
  assert.equal(prs[0].body.head, 'lit-fixer/try-2');
  assert.equal(prs[0].body.base, 'main');
  assert.match(prs[0].body.body, /actions\/runs\/lit-fixer\/try-2/);
  assert.ok(!gh.calls.some(c => /merge/.test(c.url)), 'never merges');

  // a repeat lit event does not open a second PR
  await handle('workflow_run', ev('lit-fixer/try-2', 'success'), opts(gh, d));
  assert.equal(gh.calls.filter(c => c.url.endsWith('/pulls')).length, 1);

  // memory: next dark event tries the fix that worked first
  const s = JSON.parse(fs.readFileSync(path.join(d, 'state.json'), 'utf8'));
  assert.equal(s.memory['bump-setup-node'], 1);
  out = await handle('workflow_run', ev('main', 'failure'), opts(gh, d));
  assert.equal(out.fix, 'bump-setup-node');
});

test('attempt cap per dark event stops the loop', async () => {
  const gh = fakeGh(), d = tmp(), o = opts(gh, d, { maxSteps: 2, perDay: 10 });
  await handle('workflow_run', ev('main', 'failure'), o);
  await handle('workflow_run', ev('lit-fixer/try-1', 'failure'), o);
  const out = await handle('workflow_run', ev('lit-fixer/try-2', 'failure'), o);
  assert.match(out.stopped, /attempt cap/);
  assert.equal(gh.calls.filter(c => c.method === 'POST' && c.url.endsWith('/git/refs')).length, 2);
  assert.ok(!gh.calls.some(c => c.url.endsWith('/pulls')));
});

test('daily cap per repo stops new tries', async () => {
  const gh = fakeGh(), d = tmp(), o = opts(gh, d, { maxSteps: 3, perDay: 1 });
  await handle('workflow_run', ev('main', 'failure'), o);
  const out = await handle('workflow_run', ev('lit-fixer/try-1', 'failure'), o);
  assert.match(out.stopped, /daily/);
});

test('oracle catalog fixes old workflows', () => {
  const files = [{ path: 'ci.yml', sha: 's', content: OLD_WF }];
  const byId = id => CATALOG.find(f => f.id === id).apply(OLD_WF);
  assert.match(byId('bump-checkout'), /checkout@v4/);
  assert.match(byId('bump-setup-node'), /setup-node@v4/);
  assert.match(byId('node-off-eol'), /node: \[20, 22\]/);
  assert.match(CATALOG[2].apply('      node-version: 16\n'), /node-version: 20/);
  assert.match(byId('lockfile-regen'), /npm install/);
  assert.equal(propose(files, { tried: CATALOG.map(f => f.id) }), null);
});

test('private key loads from env and signs a JWT', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' });
  assert.equal(loadPrivateKey({ env: { PRIVATE_KEY_BASE64: Buffer.from(pem).toString('base64') } }), pem);
  assert.equal(appJwt(1, pem).split('.').length, 3);
});

test('ignores the try-branch run on the dark base sha (branch creation push)', async () => {
  const gh = fakeGh(), d = tmp();
  await handle('workflow_run', ev('main', 'failure'), opts(gh, d));
  const n = writes(gh).length;
  const out = await handle('workflow_run', ev('lit-fixer/try-1', 'failure', { head_sha: 'abc' }), opts(gh, d));
  assert.equal(out.ignored, 'run is not for the fix commit');
  assert.equal(writes(gh).length, n);
  const lit = await handle('workflow_run', ev('lit-fixer/try-1', 'success'), opts(gh, d));
  assert.ok(lit.pr);
});

test('oracle: more workflow catalog fixes', () => {
  const fx = id => CATALOG.find(f => f.id === id).apply;
  assert.strictEqual(fx('bump-cache')('uses: actions/cache@v2\nuses: actions/cache/restore@v3'), 'uses: actions/cache@v4\nuses: actions/cache/restore@v4');
  assert.strictEqual(fx('bump-cache')('uses: actions/cache@v4'), 'uses: actions/cache@v4');
  assert.strictEqual(fx('bump-artifact')('actions/upload-artifact@v3 actions/download-artifact@v1'), 'actions/upload-artifact@v4 actions/download-artifact@v4');
  assert.strictEqual(fx('bump-setup-python')('actions/setup-python@v4'), 'actions/setup-python@v5');
  assert.strictEqual(fx('python-off-eol')("  python-version: '3.7'\n"), "  python-version: '3.12'\n");
  assert.strictEqual(fx('python-off-eol')('  python-version: 3.11\n'), '  python-version: 3.11\n');
  assert.strictEqual(fx('python-off-eol')("  python: ['3.6', '3.10']"), "  python: ['3.10', '3.12']");
  assert.strictEqual(fx('python-off-eol')("  python-version: [3.8, 3.12]"), "  python-version: [3.12]");
  assert.strictEqual(fx('runs-on-latest')('runs-on: ubuntu-20.04\nruns-on: ubuntu-18.04\nruns-on: ubuntu-22.04'), 'runs-on: ubuntu-latest\nruns-on: ubuntu-latest\nruns-on: ubuntu-22.04');
  assert.strictEqual(fx('bump-setup-java')('actions/setup-java@v3 actions/setup-java@v1'), 'actions/setup-java@v4 actions/setup-java@v1');
  assert.strictEqual(fx('bump-setup-go')('actions/setup-go@v3'), 'actions/setup-go@v5');
  const r = propose([{ path: '.github/workflows/a.yml', sha: 'x', content: 'runs-on: ubuntu-20.04\n' }]);
  assert.strictEqual(r.fix.id, 'runs-on-latest');
});
