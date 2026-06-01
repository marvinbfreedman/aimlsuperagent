# Security Policy

AiML SuperAgent is designed around secret-safe operation.

## Reporting

Do not open public issues containing secrets.

If this repo is made public, use the repository security contact or private advisory flow for sensitive reports.

## Secret Policy

Documentation may include:

- env var names
- credential roles
- placeholder values

Documentation must not include:

- credential values
- private keys
- production database URLs
- passwords
- customer PII

Run before release:

```bash
npm run check
```

