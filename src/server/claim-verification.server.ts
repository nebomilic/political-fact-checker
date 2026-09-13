// src/server/claim-verification.server.ts
//
// Server-only claim verification. Dispatches to a VerificationProvider
// (OpenAI by default) that retrieves real evidence via a web_search tool —
// never answers from the model's own memory (see CLAUDE.md's grounding
// convention). Produces a Verdict and a Framing result, kept structurally
// separate per PRD.md.
//
// The provider choice is a dev-time-only knob (see
// src/server/verification/*, eval:verification --provider/--compare in
// CLAUDE.md) — the app never passes `options.provider`, so production
// behavior is unchanged.

import { mistralVerificationProvider } from "#/server/verification/mistral";
import { openaiVerificationProvider } from "#/server/verification/openai";
import type { VerificationProviderId } from "#/server/verification/shared";
import type { Claim, Framing, Verdict } from "#/types/fact-check";

const providers = {
	openai: openaiVerificationProvider,
	mistral: mistralVerificationProvider,
} as const satisfies Record<VerificationProviderId, unknown>;

export async function verifyClaim(
	claim: Claim,
	options?: { provider?: VerificationProviderId },
): Promise<{ verdict: Verdict; framing: Framing }> {
	const provider = providers[options?.provider ?? "openai"];
	return provider.verify(claim);
}
