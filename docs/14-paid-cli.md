# Paid CLI

AiML SuperAgent keeps the starter workflow free:

```bash
npx @aimlsuperagent/agent init .
npx @aimlsuperagent/agent check .
```

Paid commands use an AiML SuperAgent API key issued from `aimlsuperagent.com`.

## Commands

```bash
aiml-superagent login <api-key>
aiml-superagent status
aiml-superagent logout
aiml-superagent doctor .
aiml-superagent upgrade
```

`doctor` is the first paid-only command. It verifies the active API key, runs the same project readiness checks as `check`, and reports paid-feature availability.

## Usage And Feature Tracking

Every successful paid verification increments the API key's server-side `usage_count`.

The verification endpoint also records a bounded feature event with:

- feature key
- command name
- package name and version
- Node major version
- operating system platform
- CPU architecture
- CI flag
- safe option flags such as `json`, `release`, and `strict`

The event is used to understand paid feature adoption and plan usage.

It must not include:

- file contents
- note contents
- source code
- repo names
- absolute paths
- environment variable values
- secrets or credentials
- customer project data

## Local Login

Use `login` on a trusted local machine:

```bash
aiml-superagent login aiml_live_xxx
```

The CLI verifies the key with:

```text
POST https://aimlsuperagent.com/api/superagent/keys/verify
Authorization: Bearer <api-key>
```

If the key is active, the CLI stores a local config file at:

```text
~/.aimlsuperagent/config.json
```

The file is written with `0600` permissions when the filesystem supports POSIX permissions.
The config stores the API key, API base URL, key prefix, plan key, and verification timestamp. It does not need to store customer email or billing details.

## CI Usage

Use an environment variable in CI instead of storing a local config file:

```bash
AIML_SUPERAGENT_API_KEY=aiml_live_xxx aiml-superagent doctor .
```

The CLI reads keys in this order:

1. `--key`
2. positional key for `login`
3. `AIML_SUPERAGENT_API_KEY`
4. `~/.aimlsuperagent/config.json`

## API URL Override

Use a different compatible API base URL for staging or self-hosted testing:

```bash
aiml-superagent status --api-url https://example.com
```

Or:

```bash
AIML_SUPERAGENT_API_URL=https://example.com aiml-superagent status
```

The default API base URL is:

```text
https://aimlsuperagent.com
```

## Secret Safety

The CLI must not print the full API key after login. Output uses a masked key or the server-returned key prefix.
Status and doctor output also mask customer email addresses.

Do not commit:

- `~/.aimlsuperagent/config.json`
- real API keys
- real customer data
- private notes
- local machine paths that reveal private infrastructure

For project-specific setup, prefer storing only variable names and roles in committed docs.

## Privacy Boundary

`doctor` sends the API key only to the configured verification endpoint.

It does not send:

- file contents
- note contents
- source code
- repo names
- absolute paths
- environment variable values
- secrets or credentials

`doctor` performs local readiness checks after the key is verified.

Package analytics remains separate and opt-in. See `docs/13-package-analytics.md`.
