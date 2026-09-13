// src/server/claim-extraction.server.ts
//
// Server-only claim extraction. Dispatches to an ExtractionProvider (OpenAI
// by default) that is grounded strictly in the pasted transcript — no
// verification, no evidence retrieval, no outside knowledge. See PRD.md for
// the extraction step of the user flow and src/types/fact-check.ts for the
// Claim shape this produces.
//
// The provider choice is a dev-time-only knob (see
// src/server/extraction/*, eval:extraction --provider/--compare in
// CLAUDE.md) — the app never passes `options.provider`, so production
// behavior is unchanged.

import { mistralExtractionProvider } from "#/server/extraction/mistral";
import { openaiExtractionProvider } from "#/server/extraction/openai";
import type {
	ExtractClaimsResult,
	ExtractionProviderId,
} from "#/server/extraction/shared";

export type { ExtractClaimsResult };

const providers = {
	openai: openaiExtractionProvider,
	mistral: mistralExtractionProvider,
} as const satisfies Record<ExtractionProviderId, unknown>;

export async function extractClaims(
	transcript: string,
	options?: { provider?: ExtractionProviderId },
): Promise<ExtractClaimsResult> {
	const provider = providers[options?.provider ?? "openai"];
	return provider.extract(transcript);
}
