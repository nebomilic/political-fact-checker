// src/server/claim-extraction.functions.ts
//
// Client-safe RPC wrapper around claim-extraction.server.ts. Import this
// from routes/components; import claim-extraction.server.ts only from here.

import { createServerFn } from "@tanstack/react-start";
import { extractClaims } from "#/server/claim-extraction.server";

export const extractClaimsFn = createServerFn({ method: "POST" })
	.validator((data: { transcript: string }) => {
		if (
			typeof data.transcript !== "string" ||
			data.transcript.trim().length === 0
		) {
			throw new Error("Transcript must not be empty");
		}
		return { transcript: data.transcript };
	})
	.handler(async ({ data }) => {
		return extractClaims(data.transcript);
	});
