# PRD — Fact-Checker MVP (v0)

Boundaries (what's in/out, success criteria, open questions) live in `SCOPE.md` — not duplicated here. This document defines what to actually build: the user flow and the data shapes that operationalize that scope. Implementation conventions live in `CLAUDE.md`.

## Problem

Political conversations mix true claims, false claims, and true-but-misleadingly-framed claims. Existing German fact-checkers (Correctiv, ARD-faktenfinder, dpa) are thorough but manual and slow. v0 tests whether an LLM pipeline can do claim-level fact-checking — plus a separate check for misleading framing — accurately enough to be useful, for German-language political text.

## User flow

1. User pastes a transcript into a text box. Speakers are labeled manually within the pasted text (e.g. `[Name]: ...`) — no diarization.
2. System extracts discrete, checkable factual claims, each tagged to a speaker and an exact quote from the source text.
3. Each claim is verified against retrieved evidence (never from model memory) and assigned a categorical verdict with cited sources.
4. Each claim separately gets a framing assessment — kept structurally distinct from the verdict, never merged into one score.
5. Output: a list of extracted claim cards shown below the input form. Each card shows the exact quote, a verify action, and the verdict + framing panels once run (kept structurally separate, per the framing rule above).

## Data model

Implemented in `src/types/fact-check.ts` — that file is the source of truth for exact field names and types. This section explains the concepts and reasoning; if the two ever disagree, the code wins.

**Claim**
- `id`
- `speaker` — free-text label as given in the pasted transcript
- `quote` — the minimal contiguous span of the source text, extended to full sentence boundaries, that contains the checkable claim. May span multiple sentences when the claim genuinely requires it (e.g. a stat qualified by a caveat in the next sentence). Quotes for different claims may overlap rather than force-splitting a shared sentence
- `extracted_claim` — normalized, checkable statement derived from the quote

**Verdict**
- `claim_id`
- `category` — `True | False | Partly true | Unverifiable | Disputed`
- `confidence` — 0–1, internal only. Used to threshold what surfaces and to sort for review. Not shown to the user as a raw number — at most a coarse High/Medium/Low tag, and only as a secondary, subdued indicator
- `sources` — list of `{url, title, stance}`, where `stance` is `supports | contradicts | context` (enum, not free text — keeps sources filterable and consistent, same reasoning as the verdict/framing taxonomies)
- `explanation` — short text grounding the verdict in the cited evidence
- If `category` is `Disputed`: sources are grouped by which side of the dispute they support, not collapsed into one verdict

**Framing**
- `claim_id`
- `flag` — `No issue | Missing context | Misleading framing`
- `explanation` — one line: what's omitted, or why the framing is misleading, even if the underlying fact is accurate

## Verdict taxonomy — definitions

- **True** — claim is accurately supported by retrieved evidence
- **False** — claim is contradicted by retrieved evidence
- **Partly true** — claim mixes accurate and inaccurate elements, or is true only under specific unstated conditions
- **Unverifiable** — no sufficient evidence found either way
- **Disputed** — credible sources genuinely disagree; show both sides rather than forcing a single verdict

## Framing taxonomy — definitions

- **No issue** — claim is presented in a way consistent with the fuller context
- **Missing context** — claim is accurate but omits information that would change how it's understood (e.g. a favorable stat from an unusually low baseline period)
- **Misleading framing** — claim uses a true fact in a way that implies something the evidence doesn't support (false equivalence, cherry-picked comparison, etc.)

## Open questions specific to this PRD

- Exact claim-extraction prompt and how strictly to filter opinion vs. checkable fact (tracked via eval cases in `src/test/fixtures/claim-extraction-cases.ts`)
- Whether `confidence` thresholds for surfacing a verdict need tuning per category (e.g. higher bar for `False` than for `Unverifiable`)