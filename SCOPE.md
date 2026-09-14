# Scope Note — Fact-Checker MVP (v0)

One-page reference for what v0 is and isn't, written before any scaffolding or PRD detail, so tech and structure decisions don't over-build for capabilities we don't need yet.

## Problem

Political conversations mix true claims, false claims, and true-but-misleading framing. Existing German fact-checkers (Correctiv, ARD-faktenfinder, dpa) are thorough but manual and slow. v0 tests whether an LLM pipeline can do claim-level fact-checking, with a separate check for misleading framing, fast enough and accurately enough to be useful.

## In scope for v0

- **Input**: paste a raw text transcript (single- or multi-speaker, speakers labeled manually by the user — no diarization)
- **Claim extraction**: LLM pulls discrete, checkable factual claims from the text, tagged to speaker and exact quote
- **Verification**: each claim gets a categorical verdict — True / False / Partly true / Unverifiable / Disputed — grounded in retrieved evidence (not model memory), with cited sources
- **Disputed handling**: for contested claims, show which credible sources land on which side, not just a single verdict
- **Framing flag**: a separate, distinct axis — No issue / Missing context / Misleading framing — with a one-line explanation. Never merged visually with the truth verdict
- **Output**: a list of extracted claim cards shown below the input form — each card shows the exact quote, a verify action, and the verdict + framing panels once run (kept structurally separate, per the framing-flag rule above). Supersedes the original "annotated transcript with inline highlight + hover" idea, which turned out not to be necessary for v0's actual goal — validating extraction and verification quality
- **Language/market**: German-language political statements
- **Users**: single-user, local use — no accounts, no multi-user features

## Explicitly out of scope for v0

- Live or streaming input — no audio, no real-time transcription, no speaker diarization
- Speaker-interest / affiliation tagging (needs its own design pass — revisit after v0 works)
- Accounts, auth, saved history across sessions
- Public-facing publishing, sharing, or embedding features
- Mobile app or browser extension
- Any monetization, funding-model, or org-outreach infrastructure

## Success criteria for v0

- Paste a real speech or debate transcript in and get claim-level verdicts out, end to end
- Every verdict is traceable to retrieved evidence — no unsupported claims from model memory
- The framing flag produces genuinely useful, non-obvious flags on at least a handful of real transcripts (not just "no issue" every time)
- Runs entirely without live/streaming complexity

## Open questions (not blocking v0 — revisit later)

- German-language evidence sourcing: prioritize existing fact-check archives (Correctiv/ARD/dpa) over general web search, or combine both? Deliberately deferred, not resolved — see ADR 0002 (blocked on an unchecked legal/ToS question, not a design call)
- What legal review is needed before verdicts naming real politicians go anywhere public-facing
- Video/footage usage terms (Bundestag Mediathek conditions) — only relevant once video is in scope