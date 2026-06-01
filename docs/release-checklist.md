# Release Checklist

Use this before making the repository public.

## Repository State

- Repository visibility intentionally selected.
- README quick start tested.
- `npm run check` passes.
- No actual secrets in docs, examples, notes, commit history, or issue templates.
- License decision made intentionally.
- Package publishing state is intentional.

## Content

- README explains the project in one minute.
- Comparison to behavior-only agent rules is respectful and accurate.
- Context Minimizer is prominent.
- Templates are copy-safe.
- Examples are fictional or sanitized.
- Docs do not depend on private company infrastructure.

## Verification

```bash
npm run check
node bin/aiml-superagent.js check . --release --strict
git status --short
```

Optional:

```bash
mkdir -p /tmp/superagent-smoke
cd /tmp/superagent-smoke
npm i -D @aimlsuperagent/agent
npx aiml-superagent init .
npx aiml-superagent check .
```

## Publication

- Confirm MIT License is still the intended public license.
- Remove private release candidate wording if appropriate.
- Tag first public release.
