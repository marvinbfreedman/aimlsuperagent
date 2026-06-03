#!/usr/bin/env node

if (process.env.CI || process.env.AIMLSUPERAGENT_NO_POSTINSTALL) {
  process.exit(0);
}

console.log(`
AiML SuperAgent installed.

Next steps:
  npx @aimlsuperagent/agent init .
  npx @aimlsuperagent/agent check .

Then tell your AI assistant:
  Read AGENTS.md, REPO_SOURCE_OF_TRUTH.json, and WORKING_NOTES.md first.
  Use them as project operating context before editing code.
  Before changing code, confirm which backend, service, deployment, or environment is live when relevant; check DEPLOYMENT_LOG.md and PRODUCTION_CHECK.md when available; inspect the relevant source file; avoid stale notes; make the smallest safe diff; run the fastest meaningful proof; and update durable memory only if reality changed.

Docs:
  https://github.com/marvinbfreedman/aimlsuperagent

To hide this message:
  AIMLSUPERAGENT_NO_POSTINSTALL=1 npm install
`);
