// src/tests/evals/claim-verification.eval.ts
//
// Eval, not a unit test: calls the real verification pipeline (real LLM +
// real web search), so results are non-deterministic. Unlike the extraction
// eval, the assertions here ARE exact string equality — Verdict.category and
// Framing.flag are literal unions, not free text, so there's nothing to
// loosely match.
//
// Cases come in two kinds (see verification-cases.ts's own header for the
// full rationale): STABLE cases rest on settled facts and should reliably
// pass; SCENARIO cases assume a specific evidence context that retrieval
// has to actually surface, so a mismatch there is a prompt to investigate
// (framing logic vs. retrieval gap), not automatically a bug. The summary
// below reports each kind's pass rate separately rather than one flat
// count, since a stable-case failure and a scenario-case failure mean
// different things.
//
// Run via `npm run eval:verification` (OpenAI, default), `-- --provider
// mistral`, or `-- --compare` (both providers side by side — see
// scripts/eval-verification.mjs). Not part of eval:extraction or any
// general test command.

import { afterAll, describe, expect, it } from "vitest";
import { mistralVerificationProvider } from "#/server/verification/mistral";
import { openaiVerificationProvider } from "#/server/verification/openai";
import type {
	VerificationProvider,
	VerificationProviderId,
} from "#/server/verification/shared";
import {
	type VerificationTestCase,
	verificationTestCases,
} from "#/tests/fixtures/verification-cases";
import type { Framing, Verdict } from "#/types/fact-check";

const TIMEOUT_MS = 90_000;
const COMPARE_TIMEOUT_MS = 120_000;

const providers: Record<VerificationProviderId, VerificationProvider> = {
	openai: openaiVerificationProvider,
	mistral: mistralVerificationProvider,
};

const compareMode = process.env.EVAL_VERIFICATION_COMPARE === "1";

function resolveProviderId(): VerificationProviderId {
	const raw = process.env.EVAL_VERIFICATION_PROVIDER ?? "openai";
	if (raw !== "openai" && raw !== "mistral") {
		throw new Error(
			`Invalid EVAL_VERIFICATION_PROVIDER "${raw}" (expected "openai" or "mistral")`,
		);
	}
	return raw;
}

function truncate(text: string, maxLen: number): string {
	return text.length > maxLen ? `${text.slice(0, maxLen - 1)}…` : text;
}

function printTable(headers: string[], rows: string[][]): void {
	const widths = headers.map((header, i) =>
		Math.max(header.length, ...rows.map((row) => (row[i] ?? "").length)),
	);
	const line = (cells: string[]) =>
		cells.map((cell, i) => cell.padEnd(widths[i])).join("  ");
	console.log(line(headers));
	console.log(widths.map((w) => "-".repeat(w)).join("  "));
	for (const row of rows) console.log(line(row));
}

