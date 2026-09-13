// src/server/extraction/openai.ts
//
// OpenAI implementation of the ExtractionProvider interface. Production
// default; see claim-extraction.server.ts. No retrieval/tool requirement
// here (contrast verification), so this is a plain structured-output call.

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import {
	buildClaims,
	type ExtractClaimsResult,
	type ExtractionProvider,
	extractionResultSchema,
	SYSTEM_PROMPT,
} from "#/server/extraction/shared";

async function extract(transcript: string): Promise<ExtractClaimsResult> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is not set");
	}
	const model =
		process.env.OPENAI_EXTRACTION_MODEL ??
		process.env.OPENAI_MODEL ??
		"gpt-5.4";
	const openai = createOpenAI({ apiKey });

	const { object } = await generateObject({
		model: openai(model),
		schema: extractionResultSchema,
		system: SYSTEM_PROMPT,
		prompt: transcript,
	});

	return buildClaims(object.claims, transcript);
}

export const openaiExtractionProvider: ExtractionProvider = {
	id: "openai",
	extract,
};
