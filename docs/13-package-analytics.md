# Package Analytics

AiML SuperAgent package analytics is opt-in.

The CLI does not send analytics unless one of these is true:

- `AIML_SUPERAGENT_ANALYTICS=1` is set.
- The command is run with `--analytics`.

Use `--no-analytics` to disable analytics for one command even when the environment variable is enabled.

## Why It Exists

Package analytics helps answer operational questions without weakening the framework's privacy and secret-safety rules:

- Which CLI commands are used?
- Are readiness checks passing?
- Are release checks failing before publish?
- Which Node major versions need support?
- Are commands running locally or in CI?

## What Is Sent

When enabled, the CLI sends one best-effort event per command:

- package name
- package version
- command name
- result status
- exit code
- command duration
- Node major version
- operating system platform
- CPU architecture
- CI flag
- selected command options
- readiness label and finding counts for `check`
- action counts for `init`

## What Is Never Sent

The CLI must not send:

- file contents
- note contents
- absolute paths
- repo names
- project names
- remote URLs
- environment variable values
- secrets or credentials
- source code snippets

## Endpoint

By default, events are sent to:

```bash
https://aimlsuperagent.com/api/visitor-track
```

Use a compatible endpoint if you want to collect events somewhere else:

```bash
AIML_SUPERAGENT_ANALYTICS=1 \
AIML_SUPERAGENT_ANALYTICS_ENDPOINT=https://example.com/api/track \
aiml-superagent check .
```

The endpoint receives a generic tracking payload with `eventName`, `siteName`, `path`, `title`, and `data`.

Like any HTTP request, the receiving endpoint may also receive normal request metadata such as IP address and user-agent.

## Failure Behavior

Analytics is best-effort. Network errors, timeouts, invalid endpoints, and server failures are ignored by the CLI.

Analytics must never change the command output, exit code, or readiness result.
