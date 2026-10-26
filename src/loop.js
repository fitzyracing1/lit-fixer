'use strict';
// The fix loop, after bound-loop: Bucket (limits), Oracle (proposes), Driver (acts on GitHub),
// Checker (reads lit/dark from workflow_run), Memory (counts fixes that turned lit).
const { propose, CATALOG } = require('./oracle');
const { repo: repoState } = require('./state');

const PREFIX = 'lit-fixer/try-';
const conclusionIsLit = c => c === 'success';

function bucket(rs, { maxSteps, perDay, today }) {
  if (rs.day !== today) { rs.day = today; rs.attemptsToday = 0; }
  if (rs.episode && rs.episode.tried.length >= maxSteps) return 'attempt cap reached for this dark event';
  if (rs.attemptsToday >= perDay) return 'daily attempt cap reached for this repo';
  return null;
}

async function listWorkflowFiles(gh, token, full, ref) {
  const dir = await gh.req(token, 'GET', `/repos/${full}/contents/.github/workflows?ref=${encodeURIComponent(ref)}`);
  if (!Array.isArray(dir)) return [];
  const files = [];
  for (const e of dir) {
    if (e.type !== 'file' || !/\.ya?ml$/.test(e.name)) continue;
    const f = await gh.req(token, 'GET', `/repos/${full}/contents/${e.path}?ref=${encodeURIComponent(ref)}`);
    if (f && f.content) files.push({ path: e.path, sha: f.sha, content: Buffer.from(f.content, 'base64').toString('utf8') });
  }
  return files;
}

// Driver: start the next try branch, or give up if Bucket or Oracle says stop.
async function nextTry(ctx, s, full) {
  const { gh, token, cfg, log } = ctx;
  const rs = repoState(s, full);
  const stop = bucket(rs, cfg);
  if (stop) { log(`${full}: ${stop}`); rs.episode.done = stop; return { stopped: stop }; }
  const ep = rs.episode;
  const files = await listWorkflowFiles(gh, token, full, ep.baseSha);
  const p = propose(files, { tried: ep.tried, memory: s.memory });
  if (!p) { ep.done = 'no more fixes in catalog'; log(`${full}: no more fixes`); return { stopped: ep.done }; }
  const branch = `${PREFIX}${rs.next++}`;
  await gh.req(token, 'POST', `/repos/${full}/git/refs`, { ref: `refs/heads/${branch}`, sha: ep.baseSha });
  for (const c of p.changes) {
    await gh.req(token, 'PUT', `/repos/${full}/contents/${c.path}`, {
      message: `lit-fixer: ${p.fix.title}`, content: Buffer.from(c.content).toString('base64'), sha: c.sha, branch,
    });
  }
  ep.tried.push(p.fix.id); ep.current = { branch, fix: p.fix.id };
  rs.attemptsToday++;
  log(`${full}: trying ${p.fix.id} on ${branch}`);
  return { trying: branch, fix: p.fix.id };
}

// Checker: a try branch run finished.
async function onTryResult(ctx, s, full, run, defaultBranch) {
  const { gh, token, log } = ctx;
  const rs = repoState(s, full);
  const ep = rs.episode;
  if (!ep || !ep.current || ep.current.branch !== run.head_branch || ep.done) return { ignored: 'not the current try' };
  const fix = CATALOG.find(f => f.id === ep.current.fix);
  if (conclusionIsLit(run.conclusion)) {
    s.memory[fix.id] = (s.memory[fix.id] || 0) + 1;
    const pr = await gh.req(token, 'POST', `/repos/${full}/pulls`, {
      title: `lit-fixer: ${fix.title}`, head: ep.current.branch, base: defaultBranch,
      body: `CI on \`${defaultBranch}\` went dark. lit-fixer tried a fix on a throwaway branch and that run is lit.\n\n` +
        `**Fix:** ${fix.title}\n\n**Why:** ${fix.why}\n\n**Lit run:** ${run.html_url}\n\n` +
        `Tries this round: ${ep.tried.join(', ')}. This PR is never merged by the app; review and merge or close it yourself.`,
    });
    ep.done = 'lit'; ep.pr = pr && pr.html_url;
    log(`${full}: ${fix.id} is lit, opened PR`);
    return { pr: ep.pr };
  }
  await gh.req(token, 'DELETE', `/repos/${full}/git/refs/heads/${ep.current.branch}`);
  log(`${full}: ${fix.id} stayed dark, deleted ${ep.current.branch}`);
  ep.current = null;
  return nextTry(ctx, s, full);
}

module.exports = { nextTry, onTryResult, bucket, listWorkflowFiles, PREFIX, conclusionIsLit };
