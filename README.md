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
npx aiml-superagent init .
```

Check a project for SuperAgent readiness:

```bash
npx aiml-superagent check .
```

For personal machine-wide use, install the CLI globally:

```bash
npm i -g @aimlsuperagent/agent
aiml-superagent check .
```

Freshly initialized projects are expected to show `needs-review` until template placeholders for project name, dates, and proof commands are replaced.

From this repository, maintainers can run:

```bash
npm run check
npm run pack:dry-run
```

Before making a repo public:

```bash
npx aiml-superagent check . --release
```

For CI where medium-risk findings should fail the build:

```bash
npx aiml-superagent check . --strict
```

## Package Analytics

CLI analytics is disabled by default.

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
5. Run `npx aiml-superagent check`.
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

Private release candidate. The repository can remain private while using the MIT License; the license defines reuse terms if and when the project is shared publicly.

Package name: `@aimlsuperagent/agent`.

The npm package uses restricted/private access while early testing continues. Authorized users must be added to the npm organization/team and run `npm login` before installing. See [docs/npm-private-publishing.md](docs/npm-private-publishing.md).

## License

MIT License. See [LICENSE](LICENSE).
