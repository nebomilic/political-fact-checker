// src/server/extraction/mistral.ts
//
// Mistral implementation of the ExtractionProvider interface. Dev-time
// comparison only (see CLAUDE.md) — not wired into the app.
//
// No retrieval/tool requirement here (contrast verification, which needs
// the Agents/Conversations API for web_search), so this uses the plain
// @ai-sdk/mistral chat-completions provider rather than the raw
// @mistralai/mistralai SDK used in src/server/verification/mistral.ts.

import { createMistral } from "@ai-sdk/mistral";
import { generateObject } from "ai";
import {
	buildClaims,
	type ExtractClaimsResult,
	type ExtractionProvider,
	extractionResultSchema,
	SYSTEM_PROMPT,
} from "#/server/extraction/shared";

async function extract(transcript: string): Promise<ExtractClaimsResult> {
	const apiKey = process.env.MISTRAL_API_KEY;
	if (!apiKey) {
		throw new Error("MISTRAL_API_KEY is not set");
	}
	const model = process.env.MISTRAL_EXTRACTION_MODEL ?? "mistral-small-latest";
	const mistral = createMistral({ apiKey });

	const { object } = await generateObject({
		model: mistral(model),
		schema: extractionResultSchema,
		system: SYSTEM_PROMPT,
		prompt: transcript,
	});

	return buildClaims(object.claims, transcript);
}

export const mistralExtractionProvider: ExtractionProvider = {
	id: "mistral",
	extract,
};
