# Private npm Publishing

This repository is prepared for a private npm package named:

```text
@aimlsuperagent/agent
```

The package is currently published as a private/restricted npm package. Users who are not authenticated and authorized will see npm `404 Not Found` errors that can look like the package or organization does not exist.

## Current Safety State

`package.json` includes:

```json
"publishConfig": {
  "access": "restricted",
  "registry": "https://registry.npmjs.org/"
}
```

Restricted access is the npm setting required for a private scoped package.

## Confirm Current Access

Log in:

```bash
npm login
npm whoami
```

Check organization or scope access:

```bash
npm org ls aimlsuperagent
npm team ls aimlsuperagent
npm team ls aimlsuperagent:developers
npm access get status @aimlsuperagent/agent
npm access list packages aimlsuperagent:developers
```

Expected current shape:

- package status: `private`
- org owner: `aimlnexus`
- install team: `aimlsuperagent:developers`
- team package access: `@aimlsuperagent/agent` read-only

## Add A Private Package User

Use the person's npm username, not their email address.

```bash
npm org set aimlsuperagent npm_username developer
npm team add aimlsuperagent:developers npm_username
```

The user must accept the npm organization invite, then run:

```bash
npm login
npm i -g @aimlsuperagent/agent
aiml-superagent --help
```

If they still see `404 Not Found`, they are either not logged in, have not accepted the org invite, are not in the `developers` team, or are using a different npm registry.

## Dry Run

Run:

```bash
npm run check:release
npm run pack:dry-run
```

Review the file list. It should include docs, templates, examples, schemas, the CLI, and root operating files. It should not include secrets, local logs, or build output.

## Publishing Procedure

For a new private version:

1. Bump the package version.
2. Run:

```bash
npm run check:release
npm run pack:dry-run
npm publish --access restricted
```

Do not run `npm publish --access public`.

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

Authorized users can install globally:

```bash
npm login
npm i -g @aimlsuperagent/agent
aiml-superagent --help
```

## Failure Rule

If npm cannot confirm restricted/private access, do not publish. Keep using the private GitHub repo or a private tarball.
