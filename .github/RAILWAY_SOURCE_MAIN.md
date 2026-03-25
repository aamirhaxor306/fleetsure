# Point Railway at the `main` branch

Your app service (`empowering-respect`) was deploying from the **`staging`** Git branch. After merging into `main`, switch Railway so new commits on **`main`** trigger deploys.

## Steps (Railway dashboard)

1. Open project **empowering-respect** on [Railway](https://railway.app).
2. Select the **production** environment (the one where your app + `Postgres` run).
3. Click the **`empowering-respect`** service (Node app, not Postgres).
4. Open the **Settings** tab.
5. Under **Source** (or **GitHub** / **Connect Repo**), find the **branch** setting.
6. Change **`staging`** → **`main`** and save / apply staged changes.
7. (Optional) Trigger a deploy from the **Deployments** tab so the latest `main` is live.

## Avoid double deploys

You now have **both**:

- Railway’s **GitHub → auto deploy** when `main` changes, and  
- GitHub Action **deploy-staging** (`.github/workflows/deploy-staging.yml`) running `railway up` on every push to `main`.

Pick **one** primary path to avoid two builds per push:

- **A)** Keep Railway GitHub integration → **disable** or remove the `deploy-staging` workflow job, **or**  
- **B)** Keep Actions deploys → turn **off** auto-deploy from GitHub in Railway for that service (if you prefer CI-only).

## If you use PR previews

Workflow `railway-preview` needs the repo secrets documented in [PREVIEW_ENV_SECRETS.md](./PREVIEW_ENV_SECRETS.md). Those should already be configured in GitHub.
