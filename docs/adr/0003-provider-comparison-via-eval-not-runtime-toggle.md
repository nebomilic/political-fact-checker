# ADR 0003: Compare LLM providers via eval harness, not a runtime toggle

**Status**: Accepted

## Context

Building entirely on one US-based LLM provider (OpenAI) was flagged as a
genuine supply-chain dependency risk for a tool whose premise depends on not
being controllable by any single actor — not hypothetical: Anthropic
suspended access to two of its own models for several weeks in mid-2026 to
comply with US export controls, as a concrete precedent for this exact kind
of disruption.

A user-facing checkbox to let people choose OpenAI or Mistral was considered
and rejected: this isn't a preference an end user can meaningfully hold, and
the actual goal — evaluating whether Mistral holds up on quality — doesn't
need real traffic to split, since there's no live user base yet. What's
actually wanted is a controlled comparison, not an A/B test in the
traffic-splitting sense.

## Decision

Provider selection lives behind a dev-only flag on the eval runner
(`--provider`, plus a `--compare` mode), on **both** `eval:verification` and
`eval:extraction` — extraction got the same treatment shortly after this ADR
was first written, running `claim-extraction-cases.ts` against both
providers the same way. No provider option is exposed in the app in either
case. Production stays on OpenAI until eval results justify a change.

The two steps end up using different Mistral APIs, mirroring why they
already use different OpenAI APIs (see `CLAUDE.md`'s Stack section):
verification needs grounded retrieval, so it uses Mistral's Agents/
Conversations API (raw `@mistralai/mistralai` SDK) for its built-in
`web_search` tool — the same reason it uses OpenAI's Responses API rather
than Chat Completions. Extraction has no retrieval requirement, so it uses
Mistral's plain structured-output chat completions via `@ai-sdk/mistral`,
just like it uses `@ai-sdk/openai` on the OpenAI side. This keeps the "no
separate search API" decision intact for verification while not forcing
extraction through machinery it doesn't need.

## Consequences

- Keeps the vendor-independence question grounded in measured quality
  rather than resolved by assumption or ideology.
- No UI complexity, no doubled runtime cost/latency in production yet.
- Mistral, as an EU-domiciled provider, is a more precise answer to the
  specific dependency risk than "open-weight" generally would have been —
  worth remembering if this decision is revisited later and "open-weight"
  resurfaces as an alternative framing.
- **Eval data now exists** (run 2026-09-13), and the two steps point in
  opposite directions: extraction (`mistral-small-latest`) matched OpenAI —
  10/10 fixture cases passed, and faster (~8s vs ~14s). Verification
  (`mistral-medium-latest`) did not — 5/11 fixture cases passed, and much
  slower (~48s/case vs OpenAI's single-digit seconds). The likely cause is
  structural, not a tuning problem: verification is a multi-step `web_search`
  agentic loop plus nuanced grounded reasoning (Disputed vs. Partly-true vs.
  Missing-context distinctions), which is exactly where the gap showed up;
  extraction is simple structured span-copying on a cheaper model tier.
- The dependency risk is still not mitigated in production — the follow-up
  decision this ADR anticipated is now genuinely actionable (not blocked on
  missing data), but has been explicitly deferred rather than acted on: keep
  both providers wired up as dev-time comparisons, OpenAI stays default for
  both steps, revisit later rather than switch off a single eval run against
  an 11-case (verification) / 10-case (extraction) fixture set. If revisited,
  extraction is the more promising candidate to actually switch; verification
  would need either a different approach or real improvement first.
