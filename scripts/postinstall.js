#!/usr/bin/env node

if (process.env.CI || process.env.AIMLSUPERAGENT_NO_POSTINSTALL) {
  process.exit(0);
}

console.log(`
AiML SuperAgent installed.

Next steps:
  npx @aimlsuperagent/agent init .
  npx @aimlsuperagent/agent check .

Docs:
  https://github.com/marvinbfreedman/aimlsuperagent

To hide this message:
  AIMLSUPERAGENT_NO_POSTINSTALL=1 npm install
`);
