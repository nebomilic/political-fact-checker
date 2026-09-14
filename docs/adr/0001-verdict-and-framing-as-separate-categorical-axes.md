# ADR 0001: Verdict and framing as separate categorical axes, not a single score

**Status**: Accepted

## Context

Needed a way to represent both a claim's accuracy and whether it's being
presented misleadingly. A single blended score (a "truth-o-meter" style
percentage) was the obvious default — familiar from existing fact-check UIs,
compact to display.

## Decision

Two separate, structurally distinct fields, never merged:

- **Verdict category**: `True | False | Partly true | Unverifiable | Disputed`
- **Framing flag**: `No issue | Missing context | Misleading framing`

A numeric confidence (0–1) exists internally for thresholding and sorting,
but is never shown to the user as a raw number — at most a coarse
High/Medium/Low tag.

## Consequences

- Avoids false precision: an LLM's confidence isn't a calibrated probability,
  and presenting it as one invites more trust than it's earned.
- Avoids a single number that gets screenshotted and weaponized out of
  context — a risk specific to a tool making claims about named politicians.
- Keeps `Disputed` and `Unverifiable` visible as real, distinct outcomes
  instead of being forced into a binary true/false.
- This principle resurfaced later when designing a per-speaker aggregate
  view — a plain count breakdown ("4 True, 2 False") was flagged as
  potentially reintroducing the same weaponizable-single-number risk one
  level up. Not yet resolved; worth revisiting when that view is built.
- Costs more UI space and more user education than a single score would —
  two axes to explain instead of one number to glance at.
