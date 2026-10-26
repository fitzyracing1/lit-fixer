'use strict';
// JSON state in $LIT_FIXER_DATA/state.json: repo lit/dark, open episodes, daily counts, memory.
const fs = require('node:fs');
const path = require('node:path');

const file = dir => path.join(dir || process.env.LIT_FIXER_DATA || './data', 'state.json');
function load(dir) {
  try { return JSON.parse(fs.readFileSync(file(dir), 'utf8')); } catch { return { repos: {}, memory: {} }; }
}
function save(s, dir) {
  const f = file(dir); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f + '.tmp', JSON.stringify(s, null, 2)); fs.renameSync(f + '.tmp', f);
}
function repo(s, name) {
  return (s.repos[name] ||= { status: 'unknown', episode: null, day: null, attemptsToday: 0, next: 1 });
}
module.exports = { load, save, repo };
