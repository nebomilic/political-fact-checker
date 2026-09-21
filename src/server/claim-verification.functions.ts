// src/server/claim-verification.functions.ts
//
// Client-safe RPC wrapper around claim-verification.server.ts. Import this
// from routes/components; import claim-verification.server.ts only from here.

import { createServerFn } from "@tanstack/react-start";
import { verifyClaim } from "#/server/claim-verification.server";
import type { Claim } from "#/types/fact-check";

const REQUIRED_CLAIM_FIELDS = [
	"id",
	"speaker",
	"quote",
	"extractedClaim",
] as const;

/**
 * Names the first required field that's missing or blank, rather than just
 * pass/fail — the error this feeds into is shown verbatim in the UI (see
 * routes/transcript.tsx's handleVerify), so a specific field name is far more
 * actionable than a generic rejection. Returns null when `value` is a valid
 * Claim.
 */
export function findMissingClaimField(value: unknown): string | null {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return "claim";
	}
	const claim = value as Record<string, unknown>;
	for (const field of REQUIRED_CLAIM_FIELDS) {
		if (typeof claim[field] !== "string" || claim[field].length === 0) {
			return field;
		}
	}
	return null;
}

const FIELD_LABELS: Record<string, string> = {
	id: "ID",
	speaker: "Sprecher:in",
	quote: "Zitat",
	extractedClaim: "erkannte Behauptung",
};

export const verifyClaimFn = createServerFn({ method: "POST" })
	.validator((data: { claim: Claim }) => {
		const missingField = findMissingClaimField(data.claim);
		if (missingField) {
			throw new Error(
				missingField === "claim"
					? "Die Anfrage enthält keine gültige Behauptung."
					: `Die Behauptung enthält kein gültiges Feld „${FIELD_LABELS[missingField] ?? missingField}“ — versuche, die Behauptungen erneut zu erkennen.`,
			);
		}
		return { claim: data.claim };
	})
	.handler(async ({ data }) => {
		return verifyClaim(data.claim);
	});
