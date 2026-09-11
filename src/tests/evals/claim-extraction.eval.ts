// src/tests/evals/claim-extraction.eval.ts
//
// Eval, not a unit test: calls the real extraction implementation (real LLM
// calls via OPENAI_API_KEY), so assertions are loose — claim count plus
// keyword/substring topic coverage, never exact string equality on
// generated text. Each case is its own `it` so one failure doesn't stop the
// rest, and Vitest's own summary reports the pass/fail count across cases.
// Run via `npm run eval:extraction` — not part of a general test command.

import { describe, expect, it } from "vitest";
import { extractClaims } from "#/server/claim-extraction.server";
import { claimExtractionTestCases } from "#/tests/fixtures/claim-extraction-cases";
import type { Claim } from "#/types/fact-check";

const GERMAN_STOPWORDS = new Set([
	"der",
	"die",
	"das",
	"des",
	"dem",
	"den",
	"und",
	"um",
	"bei",
	"vor",
	"an",
	"zu",
	"ist",
	"von",
	"auf",
	"nur",
	"aus",
	"wir",
	"für",
	"mit",
	"als",
	"eine",
	"einer",
	"einen",
	"unser",
	"unseres",
	"letzten",
	"letztes",
	"jahr",
	"jahren",
	"sind",
	"wurden",
	"über",
	"sich",
	"auch",
	"noch",
	"im",
	"in",
]);

function tokenize(text: string): string[] {
	return text.toLowerCase().match(/\d[\d.,]*|[a-zäöüß]+/g) ?? [];
}

function isSignificant(token: string): boolean {
	return (
		/\d/.test(token) || (token.length >= 5 && !GERMAN_STOPWORDS.has(token))
	);
}

// Loose stem: drop a short suffix so German case/number endings
// (Familien/Familie, vielen/vieler) don't break an otherwise-good match.
function stem(token: string): string {
	return token.length > 5 ? token.slice(0, token.length - 2) : token;
}

function tokenMatches(claimTokens: string[], topicToken: string): boolean {
	if (/\d/.test(topicToken)) {
		return claimTokens.includes(topicToken);
	}
	const topicStem = stem(topicToken);
	return claimTokens.some((claimToken) => {
		const claimStem = stem(claimToken);
		return (
			claimStem === topicStem ||
			claimToken.includes(topicStem) ||
			topicStem.includes(claimStem)
		);
	});
}

/** Loose coverage check: are most of a topic's keywords represented somewhere in the extracted claims? */
function isTopicCovered(topic: string, claims: Claim[]): boolean {
	const topicTokens = tokenize(topic).filter(isSignificant);
	if (topicTokens.length === 0) return true;

	const claimTokens = tokenize(
		claims.map((claim) => `${claim.extractedClaim} ${claim.quote}`).join(" "),
	);
	const matched = topicTokens.filter((token) =>
		tokenMatches(claimTokens, token),
	);
	return matched.length / topicTokens.length >= 0.5;
}

describe("claim extraction eval", () => {
	it.each(claimExtractionTestCases)("$name", async (testCase) => {
		const transcript = `[${testCase.speaker}]: ${testCase.quote}`;
		const { claims } = await extractClaims(transcript);

		const countMatches = claims.length === testCase.expectedClaimCount;
		const missingTopics = testCase.expectedClaimTopics.filter(
			(topic) => !isTopicCovered(topic, claims),
		);

		const details = [
			`expected ${testCase.expectedClaimCount} claim(s), got ${claims.length}`,
			`extracted: ${claims.map((claim) => claim.extractedClaim).join(" | ") || "(none)"}`,
			...(missingTopics.length > 0
				? [`missing topic coverage: ${missingTopics.join("; ")}`]
				: []),
		];

		expect(countMatches && missingTopics.length === 0, details.join("\n")).toBe(
			true,
		);
	}, 90_000);
});
