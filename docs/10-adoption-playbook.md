# Adoption Playbook

AiML SuperAgent can be adopted gradually.

## Phase 1: Add Operating Files

Add:

- `AGENTS.md`
- `REPO_SOURCE_OF_TRUTH.json`
- `WORKING_NOTES.md`

Run:

```bash
npm i -D @aimlsuperagent/agent
npx @aimlsuperagent/agent check .
```

Replace every placeholder before relying on the output.

## Phase 2: Add Verification

Define the fastest meaningful proof commands:

- typecheck
- build
- unit test
- smoke probe
- read-only production check

Store them in `REPO_SOURCE_OF_TRUTH.json`.

## Phase 3: Add Deployment Memory

Add:

- `DEPLOYMENT_LOG.md`
- `SAFE_ENV_AUDIT.md`

Record only verified deployments. Do not record planned deployments as completed.

## Phase 4: Add Tool Adapters

Use adapter files for each assistant:

- `adapters/claude/CLAUDE.md`
- `adapters/codex/AGENTS.md`
- `adapters/cursor/rules.md`

Keep the project source of truth centralized. Vendor-specific files should be thin wrappers.

## Phase 5: Maintain Notes

Review notes regularly:

- archive resolved incidents
- compress long logs
- remove stale facts
- mark assumptions explicitly

The framework fails if notes become a junk drawer.
