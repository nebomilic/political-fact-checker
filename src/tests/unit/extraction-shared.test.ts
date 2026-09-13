// src/tests/unit/extraction-shared.test.ts
//
// Fast, deterministic unit tests for buildClaims — no LLM calls. This is
// the transcript-grounding filter every extraction provider routes through
// (see src/server/extraction/shared.ts), so it's the right place to lock
// in behavior that doesn't depend on model output.
//
// The blank-speaker and blank-extractedClaim cases below are a regression
// test for a real bug: a transcript with no "[Name]:" label (e.g. "Das
// Wahlkreisbüro von Ulrich Siegmund sei Anfang August 2026 mit Teer
// angegriffen worden.") produced a claim with an empty speaker, which the
// verification RPC validator then silently rejected with a generic "A
// valid claim is required" — confusing, since the actual cause (missing
// speaker) was invisible in the UI. Fixed by falling back to a placeholder
// speaker instead of ever producing an unverifiable claim.

import { describe, expect, it } from "vitest";
import { buildClaims, type ExtractedClaim } from "#/server/extraction/shared";

function rawClaim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
	return {
		speaker: "Politikerin A",
		quote: "Die Inflation lag im letzten Jahr bei 6,2 Prozent.",
		extractedClaim: "Inflationsrate von 6,2 Prozent im letzten Jahr.",
		...overrides,
	};
}

const TRANSCRIPT =
	"[Politikerin A]: Die Inflation lag im letzten Jahr bei 6,2 Prozent.";

describe("buildClaims", () => {
	it("keeps a claim whose quote appears verbatim in the transcript", () => {
		const result = buildClaims([rawClaim()], TRANSCRIPT);

		expect(result.droppedCount).toBe(0);
		expect(result.claims).toHaveLength(1);
		expect(result.claims[0]).toMatchObject({
			speaker: "Politikerin A",
			quote: "Die Inflation lag im letzten Jahr bei 6,2 Prozent.",
			extractedClaim: "Inflationsrate von 6,2 Prozent im letzten Jahr.",
		});
		expect(result.claims[0].id).toEqual(expect.any(String));
		expect(result.claims[0].id.length).toBeGreaterThan(0);
	});

	it("drops a claim whose quote was paraphrased rather than copied verbatim", () => {
		const result = buildClaims(
			[
				rawClaim({
					quote: "Die Inflation betrug letztes Jahr etwa 6 Prozent.",
				}),
			],
			TRANSCRIPT,
		);

		expect(result.claims).toHaveLength(0);
		expect(result.droppedCount).toBe(1);
	});

	it("drops a claim with a blank extractedClaim", () => {
		const result = buildClaims(
			[rawClaim({ extractedClaim: "   " })],
			TRANSCRIPT,
		);

		expect(result.claims).toHaveLength(0);
		expect(result.droppedCount).toBe(1);
	});

	it("falls back to a placeholder speaker instead of dropping the claim", () => {
		const transcript =
			"Das Wahlkreisbüro von Ulrich Siegmund sei Anfang August 2026 mit Teer angegriffen worden.";
		const result = buildClaims(
			[
				rawClaim({
					speaker: "",
					quote: transcript,
					extractedClaim:
						"Das Wahlkreisbüro von Ulrich Siegmund wurde Anfang August 2026 mit Teer angegriffen.",
				}),
			],
			transcript,
		);

		expect(result.droppedCount).toBe(0);
		expect(result.claims).toHaveLength(1);
		expect(result.claims[0].speaker).toBe("Unbekannt");
	});

	it("treats a whitespace-only speaker the same as an empty one", () => {
		const result = buildClaims([rawClaim({ speaker: "   " })], TRANSCRIPT);

		expect(result.claims).toHaveLength(1);
		expect(result.claims[0].speaker).toBe("Unbekannt");
	});

	it("matches a quote that differs from the transcript only in whitespace", () => {
		const transcript =
			"[Politikerin A]: Die Inflation lag\nim   letzten Jahr bei 6,2 Prozent.";
		const result = buildClaims([rawClaim()], transcript);

		expect(result.droppedCount).toBe(0);
		expect(result.claims).toHaveLength(1);
	});

	it("partitions a mixed batch of valid and invalid raw claims correctly", () => {
		const result = buildClaims(
			[
				rawClaim(),
				rawClaim({ quote: "Das steht so nicht im Transkript." }),
				rawClaim({ extractedClaim: "" }),
			],
			TRANSCRIPT,
		);

		expect(result.claims).toHaveLength(1);
		expect(result.droppedCount).toBe(2);
	});
});
