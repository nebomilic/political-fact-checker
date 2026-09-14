// src/server/audio-transcription.server.ts
//
// Server-only audio transcription for Quick Check's voice input. Replaces
// the browser's Web Speech API (see ADR 0007 for why) — audio is recorded
// client-side (src/routes/quick.tsx) and transcribed here via OpenAI's
// Whisper API. Deliberately OpenAI-only, no ExtractionProvider-style
// dual-provider treatment (same reasoning as Quick Check's classify call,
// see ADR 0006) — not persisted anywhere, forwarded directly to OpenAI.

import { createOpenAI } from "@ai-sdk/openai";
import { transcribe } from "ai";

export async function transcribeAudio(audio: ArrayBuffer): Promise<string> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new Error("OPENAI_API_KEY is not set");
	}
	const model = process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1";

	const result = await transcribe({
		model: createOpenAI({ apiKey }).transcription(model),
		audio,
		providerOptions: { openai: { language: "de" } },
	});

	return result.text.trim();
}
