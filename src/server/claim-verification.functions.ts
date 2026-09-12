// src/server/claim-verification.functions.ts
//
// Client-safe RPC wrapper around claim-verification.server.ts. Import this
// from routes/components; import claim-verification.server.ts only from here.

import { createServerFn } from "@tanstack/react-start";
import { verifyClaim } from "#/server/claim-verification.server";
import type { Claim } from "#/types/fact-check";

function isClaim(value: unknown): value is Claim {
	if (typeof value !== "object" || value === null) return false;
	const claim = value as Record<string, unknown>;
	return (
		typeof claim.id === "string" &&
		claim.id.length > 0 &&
		typeof claim.speaker === "string" &&
		claim.speaker.length > 0 &&
		typeof claim.quote === "string" &&
		claim.quote.length > 0 &&
		typeof claim.extractedClaim === "string" &&
		claim.extractedClaim.length > 0
	);
}

export const verifyClaimFn = createServerFn({ method: "POST" })
	.validator((data: { claim: Claim }) => {
		if (!isClaim(data.claim)) {
			throw new Error("A valid claim is required");
		}
		return { claim: data.claim };
	})
	.handler(async ({ data }) => {
		return verifyClaim(data.claim);
	});
