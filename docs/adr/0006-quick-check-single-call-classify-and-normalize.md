# ADR 0006: Quick Check classifies and normalizes in one call, reusing the pipeline rather than a second extraction path

**Status**: Accepted

## Context

Quick Check (`SCOPE.md`) needed a way to turn one typed or spoken utterance
into a `Claim`, then run it through the **same** verification/framing
pipeline as the transcript flow — not a parallel one, per that scope
bullet. The existing extraction path (`buildClaims` in
`src/server/extraction/shared.ts`) is built for a multi-speaker transcript:
one LLM call extracts zero or more claims, and `buildClaims` grounds each
against the source text. Reusing it as-is for a single utterance was
considered and rejected — it has no notion of "this input has no implicit
claim at all"; it just returns an empty list, indistinguishable from "the
model found nothing here" versus the specific "this looks like an open
question — please rephrase" response SCOPE.md calls for.

A two-call approach — a small classification call, then feeding anything
classified as a claim through the existing extraction call — was also
considered and rejected as an unnecessary extra LLM round-trip for a
"quick" feature, when classification and normalization can happen in one
call.

## Decision

Added a sibling schema/prompt/function trio to
`src/server/extraction/shared.ts`: `quickCheckResultSchema`,
`QUICK_CHECK_SYSTEM_PROMPT`, `buildQuickCheckClaim`. Classification
(`claim` vs. `no_claim`) and normalization happen together in one LLM call.
The schema is a **flat** object (`{ type, quote, extractedClaim }`), not a
discriminated union, because OpenAI's structured-output schema support
rejects a union at the schema root; `buildQuickCheckClaim` treats a blank
`quote`/`extractedClaim` the same as an explicit `no_claim`, so the flat
shape degrades safely without needing the type system to enforce it.

The call itself (`classifyQuickCheckInput` in
`src/server/extraction/openai.ts`) is OpenAI-only — not added to the
`ExtractionProvider` interface `extract()` uses. That interface exists
specifically to serve the `--provider`/`--compare` eval knob (ADR 0003),
and Quick Check has no such flag or eval harness.

Once a `Claim` exists, `src/routes/quick.tsx` calls `verifyClaimFn`
immediately — no separate "verify" click, unlike the transcript flow's
explicit per-claim button. The transcript flow's two-step design exists
because a transcript can yield many claims worth triaging before spending a
verification call on each one; a Quick Check submission is already a
single, deliberate utterance, so there is nothing to triage first.

The resulting `Claim` reuses the existing `UNKNOWN_SPEAKER` ("Unbekannt")
fallback from ADR 0005 rather than inventing speaker handling — Quick Check
has no speaker concept, so every claim it produces carries the placeholder,
and the UI simply never renders a speaker chip for this view (the field is
still populated on the `Claim`, just not shown).

## Consequences

- Quick Check and the transcript flow share `buildClaims`'s core building
  blocks (whitespace normalization, the "Unbekannt" fallback) without
  sharing its multi-claim/multi-speaker assumptions — a future signature
  change to one should prompt checking the other.
- No Mistral variant for Quick Check's classify call (see ADR 0003's
  updated consequences) — if the OpenAI-vs-Mistral extraction eval ever
  concludes in Mistral's favor and extraction switches, Quick Check would
  need its own follow-up to stay consistent.
- The flat, non-discriminated-union schema means TypeScript can't statically
  guarantee `quote`/`extractedClaim` are populated when `type: "claim"` —
  enforced only by `buildQuickCheckClaim`'s runtime check, covered by unit
  tests in `src/tests/unit/extraction-shared.test.ts`, not the type system.
- Auto-verifying spends an LLM verification call on every Quick Check
  submission with no cheap way to back out first, unlike the transcript
  flow where extraction and verification costs are decoupled per claim —
  acceptable for a single-user personal-use feature (SCOPE.md), would need
  reconsidering if Quick Check ever got real traffic.
- `VerdictPanel`/`FramingPanel` (and the German label maps, ADR 0004) were
  extracted from `src/routes/index.tsx` into
  `src/components/fact-check-panels.tsx` so both routes render verdicts and
  framing identically from one shared implementation, rather than risking
  two copies drifting apart.
