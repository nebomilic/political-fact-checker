# ADR 0004: German-only UI copy, English internal verdict/framing taxonomy

**Status**: Accepted

## Context

The app is German-only for end users — single-user, local use, German
political statements (see `SCOPE.md`). The app's own UI chrome (headings,
buttons, labels, error messages) was originally English, a leftover from
building the pipeline before polishing the shell; the AI-generated content
(verdict/framing explanations) was already German by design (see the
grounding/prompt work — the model is instructed to answer exclusively in
German).

`VerdictCategory` (`True | False | Partly true | Unverifiable | Disputed`)
and `FramingFlag` (`No issue | Missing context | Misleading framing`) are
literal-union types that drive more than display: the LLM's structured-
output schema (`src/server/verification/shared.ts`), the eval fixtures
(`verification-cases.ts`), and `CLAUDE.md`'s documented convention to keep
verdict and framing as separate, never-merged fields (see ADR 0001).

## Decision

Translate only at the presentation layer. `src/components/fact-check-panels.tsx`
defines two `Record<VerdictCategory, string>` / `Record<FramingFlag, string>`
maps (`VERDICT_LABELS`, `FRAMING_LABELS`) that translate purely for display —
e.g. `True` → "Wahr", `Missing context` → "Fehlender Kontext". The
underlying type, schema, prompts, and eval fixtures stay English and
unchanged. Panel headers ("Bewertung"/"Darstellung") were chosen to match
the vocabulary German fact-check outlets (Correctiv, ARD-faktenfinder —
both named in `SCOPE.md`) actually use, rather than a literal
word-for-word translation of "Verdict"/"Framing".

(Originally these maps lived in the transcript flow's route file (now
`src/routes/transcript.tsx`; it was `src/routes/index.tsx` before ADR 0008's
route swap); when Quick Check added a second route needing the same panels,
`VerdictPanel`/`FramingPanel`
and both maps were extracted into `src/components/fact-check-panels.tsx` so
both routes share one translation layer rather than risking two maps
drifting apart — see ADR 0006.)

## Consequences

- Schema, prompts, and eval fixtures don't need to change if the UI
  language changes again (a second language, or English restored) — only
  the display maps would.
- The maps are typed as `Record<VerdictCategory, string>` /
  `Record<FramingFlag, string>`, so TypeScript's exhaustiveness checking
  turns "added a new verdict category to the schema, forgot the German
  label" into a compile error rather than an English string silently
  leaking into the German UI.
- Two sources of truth to keep mentally in sync: the internal literal value
  and its display string. Not enforced beyond the exhaustiveness check —
  nothing stops the German label from drifting out of sync in meaning from
  the English value it maps from.
- A small number of server-thrown error strings were also translated at
  their throw site (`claim-extraction.functions.ts`,
  `claim-verification.functions.ts`) since they render verbatim in the UI.
  Deeper internal/operational error messages (missing API key, grounding
  failures, provider-specific parse errors, etc.) were deliberately left
  English — translating every throw site across the server/provider layer
  is a much larger effort than a UI copy pass, and this is still a
  single-user local tool where that tradeoff is acceptable for now.
