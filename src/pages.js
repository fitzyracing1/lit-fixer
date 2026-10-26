'use strict';
// Static pages. Plain HTML, no scripts, no tracking.
const page = (title, body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:16px/1.5 system-ui;max-width:48rem;margin:3rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:.5rem;text-align:left;vertical-align:top}.note{background:#fff7d6;border:1px solid #e6c84d;padding:.75rem;border-radius:6px}</style>
<p><a href="/">lit-fixer</a> · <a href="/pricing">Pricing</a> · <a href="/privacy">Privacy</a> · <a href="/support">Support</a></p>
${body}`;

const PRICING = page('lit-fixer pricing', `<h1>Pricing</h1>
<p class="note">Pay through GitHub Sponsors; your plan unlocks automatically for the GitHub account that sponsors.</p>
<table>
<tr><th>Plan</th><th>Price</th><th>What you get</th><th></th></tr>
<tr><td>Free</td><td>$0</td><td>1 public repo, 3 tries per day</td><td><a href="https://github.com/apps/lit-fixer-fitzy/installations/new">Install free</a></td></tr>
<tr><td>Pro</td><td>$49/mo</td><td>Up to 10 repos, 6 tries per day per repo</td><td><a href="https://github.com/sponsors/fitzyracing1">Sponsor $49/mo</a></td></tr>
<tr><td>Team</td><td>$199/mo</td><td>Unlimited repos, priority</td><td><a href="https://github.com/sponsors/fitzyracing1">Sponsor $199/mo</a></td></tr>
</table>
<p>Every plan: fixes are tried on throwaway branches, and a pull request opens only once a try is lit. lit-fixer never merges.</p>`);

const PRIVACY = page('lit-fixer privacy', `<h1>Privacy</h1>
<p>lit-fixer is a GitHub App. It only sees repos where you installed it.</p>
<h2>What is stored</h2>
<ul><li>Repo names (owner/name) for installed repos</li><li>Workflow run ids it is watching</li><li>Fix memory: which catalog fix ids worked before, so they are tried first</li></ul>
<h2>What is not stored</h2>
<p>No source code is kept beyond the workflow files it edits on throwaway branches in your own repo. No personal data, no cookies, no analytics, no tracking. Nothing is sold or shared.</p>
<p>Uninstall the app to stop all access. To ask for your data to be deleted, email <a href="mailto:Fitzyracing1@gmail.com">Fitzyracing1@gmail.com</a>.</p>`);

const SUPPORT = page('lit-fixer support', `<h1>Support</h1>
<p>Email <a href="mailto:Fitzyracing1@gmail.com">Fitzyracing1@gmail.com</a> or open an issue at <a href="https://github.com/fitzyracing1/lit-fixer/issues">github.com/fitzyracing1/lit-fixer/issues</a>.</p>
<p>Include the repo name and the run id if you can. lit-fixer is run by one person during the pilot, so replies may take a day or two.</p>`);

module.exports = { page, PRICING, PRIVACY, SUPPORT };
