# Verification Loop

AiML SuperAgent treats verification as part of implementation, not an optional afterthought.

## Verification Hierarchy

Use the cheapest proof that meaningfully reduces risk.

1. Static check
2. Unit or focused test
3. Build
4. Local smoke test
5. Staging probe
6. Production read-only probe
7. Production mutation test with approval

## Production-First Verification

Verify production reality before code changes when the issue depends on:

- deployed environment variables
- external APIs
- app store metadata
- browser behavior
- cloud routing
- database schema
- background jobs
- push notification credentials
- live webhooks

The repo can be correct while production is wrong.

## Proof Statement

Every completed task should end with a proof statement:

```text
Verified with:
- npm run build
- curl -sSI https://example.com/route returned 200
```

If not verified:

```text
Not verified because:
- device was not connected
- credentials were not available
- network access was blocked
```

## Avoid False Proof

Do not claim success from:

- code inspection only
- unrelated tests
- old logs
- successful deploy without route check
- local build when the bug was production configuration

## Fast Proof Examples

Next.js route:

```bash
npm run build
curl -sSI https://example.com/api/health
```

Database migration:

```bash
node scripts/validate-schema.mjs
```

CLI script:

```bash
npm i -D @aimlsuperagent/agent
npx aiml-superagent check .
```
