# Deployment Discipline

Long-running agent work fails when deployment state is vague.

AiML SuperAgent records deployments as operational facts.

## Deployment Log Fields

Each deployment entry should include:

- date and time
- environment
- platform
- commit or build ID
- changed behavior
- verification command
- rollback note
- open risks

## Deployment Entry

```text
## 2026-05-31 - Production

Platform: Vercel
Commit: abc1234
Change: Added /api/health route.
Verify: curl -sSI https://example.com/api/health returned 200.
Rollback: redeploy previous production deployment.
Risks: none known.
```

## Deploy Before Or After Notes?

Update the deployment log after verification, not before.

Do not record planned deployments as completed deployments.

## Release Gates

Before public release:

- checker passes
- no secrets in repo
- README quick start works
- examples are fictional or sanitized
- license is intentional
- public/private repo state is intentional
- deployment target is documented

