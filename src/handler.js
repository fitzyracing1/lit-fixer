'use strict';
// Webhook logic. Only events carrying an installation are handled, and only for the repo in
// that event. The app never comments, opens issues, or messages anyone. Its only writes are
// lit-fixer/try-<n> branches and, once a try is lit, one PR in the installed repo.
const state = require('./state');
const { admitRepo } = require('./plans');
const { nextTry, onTryResult, PREFIX, conclusionIsLit } = require('./loop');

function config(env = process.env) {
  return { maxSteps: Number(env.MAX_ATTEMPTS || 3), perDay: Number(env.MAX_ATTEMPTS_PER_DAY || 6) };
}

async function handle(event, payload, { gh, dataDir, cfg = config(), now = new Date(), log = console.log } = {}) {
  if (!payload || !payload.installation || !payload.installation.id) return { ignored: 'not installed' };
  if (event !== 'workflow_run' || payload.action !== 'completed') return { ignored: `${event}.${payload.action || ''}` };
  const run = payload.workflow_run, repo = payload.repository;
  if (!run || !repo) return { ignored: 'no run' };
  const full = repo.full_name, def = repo.default_branch;
  const s = state.load(dataDir);
  const account = payload.installation.account && payload.installation.account.login;
  let runCfg = cfg;
  if (account) {
    const gate = admitRepo(s, account, full);
    if (!gate.ok) {
      state.save(s, dataDir);
      log(`${full}: ignored, ${gate.plan.name} plan for ${account} allows ${gate.plan.repos} repo(s)`);
      return { ignored: `plan repo limit (${gate.plan.name})` };
    }
    runCfg = { ...cfg, perDay: Math.min(cfg.perDay, gate.plan.perDay) };
  }
  const rs = state.repo(s, full);
  const lit = conclusionIsLit(run.conclusion);
  const ctx = { gh, cfg: { ...runCfg, today: now.toISOString().slice(0, 10) }, log };
  let out;
  if (run.head_branch === def) {
    rs.status = lit ? 'lit' : 'dark';
    if (lit) { if (rs.episode && !rs.episode.done) rs.episode.done = 'lit on its own'; out = { status: 'lit' }; }
    else if (rs.episode && !rs.episode.done) out = { status: 'dark', ignored: 'fix loop already running' };
    else {
      rs.episode = { baseSha: run.head_sha, tried: [], current: null, done: null };
      ctx.token = await gh.installationToken(payload.installation.id);
      out = { status: 'dark', ...(await nextTry(ctx, s, full)) };
    }
  } else if (run.head_branch && run.head_branch.startsWith(PREFIX)) {
    ctx.token = await gh.installationToken(payload.installation.id);
    out = await onTryResult(ctx, s, full, run, def);
  } else out = { ignored: 'not default or try branch' };
  state.save(s, dataDir);
  return out;
}

module.exports = { handle, config };
