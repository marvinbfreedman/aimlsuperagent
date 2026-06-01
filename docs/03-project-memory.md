# Project Memory

AiML SuperAgent memory is not a transcript. It is an operating index.

## Memory Types

### Source Of Truth

File: `REPO_SOURCE_OF_TRUTH.json`

Stores stable facts:

- project name and purpose
- production owners
- deploy surfaces
- package manager
- default verification commands
- context minimizer rules
- secret policy

### Working Notes

File: `WORKING_NOTES.md`

Stores current durable facts:

- active architecture decisions
- recent production findings
- unresolved risks
- test devices or accounts
- known temporary workarounds

### Deployment Log

File: `DEPLOYMENT_LOG.md`

Stores:

- deployed version
- date
- environment
- URL or platform
- verification result
- rollback note

### Incident Reports

File: `INCIDENT_REPORT.md` or dated files under `incidents/`

Stores only incidents that change future behavior.

### Safe Environment Audit

File: `SAFE_ENV_AUDIT.md`

Stores env var names, roles, owners, and expected environments. Never store values.

## Memory Quality Test

A note is worth keeping if it helps answer one of these:

- Which repo owns production?
- Which backend is live?
- Which env var is still active?
- Which failure was already fixed?
- Which command proves the current behavior?
- Which files are dangerous to edit blindly?

If not, archive or delete it.

## Staleness Policy

Every durable fact should be easy to challenge.

Use labels:

- `verified`
- `assumed`
- `deprecated`
- `needs-check`

Do not let assumptions age into facts.

