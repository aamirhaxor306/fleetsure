# Railway preview environments — required GitHub secrets

These workflows expect the following GitHub repo secrets:

## Required
- `RAILWAY_TOKEN`: Prefer a **Railway project token** (Project → Settings → Tokens). A personal/user token from `railway login` works for CI but is broader—rotate to a project token when you can.
- `RAILWAY_PROJECT_ID`: Railway project id.

## Recommended
- `RAILWAY_SERVICE`: Your Railway app service name or id (so deploys always target the same service).
- `RAILWAY_POSTGRES_SERVICE`: Your Railway Postgres service name or id (so each PR env gets its own Postgres deployment).

## Optional
- `RAILWAY_STAGING_ENV`: Railway **environment name** targeted by `deploy-staging.yml` on pushes to `main`. For **empowering-respect**, the live app runs in the Railway environment named **`production`**, so set this to `production` if your “shared staging” is that canvas (default in code is `staging`).
- `RAILWAY_PROD_ENV`: Railway environment name for production (default: `production`).

## This repo (configured)

These values were applied to GitHub Actions secrets for `aamirhaxor306/fleetsure`:

| Secret | Purpose |
|--------|---------|
| `RAILWAY_PROJECT_ID` | `empowering-respect` project |
| `RAILWAY_SERVICE` | App service `empowering-respect` |
| `RAILWAY_POSTGRES_SERVICE` | `Postgres` in production (for preview/redeploy patterns) |
| `RAILWAY_STAGING_ENV` | `production` (matches where the app service is deployed today) |

**You still must** switch the GitHub **branch** in Railway from `staging` to `main` (see [RAILWAY_SOURCE_MAIN.md](./RAILWAY_SOURCE_MAIN.md)).

