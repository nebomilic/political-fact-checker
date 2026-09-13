// src/tests/unit/claim-verification-functions.test.ts
//
// Fast, deterministic unit tests for findMissingClaimField — the RPC
// validator boundary in claim-verification.functions.ts. No LLM calls.
// After the extraction-side fix (see extraction-shared.test.ts), this
// validator should no longer be reachable from the UI in normal use, but
// it's the defense-in-depth boundary check for that RPC, so it's worth
// pinning its exact behavior independently.

import { describe, expect, it } from "vitest";
import { findMissingClaimField } from "#/server/claim-verification.functions";

const VALID_CLAIM = {
	id: "abc-123",
	speaker: "Politikerin A",
	quote: "Die Inflation lag im letzten Jahr bei 6,2 Prozent.",
	extractedClaim: "Inflationsrate von 6,2 Prozent im letzten Jahr.",
};

describe("findMissingClaimField", () => {
	it("returns null for a fully valid claim", () => {
		expect(findMissingClaimField(VALID_CLAIM)).toBeNull();
	});

	it("returns null when extra, unexpected properties are present", () => {
		expect(
			findMissingClaimField({ ...VALID_CLAIM, extra: "ignored" }),
		).toBeNull();
	});

	it.each([
		"id",
		"speaker",
		"quote",
		"extractedClaim",
	] as const)("reports %s when it's missing", (field) => {
		const { [field]: _omitted, ...rest } = VALID_CLAIM;
		expect(findMissingClaimField(rest)).toBe(field);
	});

	it.each([
		"id",
		"speaker",
		"quote",
		"extractedClaim",
	] as const)("reports %s when it's an empty string", (field) => {
		expect(findMissingClaimField({ ...VALID_CLAIM, [field]: "" })).toBe(field);
	});

	it.each([
		null,
		undefined,
		"not-a-claim",
		42,
		["array"],
	])('returns "claim" for non-object input: %j', (value) => {
		expect(findMissingClaimField(value)).toBe("claim");
	});
});
