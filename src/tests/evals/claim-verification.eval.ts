// src/tests/evals/claim-verification.eval.ts
//
// Eval, not a unit test: calls the real verification pipeline (real LLM +
// real OpenAI Responses API web_search), so results are non-deterministic.
// Unlike the extraction eval, the assertions here ARE exact string equality
// — Verdict.category and Framing.flag are literal unions, not free text, so
// there's nothing to loosely match.
//
// Cases come in two kinds (see verification-cases.ts's own header for the
// full rationale): STABLE cases rest on settled facts and should reliably
// pass; SCENARIO cases assume a specific evidence context that retrieval
// has to actually surface, so a mismatch there is a prompt to investigate
// (framing logic vs. retrieval gap), not automatically a bug. The summary
// below reports each kind's pass rate separately rather than one flat
// count, since a stable-case failure and a scenario-case failure mean
// different things. Run via `npm run eval:verification` — not part of
// eval:extraction or any general test command.

import { afterAll, describe, expect, it } from "vitest";
import { verifyClaim } from "#/server/claim-verification.server";
import {
	type VerificationTestCase,
	verificationTestCases,
} from "#/tests/fixtures/verification-cases";

const TIMEOUT_MS = 90_000;

interface CaseResult {
	kind: VerificationTestCase["kind"];
	name: string;
	pass: boolean;
}

const results: CaseResult[] = [];

describe("claim verification eval", () => {
	it.each(verificationTestCases)(
		"[$kind] $name",
		async (testCase) => {
			let pass = false;
			let details = "";
			try {
				const claim = { id: crypto.randomUUID(), ...testCase.claim };
				const { verdict, framing } = await verifyClaim(claim);

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
			`\nVerification eval summary (by kind):\n${lines.join("\n")}\n`,
		);
	});
});
