# Railway preview environments — required GitHub secrets

These workflows expect the following GitHub repo secrets:

## Required
- `RAILWAY_TOKEN`: Railway project token (CI-safe).
- `RAILWAY_PROJECT_ID`: Railway project id.

## Recommended
- `RAILWAY_SERVICE`: Your Railway app service name or id (so deploys always target the same service).
- `RAILWAY_POSTGRES_SERVICE`: Your Railway Postgres service name or id (so each PR env gets its own Postgres deployment).

## Optional
- `RAILWAY_STAGING_ENV`: Railway environment name for shared staging (default: `staging`).
- `RAILWAY_PROD_ENV`: Railway environment name for production (default: `production`).

