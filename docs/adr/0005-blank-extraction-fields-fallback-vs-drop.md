# ADR 0005: Blank extraction fields — placeholder speaker, dropped content

**Status**: Accepted

## Context

A real transcript with no `[Name]:` speaker label — the kind of real-world
input `MANUAL_TESTS.md`'s workflow exists to surface — produced a claim
with an empty `speaker`.
The verification RPC validator (`findMissingClaimField` in
`claim-verification.functions.ts`) correctly rejected it — `Claim.speaker`
is a required, non-empty field downstream — but the UI rendered the empty
speaker as an invisible blank line, so the resulting error looked like an
unrelated bug rather than a consequence of unlabeled input.

The underlying question: when the extraction model returns a blank field on
a candidate claim, should the claim be silently dropped, or patched up and
kept?

## Decision

`buildClaims` (`src/server/extraction/shared.ts`) answers this differently
per field, based on whether a safe placeholder exists:

- **`speaker`**: falls back to a placeholder ("Unbekannt") rather than
  dropping the claim. A missing speaker label is expected, ordinary input —
  plenty of real transcripts don't label every speaker — and discarding a
  real, checkable claim over a labeling gap would lose actual content for a
  cosmetic reason.
- **`quote` / `extractedClaim`**: the claim is dropped, not patched. There is
  no safe placeholder for actual claim content — fabricating a quote or
  claim statement would violate the transcript-grounding guarantee (see
  `CLAUDE.md`'s grounding convention and the extraction header comment)
  far more seriously than losing one candidate claim does.

## Consequences

- Every claim the extraction step returns to the app is guaranteed to pass
  the verification RPC's validator — `findMissingClaimField` should now be
  unreachable from normal UI use, and is kept purely as defense-in-depth at
  that RPC boundary rather than a path users can actually hit.
- Locked in with fast, deterministic unit tests
  (`src/tests/unit/extraction-shared.test.ts`,
  `src/tests/unit/claim-verification-functions.test.ts`) rather than an
  eval fixture, since this is pure logic with no LLM call involved — see
  `CLAUDE.md`'s convention on where that kind of test belongs.
- `"Unbekannt"` is hardcoded German text inside a provider-agnostic file
  that both the OpenAI and Mistral extraction providers route through —
  fine while the UI is German-only (ADR 0004), but worth revisiting
  together with that decision if a second UI language is ever added.
- The same placeholder is now also `buildQuickCheckClaim`'s speaker for
  every Quick Check claim, not just `buildClaims`' fallback for an
  unlabeled transcript speaker (see ADR 0006) — Quick Check has no speaker
  concept at all, so this fallback became the only speaker value that path
  ever produces, reused as-is rather than given its own handling.
