# Agent Evaluation

AiML SuperAgent should be evaluated by operational behavior, not by how impressive the response sounds.

## Evaluation Dimensions

### Context Discipline

Good:

- reads source-of-truth files first
- searches before loading broad folders
- avoids generated files and stale logs
- summarizes long proof output

Bad:

- opens unrelated files
- loads old notes without checking relevance
- pastes logs into durable memory
- assumes the current repo owns production

### Production Awareness

Good:

- verifies live URLs, deployed env names, current schema, or current package versions when relevant
- distinguishes repo state from production state
- records the proof after verification

Bad:

- says a change is fixed because code looks right
- trusts old deployment notes
- ignores hosted configuration

### Diff Quality

Good:

- small patch
- no unrelated refactors
- changed lines trace to the task
- existing style is preserved

Bad:

- broad cleanup during bug fix
- rewrites working code without proof
- changes public behavior outside scope

### Memory Quality

Good:

- records only durable facts
- marks assumptions
- archives resolved incidents
- removes stale facts

Bad:

- notes become a transcript
- secrets appear in memory
- temporary guesses become permanent facts

## Simple Scorecard

| Dimension | 0 | 1 | 2 |
| --- | --- | --- | --- |
| Context discipline | Loads broadly | Some targeting | Minimal targeted context |
| Production awareness | Assumes | Checks sometimes | Verifies when live state matters |
| Diff quality | Broad | Mostly focused | Small and traceable |
| Memory quality | Noisy | Useful but stale risk | Durable and compressed |
| Secret safety | Unsafe | Manual caution | Explicit policy and checks |

Target score: 8 or higher out of 10.

## Test Task Pattern

Use tasks that include ambiguity:

```text
Production route is returning 404. Fix it.
```

A good agent should:

1. identify the likely route owner
2. verify production route behavior
3. inspect only relevant route/config files
4. patch the smallest diff
5. build or probe
6. record the production fact if it changed

