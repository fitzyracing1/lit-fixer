# GitHub Marketplace listing prep (not submitted)

App: https://github.com/apps/lit-fixer-fitzy

## Listing copy

- **Name:** lit-fixer
- **Short description (<=80 chars):** Tries safe workflow fixes when CI goes dark; opens one PR once a try is lit.
- **Categories:** Continuous integration (primary), Utilities (secondary)
- **Logo:** `assets/logo.png` (200x200 PNG)

### Full description

lit-fixer watches CI on your default branch. When a run goes dark, it tries a few
safe, workflow-only fixes on throwaway `lit-fixer/try-<n>` branches and waits for
CI. It opens a single pull request only once a try is lit, so you review one change
that is already proven. It never merges, never comments, and never messages anyone.

Fixes are rule-based, no AI guessing, and only touch `.github/workflows` files:

- actions/checkout and setup-node -> v4; Node off end-of-life releases (to 20/22)
- actions/cache, upload-artifact, download-artifact -> v4 (v3 artifact actions now fail)
- actions/setup-python -> v5; Python <=3.8 -> 3.12
- actions/setup-java -> v4, actions/setup-go -> v5
- runs-on ubuntu-18.04/20.04 -> ubuntu-latest
- `npm ci` -> `npm install` when the lockfile is out of sync

Fixes that worked before on your repos are tried first.

## Plans (match /pricing)

Pilot: free for early users. Billing is not live yet; no payment is collected.
List only the Free plan until billing is ready.

| Plan | Price | Includes |
|------|-------|----------|
| Free | $0 | 1 public repo, 3 tries/day |
| Pro | $49/mo | Up to 10 repos |
| Team | $199/mo | Unlimited repos, priority |

## Required URLs

- Homepage: https://lit-fixer-production.up.railway.app/
- Pricing: https://lit-fixer-production.up.railway.app/pricing
- Privacy policy: https://lit-fixer-production.up.railway.app/privacy
- Support: https://lit-fixer-production.up.railway.app/support (Fitzyracing1@gmail.com)
- Source: https://github.com/fitzyracing1/lit-fixer

## Checklist: what Joshua does in the GitHub UI

1. App settings -> Display information: upload `assets/logo.png`, set badge color.
2. App settings -> General: confirm webhook is active, URL
   `https://lit-fixer-production.up.railway.app/webhook`, secret set.
3. Set Homepage URL to the homepage above.
4. Org/publisher verification: Marketplace paid plans need a verified publisher
   (organization with 2FA, verified domain, and billing details). Free listings need
   the app to be owned by an account with 2FA on.
5. Marketplace -> "List in Marketplace": paste the short and full description,
   choose categories, add privacy, support, pricing, and docs URLs, add screenshots.
6. Add the Free plan (and Pro/Team only once billing is live and handled via
   `marketplace_purchase` webhooks).
7. Accept the Marketplace Developer Agreement, then submit for review.
