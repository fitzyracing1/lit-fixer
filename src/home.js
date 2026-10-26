'use strict';
const HTML = `<!doctype html><meta charset="utf-8"><title>lit-fixer</title>
<style>body{font:16px/1.5 system-ui;max-width:40rem;margin:3rem auto;padding:0 1rem}</style>
<h1>lit-fixer</h1>
<p>A GitHub App that notices when CI on your default branch goes dark, tries a few safe fixes on throwaway <code>lit-fixer/try-&lt;n&gt;</code> branches, and opens one pull request only once a try is lit.</p>
<p>It only works on repos where you installed it. It never merges, never comments, and never messages anyone.</p>
<p><a href="/pricing">Pricing</a> · <a href="/privacy">Privacy</a> · <a href="/support">Support</a> · <a href="https://github.com/fitzyracing1/lit-fixer">Source</a> · <a href="/health">health</a></p>`;
module.exports = { HTML };
