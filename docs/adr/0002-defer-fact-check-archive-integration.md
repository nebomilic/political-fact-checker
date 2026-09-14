# ADR 0002: Defer fact-check archive integration (Correctiv/ARD/dpa)

**Status**: Accepted (deferred, not rejected)

## Context

Evidence retrieval currently goes straight to general web search. Routing
through existing professional fact-check archives first — falling back to
general search only when nothing's found — would likely improve both
verdict quality (professionally vetted ground truth) and credibility
(borrowed institutional trust, relevant given the tool's German-political
focus and the trust/neutrality concerns discussed around funding and
positioning).

A user-facing checkbox for this was considered and rejected separately: most
users have no basis to meaningfully answer "should this consult Correctiv
first," so exposing it as a toggle would just be an uninformed default
dressed up as a feature.

## Decision

Not implemented for now. No public API is confirmed for these archives, and
scraping them raises an unresolved legal/ToS question that hasn't been
checked. When implemented, the intended default is: always try archives
first, silently fall back to general search — no user-facing toggle, at most
an internal kill-switch for operational reasons (e.g. if scraping turns out
to be legally unwise).

## Consequences

- Avoids building product behavior on top of an unresolved legal question.
- Keeps the current pipeline lighter and unblocked in the meantime.
- The tool currently does its own independent web search rather than
  inheriting professional fact-checkers' credibility — identified separately
  as one of the strongest potential answers to "why use this over Google,"
  and currently unrealized. This is a real, acknowledged gap, not a
  resolved non-issue.
- The legal/ToS question needs to actually be checked before this is
  revisited — this ADR doesn't resolve it, only names it.
