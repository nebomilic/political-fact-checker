// src/server/extraction/openai.ts
//
// OpenAI implementation of the ExtractionProvider interface. Production
// default; see claim-extraction.server.ts. No retrieval/tool requirement
// here (contrast verification), so this is a plain structured-output call.
//
// Also hosts classifyQuickCheckInput, Quick Check's classify-and-normalize
// call for a single typed/spoken utterance — OpenAI-only, not part of the
// ExtractionProvider interface (see that function's own comment below).

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
	buildClaims,
	buildQuickCheckClaim,
	type ExtractClaimsResult,
	type ExtractionProvider,
	extractionResultSchema,
	QUICK_CHECK_SYSTEM_PROMPT,
	quickCheckResultSchema,
	SYSTEM_PROMPT,
} from "#/server/extraction/shared";
import type { Claim } from "#/types/fact-check";

function extractionModel() {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is not set");
	}
	const model =
		process.env.OPENAI_EXTRACTION_MODEL ??
		process.env.OPENAI_MODEL ??
		"gpt-5.4";
	return createOpenAI({ apiKey })(model);
}

async function extract(transcript: string): Promise<ExtractClaimsResult> {
	const { object } = await generateObject({
		model: extractionModel(),
		schema: extractionResultSchema,
		system: SYSTEM_PROMPT,
		prompt: transcript,
	});

	return buildClaims(object.claims, transcript);
}

/**
 * Quick Check's classify-and-normalize call. Deliberately OpenAI-only — no
 * Mistral counterpart, no ExtractionProvider entry — since Quick Check has
 * no dev-time provider-comparison flag (contrast extract() above, which
 * exists behind eval:extraction --provider/--compare). See CLAUDE.md.
 */
async function classifyQuickCheckInput(input: string): Promise<Claim | null> {
	const { object } = await generateObject({
		model: extractionModel(),
		schema: quickCheckResultSchema,
		system: QUICK_CHECK_SYSTEM_PROMPT,
		prompt: input,
	});

	return buildQuickCheckClaim(object, input);
}

export const openaiExtractionProvider: ExtractionProvider = {
	id: "openai",
	extract,
};

export { classifyQuickCheckInput };
