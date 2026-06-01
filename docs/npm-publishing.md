# npm Publishing

This repository publishes a public npm package named:

```text
@aimlsuperagent/agent
```

The package is public. Anyone can install it from the npm registry without joining the `aimlsuperagent` npm organization.

## Current Publish State

`package.json` includes:

```json
"publishConfig": {
  "access": "public",
  "registry": "https://registry.npmjs.org/"
}
```

Public access is intentional for the scoped package.

## Confirm Current Access

Check package visibility:

```bash
npm access get status @aimlsuperagent/agent
```

Expected current shape:

- package status: `public`
- package name: `@aimlsuperagent/agent`
- repository: `github.com/marvinbfreedman/aimlsuperagent`

```bash
npm i -g @aimlsuperagent/agent
aiml-superagent --help
```

## Dry Run

Run:

```bash
npm run check:release
npm run pack:dry-run
```

Review the file list. It should include docs, templates, examples, schemas, the CLI, and root operating files. It should not include secrets, local logs, or build output.

## Publishing Procedure

For a new public version:

1. Bump the package version.
2. Run:

```bash
npm run check:release
npm run pack:dry-run
npm publish --access public
```

## Trusted Publishing

npm recommends Trusted Publishing for automation and CI/CD. This repository includes:

```text
.github/workflows/npm-publish.yml
```

Trusted Publishing is configured for this package:

- Provider: GitHub Actions
- Organization or user: `marvinbfreedman`
- Repository: `aimlsuperagent`
- Workflow filename: `npm-publish.yml`
- Allowed action: `npm publish`

Use GitHub Actions > Publish npm package > Run workflow. The workflow uses GitHub OIDC instead of a long-lived `NPM_TOKEN`.

## Install

Anyone can install globally:

```bash
npm i -g @aimlsuperagent/agent
aiml-superagent --help
```

## Failure Rule

If `npm run check:release` or `npm run pack:dry-run` fails, do not publish. Fix the release blocker first.
