# Manual Test Log

Real-world test cases, judged by eye — distinct from the automated evals in
`src/tests/fixtures/`. Those test synthetic edge cases for regressions; this
tracks whether the tool actually holds up against real political speech and
real professional fact-checks.

## Where to find cases

- **Professional fact-check archives** (paired ground truth — the claim AND
  the verdict already exist): Correctiv (correctiv.org/faktencheck),
  ARD-faktenfinder (tagesschau.de/faktenfinder), dpa-Faktencheck, BR's
  Faktenfuchs. Pull a claim, run it through the app, compare verdicts directly
  against the professional's.
- **Bundestag Plenarprotokolle** (bundestag.de/protokolle) — real,
  speaker-labeled debate transcripts. No ground truth here; useful for
  extraction quality and general plausibility on genuinely messy input.

## Log

| Date | Source (link) | Input used | Ground truth (if any) | App verdict | App framing | Match? | Notes |
|------|---------------|------------|------------------------|-------------|-------------|--------|-------|
|      |               |            |                        |             |             |        |       |

## Promotion rule

If a manual case surfaces a real bug, a genuine edge case, or an interesting
judgment call worth protecting against regressions — add a corresponding case
to `src/tests/fixtures/claim-extraction-cases.ts` or `verification-cases.ts`
so it's checked automatically going forward, not just once by hand.