'use strict';
// Oracle: a pluggable, rule-based fix catalog. No LLM. Each fix takes a file's text and
// returns new text (or the same text if it does not apply). Add fixes by pushing to CATALOG.
const EOL_NODE = ['8', '10', '12', '14', '16', '18'];

const CATALOG = [
  {
    id: 'bump-checkout',
    title: 'Bump actions/checkout to v4',
    why: 'Old actions/checkout versions run on retired Node runtimes and can fail on current runners.',
    apply: t => t.replace(/actions\/checkout@v[1-3]\b/g, 'actions/checkout@v4'),
  },
  {
    id: 'bump-setup-node',
    title: 'Bump actions/setup-node to v4',
    why: 'Old actions/setup-node versions run on retired Node runtimes and can fail on current runners.',
    apply: t => t.replace(/actions\/setup-node@v[1-3]\b/g, 'actions/setup-node@v4'),
  },
  {
    id: 'node-off-eol',
    title: 'Move node-version off end-of-life Node releases',
    why: 'Node releases past end of life are dropped by tools and dependencies; 20 and 22 are supported.',
    apply: t => {
      const eol = new RegExp(`^['"]?(${EOL_NODE.join('|')})(\\.x)?['"]?$`);
      // matrix lists: node: [14, 16, 18] / node-version: [...]
      t = t.replace(/^(\s*node(?:-version)?:\s*)\[([^\]]*)\]/gm, (m, k, list) => {
        const items = list.split(',').map(s => s.trim()).filter(Boolean);
        if (!items.some(i => eol.test(i))) return m;
        const keep = items.filter(i => !eol.test(i));
        for (const v of ['20', '22']) if (!keep.some(i => i.replace(/['"]/g, '').startsWith(v))) keep.push(v);
        return `${k}[${keep.join(', ')}]`;
      });
      // scalar: node-version: 16
      return t.replace(/^(\s*node-version:\s*)(['"]?)(\d+)(\.x)?\2\s*$/gm, (m, k, q, v) => EOL_NODE.includes(v) ? `${k}${q}20${q}` : m);
    },
  },
  {
    id: 'bump-cache',
    title: 'Bump actions/cache to v4',
    why: 'actions/cache v1-v3 use a retired cache service and Node runtime and now fail on GitHub.',
    apply: t => t.replace(/actions\/cache(\/(?:save|restore))?@v[1-3]\b/g, 'actions/cache$1@v4'),
  },
  {
    id: 'bump-artifact',
    title: 'Bump actions/upload-artifact and download-artifact to v4',
    why: 'v1-v3 artifact actions are deprecated and now hard-fail on GitHub.',
    apply: t => t.replace(/actions\/(upload|download)-artifact@v[1-3]\b/g, 'actions/$1-artifact@v4'),
  },
  {
    id: 'bump-setup-python',
    title: 'Bump actions/setup-python to v5',
    why: 'Old actions/setup-python versions run on retired Node runtimes.',
    apply: t => t.replace(/actions\/setup-python@v[1-4]\b/g, 'actions/setup-python@v5'),
  },
  {
    id: 'python-off-eol',
    title: 'Move python-version off end-of-life Python (<=3.8) to 3.12',
    why: 'Python 3.8 and older are past end of life and missing from current runner images.',
    apply: t => {
      const eol = /^['"]?(2\.7|3\.[0-8])(\.\d+)?['"]?$/;
      t = t.replace(/^(\s*python(?:-version)?:\s*)\[([^\]]*)\]/gm, (m, k, list) => {
        const items = list.split(',').map(s => s.trim()).filter(Boolean);
        if (!items.some(i => eol.test(i))) return m;
        const keep = items.filter(i => !eol.test(i));
        if (!keep.some(i => i.replace(/['"]/g, '') === '3.12')) keep.push("'3.12'");
        return `${k}[${keep.join(', ')}]`;
      });
      return t.replace(/^(\s*python-version:\s*)(['"]?)(2\.7|3\.[0-8])(\.\d+)?\2[ \t]*$/gm, (m, k, q) => `${k}'3.12'`);
    },
  },
  {
    id: 'runs-on-latest',
    title: 'Move runs-on ubuntu-18.04/20.04 to ubuntu-latest',
    why: 'ubuntu-18.04 and ubuntu-20.04 runner images are retired; jobs on them never start.',
    apply: t => t.replace(/\bubuntu-(18|20)\.04\b/g, 'ubuntu-latest'),
  },
  {
    id: 'bump-setup-java',
    title: 'Bump actions/setup-java to v4',
    why: 'Old actions/setup-java versions run on retired Node runtimes (v2+ also needs distribution:, so v1 is left alone).',
    apply: t => t.replace(/actions\/setup-java@v[23]\b/g, 'actions/setup-java@v4'),
  },
  {
    id: 'bump-setup-go',
    title: 'Bump actions/setup-go to v5',
    why: 'Old actions/setup-go versions run on retired Node runtimes.',
    apply: t => t.replace(/actions\/setup-go@v[1-4]\b/g, 'actions/setup-go@v5'),
  },
  {
    id: 'lockfile-regen',
    title: 'Use npm install instead of npm ci (lockfile out of sync)',
    why: 'npm ci fails when package-lock.json does not match package.json. This try uses npm install; regenerate the lockfile locally with `npm install` and commit it for a lasting fix.',
    apply: t => t.replace(/\bnpm ci\b/g, 'npm install'),
  },
];

// Order fixes: ones that worked before (memory) go first, then catalog order. Skip tried ids.
function propose(files, { tried = [], memory = {} } = {}) {
  const order = [...CATALOG].sort((a, b) => (memory[b.id] || 0) - (memory[a.id] || 0));
  for (const fix of order) {
    if (tried.includes(fix.id)) continue;
    const changes = [];
    for (const f of files) {
      const out = fix.apply(f.content);
      if (out !== f.content) changes.push({ path: f.path, sha: f.sha, content: out });
    }
    if (changes.length) return { fix, changes };
  }
  return null;
}

module.exports = { CATALOG, propose, EOL_NODE };
