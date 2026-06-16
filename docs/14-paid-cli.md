# Paid CLI

AiML SuperAgent keeps the starter workflow free:

```bash
npx @aimlsuperagent/agent init .
npx @aimlsuperagent/agent check .
```

Paid commands use an AiML SuperAgent API key issued from `aimlsuperagent.com`.

## Commands

```bash
aiml-superagent signin
aiml-superagent signin --provider google --plan core --billing monthly
aiml-superagent signin-check
aiml-superagent login <api-key>
aiml-superagent status
aiml-superagent logout
aiml-superagent doctor .
aiml-superagent doctor . --deep
aiml-superagent sync .
aiml-superagent env-audit .
aiml-superagent context-report .
aiml-superagent ci .
aiml-superagent incident "what broke"
aiml-superagent handoff .
aiml-superagent deploy-proof .
aiml-superagent memory . --kind command --title "Build passed" --command-text "npm run build" --status success
aiml-superagent memory . --kind failure --title "Build failed" --error "Missing env var" --fix "Added env name to deployment"
aiml-superagent usage
aiml-superagent upgrade
```

`doctor` is the first paid-only command. It verifies the active API key, runs the same project readiness checks as `check`, and reports paid-feature availability.

## Browser Account Flow

Use `signin` when a customer has an account or needs to create one in the
browser:

```bash
aiml-superagent signin --provider google --plan core
```

By default, the CLI opens the AiML SuperAgent browser flow unless it is running
in CI. Use `--no-browser` to print the URL without opening it:

```bash
aiml-superagent signin --provider github --plan pro --billing yearly --no-browser
```

The browser flow does not store OAuth tokens or browser cookies in the CLI. It
stores only a pending local state with the sign-in URL, provider, plan, billing
period, and timestamp. After checkout/sign-in, the customer copies the issued API
key and runs:

```bash
aiml-superagent login <api-key>
```

Check local account state with:

```bash
aiml-superagent signin-check
```

`signin-check` succeeds only when a valid API key is configured. Pending browser
sign-in state is reported clearly but is not treated as authenticated.

## Premium Command Set

- `doctor --deep`: runs readiness checks plus context, env, stale-note, and production-proof recommendations.
- `sync`: sends bounded project metadata and readiness summary to the AiML SuperAgent cloud API.
- `env-audit`: compares env names across local env files and `.env.example` without printing values.
- `context-report`: ranks files by active-context risk and recommends read-first/search-only boundaries.
- `ci`: fails release checks for high/medium readiness findings, oversized context, or env drift.
- `incident`: creates a secret-safe incident report template with timeline, proof steps, and resolution notes.
- `handoff`: prints or writes the exact prompt to give Claude, Codex, Cursor, or another AI coding assistant.
- `deploy-proof`: writes a deployment proof file with branch, commit, proof commands, and evidence slots.
- `memory`: records paid Project Operating Memory events: commands, failures, deployments, decisions, RAG evals, conversations, and production checks.
- `usage`: shows active plan, usage count, feature entitlements, and last verification metadata.
- `upgrade --feature <name>`: explains where to subscribe for a locked paid feature.

## Project Operating Memory

Paid work can be recorded into the AiML SuperAgent operating-memory API:

```bash
aiml-superagent memory . \
  --kind command \
  --title "Build passed" \
  --summary "Production build completed after transport driver-board changes." \
  --command-text "npm run build" \
  --exit-code 0 \
  --status success
```

Supported kinds:

- `command`: command, cwd, exit code, duration, and outcome.
- `failure`: error text, root cause, fix summary, and repeated failure fingerprinting.
- `deployment`: target, URL, commit, verification status, and summary.
- `decision`: durable decision and rationale.
- `rag-eval`: retrieval/eval score, passing count, total count, and summary.
- `conversation`: durable conversation outcome, not raw chat logs.
- `production-check`: source-of-truth production verification.

The goal is not to upload every file or every note. The goal is to preserve
what helped the build: what was tried, what failed, what worked, what shipped,
and which facts changed.

Safety rules:

- Do not submit secrets, token values, full env values, customer private data, or raw private notes.
- Prefer summaries, hashes, paths relative to the repo, and command outcomes.
- Failure records should include the error and the fix that worked when known.
- Deployment records should include the commit and the fastest meaningful proof.

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

The `memory` command is different: it intentionally stores customer-submitted
operating-memory records for paid project continuity. Those records are still
bounded and should be secret-safe summaries, not raw source dumps.

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
