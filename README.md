# AiML SuperAgent

A token-efficient operating framework for AI coding assistants.

AiML SuperAgent turns an AI coding assistant into a long-term project operator. It keeps scoped memory, verifies production reality before changing code, protects secrets, tracks deployments, minimizes wasted context, and produces small safe diffs.

This is not another prompt collection. It is a repeatable operating layer for real repositories.

## Why AiML SuperAgent?

Most AI coding assistants fail on long-running projects for two reasons:

1. They forget durable production facts.
2. They overload themselves with stale or irrelevant context.

A behavior file such as `CLAUDE.md` can teach an assistant how to behave in one session: think first, keep changes small, avoid assumptions, and verify results. That is useful and should be kept.

AiML SuperAgent adds the missing operating layer:

- scoped project memory
- source-of-truth files
- production-first verification
- secret-safe notes
- deployment logs
- incident memory
- context minimization
- task-traceable diffs
- model-agnostic workflows

Use `CLAUDE.md` for behavior. Use AiML SuperAgent for project operation.

## Capability Snapshot

AiML SuperAgent now connects the public package, paid CLI, website checkout, and API-key verification flow:

- Free repo setup with `init` and `check`
- Paid API-key login with `login`, `status`, `logout`, and `upgrade`
- Paid `doctor` command for readiness checks and release-aware proof
- Premium commands for `doctor --deep`, `sync`, `env-audit`, `context-report`, `ci`, `incident`, `handoff`, `deploy-proof`, and `usage`
- Server-side API key `usage_count`
- Bounded feature usage events such as `license_login`, `license_status`, and `doctor`
- Plan feature entitlements returned by the verification API
- Stripe-backed customer subscription and API-key issuance on `aimlsuperagent.com`
- Privacy-safe tracking that never sends file contents, notes, source code, repo paths, env values, or secrets

## The Core Idea

The goal is not bigger notes.

The goal is smaller active context.

AiML SuperAgent separates durable memory from temporary work. The assistant starts with high-signal files, then searches only the parts of the repo relevant to the current task.

Default read order:

1. `AGENTS.md`
2. `REPO_SOURCE_OF_TRUTH.json`
3. `WORKING_NOTES.md`
4. the current task prompt
5. targeted source files found by search

Default skip list:

- `node_modules`
- build output
- `.next`
- `dist`
- `coverage`
- derived data
- generated artifacts
- large logs
- resolved incidents
- old screenshots
- unrelated archives

That is the Context Minimizer.

## What This Repo Provides

```text
aiml-superagent/
  README.md
  AGENTS.md
  bin/
    aiml-superagent.js
  docs/
    01-operating-model.md
    02-context-minimizer.md
    03-project-memory.md
    04-verification-loop.md
    05-secret-safe-operations.md
    06-deployment-discipline.md
    07-note-hygiene.md
    08-model-agnostic-use.md
    09-agent-evaluation.md
    10-adoption-playbook.md
    11-anti-patterns.md
    12-context-budget.md
    13-package-analytics.md
    14-paid-cli.md
    comparison-claude-md.md
    release-checklist.md
  schemas/
    repo-source-of-truth.schema.json
  templates/
    AGENTS.template.md
    REPO_SOURCE_OF_TRUTH.template.json
    WORKING_NOTES.template.md
    DEPLOYMENT_LOG.template.md
    INCIDENT_REPORT.template.md
    SAFE_ENV_AUDIT.template.md
    PRODUCTION_CHECK.template.md
    TASK_BRIEF.template.md
  examples/
    nextjs-vercel-app/
      README.md
      AGENTS.md
      REPO_SOURCE_OF_TRUTH.json
      WORKING_NOTES.md
```

## Quick Start

Install the package in your project. This is the recommended setup for teams and CI because the CLI version is pinned in `package.json`:

```bash
npm i -D @aimlsuperagent/agent
```

Copy the templates into a project:

```bash
npx @aimlsuperagent/agent init .
```

Check a project for SuperAgent readiness:

```bash
npx @aimlsuperagent/agent check .
```

## After Init

After `init` and `check`, tell your AI coding assistant:

```text
Read AGENTS.md, REPO_SOURCE_OF_TRUTH.json, and WORKING_NOTES.md first.
Use them as the project operating context.
Before changing code, confirm which backend, service, deployment, or environment is live when relevant; check DEPLOYMENT_LOG.md and PRODUCTION_CHECK.md when available; inspect the relevant source file; avoid stale notes; make the smallest safe diff; run the fastest meaningful proof; and update durable memory only if reality changed.
Do not store secrets, credential values, private customer data, local machine paths, or scratch-only notes in committed files.
```

Generated notes are intended to be safe to commit only after you keep them value-free: record names, roles, decisions, and verification summaries, never credential values, private customer data, local machine paths, or scratch-only notes.

For personal machine-wide use, install the CLI globally:

```bash
npm i -g @aimlsuperagent/agent
aiml-superagent check .
```

Freshly initialized projects are expected to show `needs-review` until template placeholders for project name, dates, and proof commands are replaced.

## Paid CLI

The core project workflow stays free:

