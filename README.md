# lit-fixer

A GitHub App that notices when CI on your default branch goes **dark**, tries a few safe fixes on throwaway branches, and opens **one** pull request only after a try turns **lit**.

Words used here: **lit** means the run succeeded. **dark** means anything else.

## What it does

1. A `workflow_run` finishes on your default branch and is dark. The repo is marked dark.
2. The **Oracle** (a plain rule list, no AI) picks a fix that changes something in `.github/workflows/`.
3. The **Driver** pushes that fix to a new branch `lit-fixer/try-<n>` in your repo.
4. The **Checker** waits for that branch's `workflow_run`:
   - lit: opens one PR to your default branch, explaining the fix and linking the lit run. It never merges.
   - dark: deletes the try branch and moves to the next fix.
5. The **Bucket** caps tries: 3 per dark event (`MAX_ATTEMPTS`) and 6 per repo per day (`MAX_ATTEMPTS_PER_DAY`).
6. **Memory**: fixes that turned lit before are tried first next time.

The loop idea comes from [bound-loop](https://github.com/fitzyracing1/bound-loop).

## Fix catalog

| id | what it does |
|---|---|
| `bump-checkout` | `actions/checkout@v1-v3` to `@v4` |
| `bump-setup-node` | `actions/setup-node@v1-v3` to `@v4` |
| `node-off-eol` | drops end-of-life Node (8 to 18) from `node-version` / `node` matrix, adds 20 and 22 |
| `lockfile-regen` | `npm ci` to `npm install` when the lockfile is out of sync, with a note to regenerate and commit it |

Add a fix by pushing an `{ id, title, why, apply(text) }` object onto `CATALOG` in `src/oracle.js`.

## Boundaries

- Only acts on repos where you installed the app. Events without an installation are ignored.
- Never comments, opens issues, or messages anyone. Its only writes are `lit-fixer/try-<n>` branches and one PR.
- Never merges.

## Run it

Node 20 or newer, no dependencies.

```
APP_ID=... WEBHOOK_SECRET=... PRIVATE_KEY_BASE64=... LIT_FIXER_DATA=./data npm start
```

- `PRIVATE_KEY_BASE64` or `PRIVATE_KEY` (PEM, `\n` allowed) holds the app key. It is never printed.
- `LIT_FIXER_DATA` is where `state.json` lives.
- `GET /` is the homepage, `GET /health` answers `lit`, `POST /webhook` takes signed GitHub events.

GitHub App permissions needed: Actions read, Contents read and write, Pull requests read and write, Workflows read and write. Subscribe to the **Workflow run** event.

## Test

```
npm test
```

## License

MIT, Copyright (c) 2026 Joshua Almeida.

## Plans

This project is free, and its license stays as is. See plans and pricing at https://lit-fixer-production.up.railway.app/pricing, or support it through [GitHub Sponsors](https://github.com/sponsors/fitzyracing1).
