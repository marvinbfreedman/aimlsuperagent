# Secret-Safe Operations

AiML SuperAgent requires secret-safe memory.

Agents need to know which credentials exist and what they do. They do not need credential values in notes.

## Allowed

- variable names
- credential role
- service owner
- environment scope
- rotation date
- where to update the value
- placeholder examples

Example:

```text
OPENAI_API_KEY
Role: server-side model calls
Environments: production, preview
Owner: platform
Value: never stored in repo
```

## Forbidden

- actual API keys
- database URLs with passwords
- private keys
- access tokens
- refresh tokens
- production passwords
- customer PII
- password hashes tied to real users

## Redaction Pattern

Use this form:

```text
sk-...abcd
postgres://USER@HOST/DB
CR...1234
```

## Environment Audits

Use `SAFE_ENV_AUDIT.md` to record:

- env var name
- expected environment
- role
- source of truth
- stale duplicate risk
- verification date

Never paste values.

## Agent Rule

If a user gives a secret in chat or terminal, use it only for the immediate task when necessary. Do not write it to durable notes, examples, commit messages, logs, or documentation.
