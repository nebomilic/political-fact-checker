// src/server/audio-transcription.functions.ts
//
// Client-safe RPC wrapper around audio-transcription.server.ts. Import this
// from routes/components; import audio-transcription.server.ts only from
// here. Takes FormData (not JSON) so the recorded audio Blob is sent as a
// real multipart body rather than serialized — see ADR 0007.

import { createServerFn } from "@tanstack/react-start";
import { transcribeAudio } from "#/server/audio-transcription.server";

export const transcribeAudioFn = createServerFn({ method: "POST" })
	.validator((data: FormData) => {
		const audio = data instanceof FormData ? data.get("audio") : null;
		if (!(audio instanceof Blob) || audio.size === 0) {
			throw new Error("Es wurde keine Audioaufnahme empfangen.");
		}
		return audio;
	})
	.handler(async ({ data }) => {
		const text = await transcribeAudio(await data.arrayBuffer());
		return { text };
	});