```bash
npx @aimlsuperagent/agent init .
npx @aimlsuperagent/agent check .
```

Paid commands use an AiML SuperAgent API key from `aimlsuperagent.com`.

```bash
aiml-superagent login <api-key>
aiml-superagent status
aiml-superagent doctor .
aiml-superagent doctor . --deep
aiml-superagent env-audit .
aiml-superagent context-report .
aiml-superagent handoff .
```

Use environment variables instead of local key storage in CI:

```bash
AIML_SUPERAGENT_API_KEY=aiml_live_xxx aiml-superagent doctor .
```

`doctor` is the first paid-only command. It verifies the API key, runs the readiness checks, and reports paid-feature availability without sending file contents, notes, source code, repo names, paths, or secrets.

Paid verification increments server-side API key usage and records bounded feature events such as `license_login`, `license_status`, and `doctor`.

See [docs/14-paid-cli.md](docs/14-paid-cli.md).

From this repository, maintainers can run:

```bash
npm run check
npm run pack:dry-run
```

Before making a repo public:

```bash
npx @aimlsuperagent/agent check . --release
```

For CI where medium-risk findings should fail the build:

```bash
npx @aimlsuperagent/agent check . --strict
```

## Package Analytics

**CLI analytics is disabled by default.**

Enable it only when you want package usage events sent to the AiML SuperAgent tracking endpoint:

```bash
AIML_SUPERAGENT_ANALYTICS=1 aiml-superagent check .
```

You can also enable or disable it per command:

```bash
aiml-superagent check . --analytics
aiml-superagent check . --no-analytics
```

The package sends only privacy-safe operational metadata: command name, package version, Node major version, platform, architecture, CI flag, duration, exit code, readiness label, and finding counts. It does not send file contents, absolute paths, repo names, project names, environment variable values, credentials, or note contents. Like any HTTP request, the receiving endpoint may also receive normal request metadata such as IP address and user-agent.

Use `AIML_SUPERAGENT_ANALYTICS_ENDPOINT` to point the package at a different compatible endpoint.

## The Operating Loop

Every task follows the same loop:

```text
1. Orient
   Read only the source-of-truth files and the active task.

2. Verify
   Check production reality before changing code when the answer depends on live state.

3. Narrow
   Search for the smallest source area that can solve the task.

4. Patch
   Make the smallest safe diff.

5. Prove
   Run the fastest meaningful test or runtime check.

6. Record
   Update durable notes only if reality changed.
```

## Framework Guarantees

AiML SuperAgent is designed to make an assistant:

- explicit about assumptions
- resistant to stale context
- careful with secrets
- aware of production and deployment state
- less likely to edit the wrong repo
- less likely to over-refactor
- more likely to leave a useful audit trail

It does not guarantee correctness. It gives the assistant a better operating system for reaching correctness.

## Maturity Model

AiML SuperAgent adoption has four levels:

| Level | Name | Description |
| --- | --- | --- |
| 0 | Behavior only | A single behavior file tells the assistant to be careful. |
| 1 | Scoped memory | The project has source-of-truth files and working notes. |
| 2 | Verified operation | The assistant checks production reality and records proof. |
| 3 | Context-minimized operation | The assistant loads only durable memory and targeted task context by default. |

The public goal of this framework is Level 3.

## Model Support

AiML SuperAgent is model-agnostic. It works with:

- Claude
- GPT-5.5
- Codex
- Cursor
- Perplexity
- Gemini
- local models
- future coding agents

The model can change. The operating discipline should remain stable.

## Recommended Adoption Path

1. Add `AGENTS.md`, `REPO_SOURCE_OF_TRUTH.json`, and `WORKING_NOTES.md`.
2. Fill in production owners, deployment surfaces, package manager, test commands, and secret names.
3. Add `DEPLOYMENT_LOG.md` after the next live deploy.
4. Add incident reports only for issues that change future behavior.
5. Run `npx @aimlsuperagent/agent check`.
6. Iterate until the checker reports no high-risk gaps.

## Design Principles

- Memory should be durable, scoped, and revisable.
- Context should be loaded by relevance, not by habit.
- Secrets should be referenced by name and role, never by value.
- Production reality beats repo assumptions.
- A small verified diff beats a large plausible rewrite.
- Notes should reduce future token use, not increase it.

## How This Improves on a Single Behavior File

The viral `CLAUDE.md` approach is valuable because it gives assistants simple behavioral rules. AiML SuperAgent builds on that idea by adding project-level operation:

- where to find durable facts
- how to avoid stale context
- how to verify live systems
- how to record deployments and incidents
- how to protect secrets
- how to keep memory useful over months, not just one session

See [docs/comparison-claude-md.md](docs/comparison-claude-md.md).

## Status

Public release candidate. The repository and npm package are public under the MIT License.

Package name: `@aimlsuperagent/agent`.

Install globally with `npm i -g @aimlsuperagent/agent`, or run directly with `npx @aimlsuperagent/agent`. See [docs/npm-publishing.md](docs/npm-publishing.md).

## License

MIT License. See [LICENSE](LICENSE).
