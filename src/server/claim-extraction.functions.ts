// src/server/claim-extraction.functions.ts
//
// Client-safe RPC wrapper around claim-extraction.server.ts. Import this
// from routes/components; import claim-extraction.server.ts only from here.

import { createServerFn } from "@tanstack/react-start";
import { extractClaims, quickCheck } from "#/server/claim-extraction.server";

export const extractClaimsFn = createServerFn({ method: "POST" })
	.validator((data: { transcript: string }) => {
		if (
			typeof data.transcript !== "string" ||
			data.transcript.trim().length === 0
		) {
			throw new Error("Bitte füge zuerst ein Transkript ein.");
		}
		return { transcript: data.transcript };
	})
	.handler(async ({ data }) => {
		return extractClaims(data.transcript);
	});

export const quickCheckFn = createServerFn({ method: "POST" })
	.validator((data: { input: string }) => {
		if (typeof data.input !== "string" || data.input.trim().length === 0) {
			throw new Error("Bitte gib zuerst eine Aussage oder Frage ein.");
		}
		return { input: data.input };
	})
	.handler(async ({ data }) => {
		const claim = await quickCheck(data.input);
		return { claim };
	});
