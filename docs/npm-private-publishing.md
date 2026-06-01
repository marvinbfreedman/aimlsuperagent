# Private npm Publishing

This repository is prepared for a private npm package named:

```text
@aimlsuperagent/agent
```

Do not publish until npm confirms that the `@aimlsuperagent` scope is owned by the correct account or organization and private packages are enabled.

## Current Safety State

`package.json` intentionally keeps:

```json
"private": true
```

That blocks accidental publishing.

The package also includes:

```json
"publishConfig": {
  "access": "restricted",
  "registry": "https://registry.npmjs.org/"
}
```

Restricted access is the npm setting required for a private scoped package.

## Confirm Scope Ownership

Log in:

```bash
npm login
npm whoami
```

Check organization or scope access:

```bash
npm org ls aimlsuperagent
npm access ls-packages @aimlsuperagent
```

If those commands fail because the scope or organization does not exist, create or claim the npm organization/scope before publishing.

## Dry Run

Run:

```bash
npm run check:release
npm run pack:dry-run
```

Review the file list. It should include docs, templates, examples, schemas, the CLI, and root operating files. It should not include secrets, local logs, or build output.

## Publishing Procedure

Only after private package access is confirmed:

1. Remove `"private": true` from `package.json` in a dedicated publish commit.
2. Run:

```bash
npm run check:release
npm run pack:dry-run
npm publish --access restricted
```

Do not run `npm publish --access public`.

## Install

Authorized users can install globally:

```bash
npm login
npm i -g @aimlsuperagent/agent
aiml-superagent --help
```

## Failure Rule

If npm cannot confirm restricted/private access, do not publish. Keep using the private GitHub repo or a private tarball.

