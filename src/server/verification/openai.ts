// src/server/verification/openai.ts
//
// OpenAI implementation of the VerificationProvider interface. Retrieves
// real evidence via the Responses API's built-in web_search tool — never
// answers from the model's own memory (see CLAUDE.md's grounding
// convention). Production default; see claim-verification.server.ts.

import { createOpenAI } from "@ai-sdk/openai";
import { generateText, Output, stepCountIs } from "ai";
import {
	assertGrounded,
	buildPrompt,
	SYSTEM_PROMPT,
	type VerificationProvider,
	verificationResultSchema,
} from "#/server/verification/shared";
import type { Claim, Framing, Verdict } from "#/types/fact-check";

async function verify(
	claim: Claim,
): Promise<{ verdict: Verdict; framing: Framing }> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is not set");
	}
	const model =
		process.env.OPENAI_VERIFICATION_MODEL ??
		process.env.OPENAI_MODEL ??
		"gpt-5.4";
	const openai = createOpenAI({ apiKey });

	const result = await generateText({
		model: openai.responses(model),
		tools: { web_search: openai.tools.webSearch() },
		stopWhen: stepCountIs(8),
		output: Output.object({ schema: verificationResultSchema }),
		system: SYSTEM_PROMPT,
		prompt: buildPrompt(claim),
	});

	const usedWebSearch = result.toolCalls.some(
		(call) => call.toolName === "web_search",
	);
	assertGrounded(usedWebSearch, result.output);

	const { verdict, framing } = result.output;
	return {
		verdict: { claimId: claim.id, ...verdict },
		framing: { claimId: claim.id, ...framing },
	};
}

export const openaiVerificationProvider: VerificationProvider = {
	id: "openai",
	verify,
};
