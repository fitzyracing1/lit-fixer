'use strict';
// Static pages. Plain HTML, no scripts, no tracking.
const page = (title, body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font:16px/1.5 system-ui;max-width:48rem;margin:3rem auto;padding:0 1rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:.5rem;text-align:left;vertical-align:top}.note{background:#fff7d6;border:1px solid #e6c84d;padding:.75rem;border-radius:6px}</style>
<p><a href="/">lit-fixer</a> · <a href="/pricing">Pricing</a></p>
${body}`;

const PRICING = page('lit-fixer pricing', `<h1>Pricing</h1>
<p class="note"><strong>Pilot: free for early users.</strong> Billing is not live yet. No payment is collected and no card is asked for. The plans below show planned pricing.</p>
<table>
<tr><th>Plan</th><th>Price</th><th>What you get</th></tr>
<tr><td>Free</td><td>$0</td><td>1 public repo, 3 tries per day</td></tr>
<tr><td>Pro</td><td>$49/mo</td><td>Up to 10 repos</td></tr>
<tr><td>Team</td><td>$199/mo</td><td>Unlimited repos, priority</td></tr>
</table>
<p>Every plan: fixes are tried on throwaway branches, and a pull request opens only once a try is lit. lit-fixer never merges.</p>`);

module.exports = { page, PRICING };
