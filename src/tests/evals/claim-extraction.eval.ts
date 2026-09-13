// src/tests/evals/claim-extraction.eval.ts
//
// Eval, not a unit test: calls the real extraction implementation (real LLM
// calls), so assertions are loose — claim count plus keyword/substring
// topic coverage, never exact string equality on generated text. Each case
// is its own `it` so one failure doesn't stop the rest.
//
// Run via `npm run eval:extraction` (OpenAI, default), `-- --provider
// mistral`, or `-- --compare` (both providers side by side — see
// scripts/eval-extraction.mjs). Not part of a general test command.

import { afterAll, describe, expect, it } from "vitest";
import { mistralExtractionProvider } from "#/server/extraction/mistral";
import { openaiExtractionProvider } from "#/server/extraction/openai";
import type {
	ExtractClaimsResult,
	ExtractionProvider,
	ExtractionProviderId,
} from "#/server/extraction/shared";
import {
	claimExtractionTestCases,
	type ExtractionTestCase,
} from "#/tests/fixtures/claim-extraction-cases";
import type { Claim } from "#/types/fact-check";

const TIMEOUT_MS = 90_000;
const COMPARE_TIMEOUT_MS = 120_000;

const providers: Record<ExtractionProviderId, ExtractionProvider> = {
	openai: openaiExtractionProvider,
	mistral: mistralExtractionProvider,
};

const compareMode = process.env.EVAL_EXTRACTION_COMPARE === "1";

function resolveProviderId(): ExtractionProviderId {
	const raw = process.env.EVAL_EXTRACTION_PROVIDER ?? "openai";
	if (raw !== "openai" && raw !== "mistral") {
		throw new Error(
			`Invalid EVAL_EXTRACTION_PROVIDER "${raw}" (expected "openai" or "mistral")`,
		);
	}
	return raw;
}

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

function missingTopicsFor(
	testCase: ExtractionTestCase,
	claims: Claim[],
): string[] {
	return testCase.expectedClaimTopics.filter(
		(topic) => !isTopicCovered(topic, claims),
	);
}

if (compareMode) {
	interface ProviderOutcome {
		count?: number;
		droppedCount?: number;
		pass?: boolean;
		error?: string;
	}

	interface CompareRow {
		name: string;
		expectedCount: number;
		openai: ProviderOutcome;
		mistral: ProviderOutcome;
	}

	const rows: CompareRow[] = [];

	async function toOutcome(
		provider: ExtractionProvider,
		testCase: ExtractionTestCase,
		transcript: string,
	): Promise<ProviderOutcome> {
		try {
			const { claims, droppedCount }: ExtractClaimsResult =
				await provider.extract(transcript);
			const countMatches = claims.length === testCase.expectedClaimCount;
			const missing = missingTopicsFor(testCase, claims);
			return {
				count: claims.length,
				droppedCount,
				pass: countMatches && missing.length === 0,
			};
		} catch (error) {
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}

	describe("claim extraction eval (compare)", () => {
		it.each(claimExtractionTestCases)(
			"[compare] $name",
			async (testCase) => {
				const transcript = `[${testCase.speaker}]: ${testCase.quote}`;
				const [openai, mistral] = await Promise.all([
					toOutcome(providers.openai, testCase, transcript),
					toOutcome(providers.mistral, testCase, transcript),
				]);
				rows.push({
					name: testCase.name,
					expectedCount: testCase.expectedClaimCount,
					openai,
					mistral,
				});
			},
			COMPARE_TIMEOUT_MS,
		);

		afterAll(() => {
			const cell = (outcome: ProviderOutcome) =>
				outcome.error
					? `ERROR: ${outcome.error.length > 40 ? `${outcome.error.slice(0, 39)}…` : outcome.error}`
					: `${outcome.count} (dropped ${outcome.droppedCount}) ${outcome.pass ? "PASS" : "FAIL"}`;
			const agree = (row: CompareRow) => {
				if (row.openai.error || row.mistral.error) return "—";
				return row.openai.count === row.mistral.count ? "yes" : "no";
			};

			const headers = ["Case", "Expected #", "OpenAI", "Mistral", "Agree"];
			const rowCells = rows.map((row) => [
				row.name,
				String(row.expectedCount),
				cell(row.openai),
				cell(row.mistral),
				agree(row),
			]);
			const widths = headers.map((header, i) =>
				Math.max(header.length, ...rowCells.map((r) => (r[i] ?? "").length)),
			);
			const line = (cells: string[]) =>
				cells.map((cell, i) => cell.padEnd(widths[i])).join("  ");
			console.log(line(headers));
			console.log(widths.map((w) => "-".repeat(w)).join("  "));
			for (const row of rowCells) console.log(line(row));

			for (const providerId of ["openai", "mistral"] as const) {
				const outcomeOf = (row: CompareRow) => row[providerId];
				const passCount = rows.filter((row) => outcomeOf(row).pass).length;
				const errorCount = rows.filter((row) => outcomeOf(row).error).length;
				const totalDropped = rows.reduce(
					(sum, row) => sum + (outcomeOf(row).droppedCount ?? 0),
					0,
				);
				console.log(
					`\n${providerId}: pass ${passCount}/${rows.length}, total dropped: ${totalDropped}, errors: ${errorCount}`,
				);
			}

			const agreementCount = rows.filter((row) => agree(row) === "yes").length;
			console.log(
				`agreement (claim count): ${agreementCount}/${rows.length} cases\n`,
			);
		});
	});
} else {
	const providerId = resolveProviderId();
	const provider = providers[providerId];

	interface CaseResult {
		name: string;
		pass: boolean;
	}

	const results: CaseResult[] = [];

	describe(`claim extraction eval [${providerId}]`, () => {
		it.each(claimExtractionTestCases)(
			"$name",
			async (testCase) => {
				const transcript = `[${testCase.speaker}]: ${testCase.quote}`;
				let pass = false;
				let details = "";
				try {
					const { claims } = await provider.extract(transcript);

					const countMatches = claims.length === testCase.expectedClaimCount;
					const missingTopics = missingTopicsFor(testCase, claims);
					pass = countMatches && missingTopics.length === 0;

					details = [
						`expected ${testCase.expectedClaimCount} claim(s), got ${claims.length}`,
						`extracted: ${claims.map((claim) => claim.extractedClaim).join(" | ") || "(none)"}`,
						...(missingTopics.length > 0
							? [`missing topic coverage: ${missingTopics.join("; ")}`]
							: []),
					].join("\n");
				} finally {
					results.push({ name: testCase.name, pass });
				}

				expect(pass, details).toBe(true);
			},
			TIMEOUT_MS,
		);

		afterAll(() => {
			const passed = results.filter((result) => result.pass).length;
			console.log(
				`\nExtraction eval summary [${providerId}]: ${passed}/${results.length} passed\n`,
			);
		});
	});
}
