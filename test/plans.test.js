'use strict';
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { planForTier, applySponsorship, admitRepo, planOf } = require('../src/plans');
const { createServer } = require('../src/server');
const { handle } = require('../src/handler');
const state = require('../src/state');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'lfp-'));
const sign = (k, b) => 'sha256=' + crypto.createHmac('sha256', k).update(b).digest('hex');
const ev = (action, login, usd, oneTime = false) => ({ action, sponsorship: { sponsor: { login }, tier: { monthly_price_in_dollars: usd, is_one_time: oneTime } } });

test('tier price maps to plan', () => {
  assert.equal(planForTier({ monthly_price_in_dollars: 5 }), 'free');
  assert.equal(planForTier({ monthly_price_in_dollars: 49 }), 'pro');
  assert.equal(planForTier({ monthly_price_in_dollars: 100 }), 'pro');
  assert.equal(planForTier({ monthly_price_in_dollars: 199 }), 'team');
  assert.equal(planForTier({ monthly_price_in_cents: 40000 }), 'team');
  assert.equal(planForTier({ monthly_price_in_dollars: 400, is_one_time: true }), 'free');
});

test('created, tier_changed, pending_cancellation, cancelled', () => {
  const s = { repos: {}, memory: {} };
  assert.deepEqual(applySponsorship(s, ev('created', 'Alice', 49)), { sponsor: 'alice', plan: 'pro' });
  assert.equal(planOf(s, 'ALICE'), 'pro');
  applySponsorship(s, ev('tier_changed', 'alice', 199));
  assert.equal(planOf(s, 'alice'), 'team');
  applySponsorship(s, ev('pending_cancellation', 'alice', 199));
  assert.equal(planOf(s, 'alice'), 'team');
  applySponsorship(s, ev('cancelled', 'alice', 199));
  assert.equal(planOf(s, 'alice'), 'free');
  assert.ok(applySponsorship(s, ev('edited', 'alice', 1)).ignored);
});

test('enforcement: free 1 repo, pro 10, team unlimited', () => {
  const s = {};
  assert.equal(admitRepo(s, 'bob', 'bob/a').ok, true);
  assert.equal(admitRepo(s, 'bob', 'bob/b').ok, false);
  assert.equal(admitRepo(s, 'bob', 'bob/a').ok, true);
  applySponsorship(s, ev('created', 'bob', 49));
  for (let i = 0; i < 9; i++) assert.equal(admitRepo(s, 'bob', `bob/r${i}`).ok, true);
  assert.equal(admitRepo(s, 'bob', 'bob/r9').ok, false);
  applySponsorship(s, ev('tier_changed', 'bob', 199));
  for (let i = 0; i < 30; i++) assert.equal(admitRepo(s, 'bob', `bob/t${i}`).ok, true);
  applySponsorship(s, ev('cancelled', 'bob', 199));
  assert.equal(admitRepo(s, 'bob', 'bob/a').ok, true);
  assert.equal(admitRepo(s, 'bob', 'bob/r0').ok, false);
});

test('handler ignores extra repos on free plan and logs it', async () => {
  const dir = tmp(), logs = [];
  const p = full => ({ action: 'completed', installation: { id: 1, account: { login: 'carol' } }, repository: { full_name: full, default_branch: 'main' }, workflow_run: { head_branch: 'main', conclusion: 'success', head_sha: 'x' } });
  assert.deepEqual(await handle('workflow_run', p('carol/one'), { gh: {}, dataDir: dir, log: m => logs.push(m) }), { status: 'lit' });
  const out = await handle('workflow_run', p('carol/two'), { gh: {}, dataDir: dir, log: m => logs.push(m) });
  assert.match(out.ignored, /plan repo limit/);
  assert.ok(logs.some(l => /carol\/two: ignored, Free plan/.test(l)));
});

test('sponsors webhook: 401 unsigned, signed event updates state', async () => {
  const dir = tmp();
  const srv = createServer({ secret: 'x', sponsorsSecret: 'sp', gh: {}, dataDir: dir, log: () => {} }).listen(0);
  const url = `http://127.0.0.1:${srv.address().port}/sponsors-webhook`;
  try {
    const body = JSON.stringify(ev('created', 'dave', 199));
    assert.equal((await fetch(url, { method: 'POST', body })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', body, headers: { 'x-github-event': 'sponsorship', 'x-hub-signature-256': sign('wrong', body) } })).status, 401);
    const r = await fetch(url, { method: 'POST', body, headers: { 'x-github-event': 'sponsorship', 'x-hub-signature-256': sign('sp', body) } });
    assert.equal(r.status, 200);
    assert.equal(planOf(state.load(dir), 'dave'), 'team');
  } finally { srv.close(); }
});

test('sponsors webhook rejects everything when secret unset', async () => {
  const srv = createServer({ secret: 'x', sponsorsSecret: '', gh: {}, dataDir: tmp() }).listen(0);
  try {
    const body = '{}';
    const r = await fetch(`http://127.0.0.1:${srv.address().port}/sponsors-webhook`, { method: 'POST', body, headers: { 'x-hub-signature-256': sign('', body) } });
    assert.equal(r.status, 401);
  } finally { srv.close(); }
});
