# Agent Operating Contract

## Project Mission

Example Next.js app deployed on Vercel.

## First Files To Read

1. `REPO_SOURCE_OF_TRUTH.json`
2. `WORKING_NOTES.md`
3. current task prompt

## Working Rules

- Verify the live route before assuming production behavior.
- Use `rg --files` and `rg -n` before opening broad folders.
- Do not store Vercel tokens or env values in notes.
- Use small diffs and run `npm run build` before deploy.

## Verification

```bash
npm run build
curl -sSI https://example.com
```

