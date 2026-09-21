# ADR 0008: Schnellcheck moves to `/`, Transkript moves to `/transcript`

**Status**: Accepted

## Context

Since Quick Check shipped, the app has had two entry points: the
transcript flow at the root (`/`, `src/routes/index.tsx`) and Quick Check
at `/quick` (`src/routes/quick.tsx`), in that nav order. The transcript
flow was first and remains the more complete pipeline (multi-claim
extraction across a whole pasted transcript), which is why PRD.md calls it
"the primary flow."

The user asked to make Schnellcheck the default landing page instead, with
Transkript as the second nav item — for personal day-to-day use, a single
quick statement/question check is the entry point reached for far more
often than pasting a full transcript. Asked whether this meant just
reordering the nav links (URLs unchanged) or actually moving Schnellcheck
onto the root URL, the user confirmed the latter.

## Decision

Swap the two routes' file/URL identities: `src/routes/index.tsx` (`/`) is
now Quick Check, and the former transcript-flow `index.tsx` was renamed to
`src/routes/transcript.tsx` (`/transcript`). The nav in `src/routes/__root.tsx`
was reordered to match (Schnellcheck first, Transkript second). Renamed via
`git mv` rather than copy-and-delete, so file history is preserved.

This is a routing/UX decision only — it does not change which flow is
architecturally "primary." The transcript flow is still the fuller
pipeline PRD.md describes first; Quick Check simply now occupies the URL a
user lands on by default, because that matches actual personal usage
patterns better than "primary feature sits at `/`."

## Consequences

- `/` and `/quick` as URLs no longer exist — any bookmark or note
  referencing the old paths is stale. Acceptable for a v0/single-user local
  tool with no external links or deployed users yet.
- `PRD.md` now has an intentional-looking asymmetry: the transcript flow is
  still called "the primary flow" but lives at `/transcript`, while Quick
  Check is "the second, personal-use entry point" but lives at `/`. This is
  not a contradiction — "primary" describes the pipeline's scope/completeness,
  not its URL — but it reads oddly without this ADR for context, which is
  the main reason this decision got its own record rather than being folded
  silently into the rename.
- Every code comment and ADR (0004, 0006, 0007) that named the old
  `src/routes/index.tsx` / `src/routes/quick.tsx` paths as a pointer to
  current behavior was updated to the new paths; ADR 0004's historical
  "originally these maps lived in..." note was reworded rather than
  literally repointed, since the literal old path now resolves to a
  different route than the one that sentence describes.
- No functional/pipeline change — same components, same server functions,
  same verification logic on both routes. Pure file rename plus nav reorder.
