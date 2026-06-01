# Context Budget

Context is a budget, not a warehouse.

AiML SuperAgent expects the assistant to spend context deliberately.

## Default Budget

For most tasks:

| Layer | Budget |
| --- | --- |
| Operating files | 3 files |
| Source files | 1 to 6 files |
| Logs | shortest relevant excerpt |
| Tests/proof | summarized output |
| Notes update | only durable facts |

## Escalation

Load more context only when:

- the first targeted search fails
- the dependency graph requires it
- tests show a wider regression
- the user asks for broad review
- architecture-level changes are explicitly requested

## Compression Rules

Compress before saving:

- logs longer than one screen
- repeated errors
- deployment output
- browser console dumps
- stack traces after the root cause is known

## Budget Failure Signals

The assistant is likely over budget if it:

- repeatedly reopens the same files
- references unrelated history
- edits broad areas without a narrow proof
- loses track of which repo or deployment is active
- cannot explain why a file is in context

## Practical Rule

If a file cannot plausibly affect the current task, do not load it yet.

