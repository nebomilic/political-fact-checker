// src/server/verification/mistral.ts
//
// Mistral implementation of the VerificationProvider interface. Retrieves
// real evidence via the Conversations API's built-in web_search tool —
// never answers from the model's own memory (see CLAUDE.md's grounding
// convention). Dev-time comparison only (see CLAUDE.md) — not wired into
// the app.

import { Mistral } from "@mistralai/mistralai";
import type { MessageOutputEntry } from "@mistralai/mistralai/models/components";
import { z } from "zod";
import {
	assertGrounded,
	buildPrompt,
	SYSTEM_PROMPT,
	type VerificationProvider,
	type VerificationResult,
	verificationResultSchema,
} from "#/server/verification/shared";
import type { Claim, Framing, Verdict } from "#/types/fact-check";

// response_format alone wasn't enough to stop the model from adding
// commentary around (or after) the JSON in testing — spell it out too.
const MISTRAL_INSTRUCTIONS = `${SYSTEM_PROMPT}

Antworte AUSSCHLIESSLICH mit einem einzelnen JSON-Objekt exakt im vorgegebenen Schema. Kein Markdown, keine Code-Blöcke, keine Überschriften, keine Erklärung davor oder danach — nur das JSON-Objekt, sonst nichts.`;

function extractText(
	content: string | ReadonlyArray<{ type?: string; text?: string }>,
): string {
	if (typeof content === "string") return content;
	return content
		.filter((chunk) => chunk.type === "text" && typeof chunk.text === "string")
		.map((chunk) => chunk.text)
		.join("");
}

/**
 * Extracts the first balanced top-level JSON object from free-form text.
 * Mistral's Conversations API doesn't reliably confine its output to bare
 * JSON even with response_format set (observed: fenced blocks, leading/
 * trailing commentary, or several JSON objects in one response when the
 * model keeps talking after answering) — a plain fence-or-nothing parse is
 * too brittle, so this scans for the first `{...}` whose braces balance
 * outside of string literals and parses only that span.
 */
function extractFirstJsonObject(text: string): unknown {
	const start = text.indexOf("{");
	if (start === -1) {
		throw new Error(`no JSON object found in response: ${text}`);
	}
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < text.length; i++) {
		const char = text[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (char === "\\") escaped = true;
			else if (char === '"') inString = false;
			continue;
		}
		if (char === '"') inString = true;
		else if (char === "{") depth++;
		else if (char === "}") {
			depth--;
			if (depth === 0) {
				const candidate = text.slice(start, i + 1);
				try {
					return JSON.parse(candidate);
				} catch (cause) {
					throw new Error(
						`matched a JSON-shaped span that failed to parse: ${candidate}`,
						{ cause },
					);
				}
			}
		}
	}
	throw new Error(`unbalanced JSON object in response: ${text}`);
}

function parseVerificationResult(text: string): VerificationResult {
	const parsed = extractFirstJsonObject(text);
	const result = verificationResultSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(
			`Mistral verification response did not match the expected schema: ${result.error.message}`,
		);
	}
	return result.data;
}

async function verify(
	claim: Claim,
): Promise<{ verdict: Verdict; framing: Framing }> {
	const apiKey = process.env.MISTRAL_API_KEY;
	if (!apiKey) {
		throw new Error("MISTRAL_API_KEY is not set");
	}
	const model =
		process.env.MISTRAL_VERIFICATION_MODEL ?? "mistral-medium-latest";
	const client = new Mistral({ apiKey });

	const response = await client.beta.conversations.start({
		model,
		store: false,
		instructions: MISTRAL_INSTRUCTIONS,
		inputs: buildPrompt(claim),
		tools: [{ type: "web_search" }],
		completionArgs: {
			maxTokens: 4096,
			responseFormat: {
				type: "json_schema",
				jsonSchema: {
					name: "verification_result",
					schemaDefinition: z.toJSONSchema(verificationResultSchema),
					strict: false,
				},
			},
		},
	});

	const usedWebSearch = response.outputs.some(
		(output) =>
			output.type === "tool.execution" && output.name === "web_search",
	);

	const messageOutputs = response.outputs.filter(
		(output): output is MessageOutputEntry => output.type === "message.output",
	);
	// Take only the final message — the model can emit several across an
	// agentic turn, and earlier ones may be intermediate commentary rather
	// than the answer.
	const lastMessageOutput = messageOutputs.at(-1);
	const text = lastMessageOutput ? extractText(lastMessageOutput.content) : "";
	if (!text) {
		throw new Error(
			"Mistral verification response contained no message output",
		);
	}

	const parsed = parseVerificationResult(text);
	assertGrounded(usedWebSearch, parsed);

	const { verdict, framing } = parsed;
	return {
		verdict: { claimId: claim.id, ...verdict },
		framing: { claimId: claim.id, ...framing },
	};
}

export const mistralVerificationProvider: VerificationProvider = {
	id: "mistral",
	verify,
};