if (compareMode) {
	interface ProviderOutcome {
		category?: string;
		flag?: string;
		error?: string;
	}

	interface CompareRow {
		kind: VerificationTestCase["kind"];
		name: string;
		expected: { category: string; flag: string };
		openai: ProviderOutcome;
		mistral: ProviderOutcome;
	}

	const rows: CompareRow[] = [];

	async function toOutcome(
		provider: VerificationProvider,
		claim: Parameters<VerificationProvider["verify"]>[0],
	): Promise<ProviderOutcome> {
		try {
			const { verdict, framing }: { verdict: Verdict; framing: Framing } =
				await provider.verify(claim);
			return { category: verdict.category, flag: framing.flag };
		} catch (error) {
			return { error: error instanceof Error ? error.message : String(error) };
		}
	}

	describe("claim verification eval (compare)", () => {
		it.each(verificationTestCases)(
			"[compare] $name",
			async (testCase) => {
				const claim = { id: crypto.randomUUID(), ...testCase.claim };
				const [openai, mistral] = await Promise.all([
					toOutcome(providers.openai, claim),
					toOutcome(providers.mistral, claim),
				]);
				rows.push({
					kind: testCase.kind,
					name: testCase.name,
					expected: {
						category: testCase.expectedVerdictCategory,
						flag: testCase.expectedFramingFlag,
					},
					openai,
					mistral,
				});
			},
			COMPARE_TIMEOUT_MS,
		);

		afterAll(() => {
			const cell = (outcome: ProviderOutcome) =>
				outcome.error
					? `ERROR: ${truncate(outcome.error, 40)}`
					: `${outcome.category} / ${outcome.flag}`;
			const agree = (row: CompareRow) => {
				if (row.openai.error || row.mistral.error) return "—";
				return row.openai.category === row.mistral.category &&
					row.openai.flag === row.mistral.flag
					? "yes"
					: "no";
			};

			printTable(
				["Case", "Kind", "Expected", "OpenAI", "Mistral", "Agree"],
				rows.map((row) => [
					row.name,
					row.kind,
					`${row.expected.category} / ${row.expected.flag}`,
					cell(row.openai),
					cell(row.mistral),
					agree(row),
				]),
			);

			const kinds = ["stable", "scenario"] as const;
			const isMatch = (outcome: ProviderOutcome, row: CompareRow) =>
				!outcome.error &&
				outcome.category === row.expected.category &&
				outcome.flag === row.expected.flag;

			for (const providerId of ["openai", "mistral"] as const) {
				const outcomeOf = (row: CompareRow) => row[providerId];
				const errorCount = rows.filter((row) => outcomeOf(row).error).length;
				const totalMatches = rows.filter((row) =>
					isMatch(outcomeOf(row), row),
				).length;
				const kindBreakdown = kinds
					.map((kind) => {
						const inKind = rows.filter((row) => row.kind === kind);
						const matches = inKind.filter((row) =>
							isMatch(outcomeOf(row), row),
						).length;
						return `${kind} ${matches}/${inKind.length}`;
					})
					.join(", ");
				console.log(
					`\n${providerId}: accuracy ${totalMatches}/${rows.length} (${kindBreakdown}), errors: ${errorCount}`,
				);
			}

			const agreementCount = rows.filter((row) => agree(row) === "yes").length;
			console.log(`agreement: ${agreementCount}/${rows.length} cases\n`);
		});
	});
} else {
	const providerId = resolveProviderId();
	const provider = providers[providerId];

	interface CaseResult {
		kind: VerificationTestCase["kind"];
		name: string;
		pass: boolean;
	}

	const results: CaseResult[] = [];

	describe(`claim verification eval [${providerId}]`, () => {
		it.each(verificationTestCases)(
			"[$kind] $name",
			async (testCase) => {
				let pass = false;
				let details = "";
				try {
					const claim = { id: crypto.randomUUID(), ...testCase.claim };
					const { verdict, framing } = await provider.verify(claim);

					const categoryMatches =
						verdict.category === testCase.expectedVerdictCategory;
					const flagMatches = framing.flag === testCase.expectedFramingFlag;
					pass = categoryMatches && flagMatches;

					details = [
						`expected category "${testCase.expectedVerdictCategory}", got "${verdict.category}"`,
						`expected framing "${testCase.expectedFramingFlag}", got "${framing.flag}"`,
					].join("\n");
				} finally {
					results.push({ kind: testCase.kind, name: testCase.name, pass });
				}

				expect(pass, details).toBe(true);
			},
			TIMEOUT_MS,
		);

		afterAll(() => {
			const kinds = ["stable", "scenario"] as const;
			const lines = kinds.map((kind) => {
				const inKind = results.filter((result) => result.kind === kind);
				const passed = inKind.filter((result) => result.pass).length;
				return `  ${kind}: ${passed}/${inKind.length} passed`;
			});
			console.log(
				`\nVerification eval summary [${providerId}] (by kind):\n${lines.join("\n")}\n`,
			);
		});
	});
}
