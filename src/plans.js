'use strict';
// Plans paid through GitHub Sponsors. The sponsor's GitHub login unlocks the plan for the
// installation account with the same login.
const PLANS = {
  free: { name: 'Free', repos: 1, perDay: 3, priority: false },
  pro: { name: 'Pro', repos: 10, perDay: 6, priority: false },
  team: { name: 'Team', repos: Infinity, perDay: 6, priority: true },
};
const SPONSORS_URL = 'https://github.com/sponsors/fitzyracing1';
const INSTALL_URL = 'https://github.com/apps/lit-fixer-fitzy/installations/new';

function planForTier(tier) {
  if (!tier || tier.is_one_time) return 'free';
  const usd = tier.monthly_price_in_dollars ?? (tier.monthly_price_in_cents || 0) / 100;
  if (usd >= 199) return 'team';
  if (usd >= 49) return 'pro';
  return 'free';
}

const key = login => String(login || '').toLowerCase();
function planOf(s, login) {
  const p = s.sponsors && s.sponsors[key(login)];
  return p && PLANS[p.plan] ? p.plan : 'free';
}

// Apply a `sponsorship` webhook payload to state. Returns what changed.
function applySponsorship(s, payload, now = new Date()) {
  const sp = payload && payload.sponsorship;
  const login = sp && sp.sponsor && sp.sponsor.login;
  if (!login) return { ignored: 'no sponsor' };
  s.sponsors ||= {};
  const k = key(login), at = now.toISOString();
  switch (payload.action) {
    case 'created':
    case 'tier_changed':
      s.sponsors[k] = { plan: planForTier(sp.tier), at }; break;
    case 'cancelled':
      s.sponsors[k] = { plan: 'free', at }; break;
    case 'pending_cancellation':
      // Still paid until the cycle ends; GitHub sends `cancelled` then.
      s.sponsors[k] = { ...(s.sponsors[k] || { plan: planForTier(sp.tier) }), pendingCancel: true, at }; break;
    default:
      return { ignored: `sponsorship.${payload.action}` };
  }
  return { sponsor: k, plan: s.sponsors[k].plan };
}

// Gate a repo for an installation account. Remembers which repos an account uses, in order.
function admitRepo(s, login, full) {
  const plan = PLANS[planOf(s, login)];
  s.accounts ||= {};
  const a = (s.accounts[key(login)] ||= { repos: [] });
  if (a.repos.includes(full)) {
    if (a.repos.indexOf(full) < plan.repos) return { ok: true, plan };
    return { ok: false, plan };
  }
  if (a.repos.length >= plan.repos) return { ok: false, plan };
  a.repos.push(full);
  return { ok: true, plan };
}

module.exports = { PLANS, SPONSORS_URL, INSTALL_URL, planForTier, planOf, applySponsorship, admitRepo };
