# Branch protection note (GitHub pricing)

This repository is currently **private** under a personal GitHub account.

When we attempted to enable branch protection for `main` via the GitHub API, GitHub returned:

> “Upgrade to GitHub Pro or make this repository public to enable this feature.”

That means **branch protection rules cannot be enforced** until you either:
- make the repo **public**, or
- upgrade the account/org plan to one that supports branch protection for private repos.

Once enabled, recommended settings for `main`:
- Require a pull request before merging
- Require approvals: 1+
- Require status checks to pass: `ci`
- Require branches to be up to date before merging
- Do not allow force pushes

