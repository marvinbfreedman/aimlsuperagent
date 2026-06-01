# Anti-Patterns

AiML SuperAgent exists to prevent common long-running agent failures.

## Giant Prompt Syndrome

The assistant receives every rule, every note, every log, and every file.

Result:

- slow reasoning
- higher cost
- stale assumptions
- lower precision

Fix:

- read durable memory first
- search for task-specific context
- summarize proof output

## Transcript Memory

Working notes become a chronological chat transcript.

Result:

- important facts buried
- contradictions accumulate
- old incidents keep resurfacing

Fix:

- record conclusions, not conversations
- archive resolved incidents
- mark stale facts

## Production Blindness

The assistant treats the repo as the whole system.

Result:

- wrong backend patched
- env var mismatch missed
- hosted config ignored
- deployment assumed but not verified

Fix:

- verify production reality when live state matters
- record deploy surfaces
- keep env audits secret-safe

## Helpful Refactor Drift

The assistant improves adjacent code while fixing a narrow issue.

Result:

- hard-to-review diffs
- regressions
- merge conflicts

Fix:

- changed lines must trace to the task
- mention unrelated cleanup instead of doing it

## Secret Memory

The assistant saves credential values to notes for convenience.

Result:

- leaked secrets
- unsafe examples
- polluted commit history

Fix:

- store names and roles only
- use placeholders
- run the checker before release

