// src/server/extraction/shared.ts
//
// Provider-agnostic pieces of claim extraction: the result schema, the
// prompt, and the transcript-grounding filter every provider must satisfy.
// Grounded strictly in the pasted transcript — no verification, no evidence
// retrieval, no outside knowledge. See PRD.md for the extraction step of
// the user flow and src/types/fact-check.ts for the Claim shape.

import { z } from "zod";
import type { Claim } from "#/types/fact-check";

export const extractedClaimSchema = z.object({
	speaker: z
		.string()
		.describe(
			'Speaker label exactly as it appears before the colon in the transcript, e.g. "Anna Schmidt".',
		),
	quote: z
		.string()
		.describe(
			"The exact, verbatim contiguous span of the source transcript containing the claim, extended to full sentence boundaries. Copy this character-for-character from the input — do not paraphrase or correct it.",
		),
	extractedClaim: z
		.string()
		.describe(
			"A normalized, self-contained, checkable statement derived from the quote, in German, with pronouns resolved using only information present in the transcript.",
		),
});

export const extractionResultSchema = z.object({
	claims: z.array(extractedClaimSchema),
});

export type ExtractedClaim = z.infer<typeof extractedClaimSchema>;

export const SYSTEM_PROMPT = `Du extrahierst überprüfbare Sachbehauptungen aus einem deutschsprachigen politischen Transkript.

Regeln:
- Extrahiere ausschließlich konkrete, überprüfbare Sachbehauptungen (Fakten, Statistiken, Ereignisse, Zitate von Zahlen/Daten).
- Extrahiere KEINE Meinungen, Werturteile, Vorhersagen, rhetorischen Fragen oder reine Absichtserklärungen.
- Extrahiere auch vage oder schwer überprüfbare, aber grundsätzlich faktische Aussagen (z.B. eine behauptete Verschlechterung einer Lage über die Zeit). Ob eine Behauptung tatsächlich verifizierbar ist, entscheidet ein späterer Verifizierungsschritt — nicht die Extraktion. Verwirf eine Aussage nur, wenn sie eine reine Meinung, ein Werturteil, eine Vorhersage oder eine rhetorische Frage ohne faktischen Kern ist.
- "speaker" ist das Sprecher-Label, wie es im Transkript vor dem Doppelpunkt steht (z.B. "[Anna Schmidt]:" -> "Anna Schmidt").
- "quote" muss ein exaktes, wortwörtliches Zitat aus dem Transkript sein, erweitert auf vollständige Satzgrenzen. Zitate für verschiedene Behauptungen dürfen sich überschneiden, wenn ein Satz mehrere Behauptungen enthält.
- Wenn ein nachfolgender Satz eine vorherige Aussage einschränkt oder bedingt, indem er eine Ursache oder Voraussetzung nennt, die deren Bedeutung verändert (erkennbar an Wendungen wie „allerdings nur, weil", „aber nur, wenn", „jedoch nur, weil"), fasse beide Sätze zu EINER Behauptung zusammen statt zu zwei — z.B. werden aus „X ist gestiegen." + „Allerdings nur, weil gleichzeitig auch Y gemacht wurde." eine einzige Behauptung, weil der zweite Satz erklärt, dass X nicht von selbst, sondern durch Y zustande kam. Behandle dagegen zwei durch „und" verbundene, aber inhaltlich unabhängige Fakten zum selben Sachverhalt weiterhin als zwei separate Behauptungen, wenn der zweite Teil die Bedeutung des ersten nicht verändert, sondern nur ergänzt oder einordnet — z.B. bleiben „X ist um Z Prozent gestiegen" + „und das ist ein Rekordwert" zwei getrennte Behauptungen, da die Einordnung als Rekordwert nichts an der Bedeutung der Prozentzahl ändert.
- "extractedClaim" ist eine normalisierte, eigenständig verständliche Aussage, abgeleitet aus dem Zitat, auf Deutsch, mit Pronomen aufgelöst — ausschließlich anhand von Informationen aus dem Transkript selbst.
- Bewerte NICHT, ob eine Behauptung wahr oder falsch ist. Verwende KEIN Wissen außerhalb des gegebenen Textes.
- Wenn der Text keine überprüfbaren Behauptungen enthält, gib eine leere Liste zurück.`;

export function normalizeWhitespace(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}

export interface ExtractClaimsResult {
	claims: Claim[];
	droppedCount: number;
}

export const UNKNOWN_SPEAKER = "Unbekannt";

/**
 * Enforces the grounding contract shared by every provider: a claim's quote
 * must actually appear in the source transcript (whitespace-normalized),
 * and extractedClaim must not be blank. Claims that fail this — typically a
 * paraphrase rather than a verbatim span, or an empty statement — are
 * dropped rather than surfaced as a broken claim.
 *
 * A missing/blank speaker is handled differently: unlike quote and
 * extractedClaim, there's a safe fallback (the transcript simply had no
 * "[Name]:" label for the model to copy), so this fills in a placeholder
 * rather than dropping the claim — Claim.speaker is required downstream
 * (see claim-verification.functions.ts's isClaim), so leaving it blank
 * would silently produce a claim that can never be verified.
 */
export function buildClaims(
	rawClaims: ReadonlyArray<ExtractedClaim>,
	transcript: string,
): ExtractClaimsResult {
	const normalizedTranscript = normalizeWhitespace(transcript);
	let droppedCount = 0;
	const claims: Claim[] = [];

	for (const extracted of rawClaims) {
		const normalizedQuote = normalizeWhitespace(extracted.quote);
		const extractedClaim = extracted.extractedClaim.trim();
		if (
			!normalizedQuote ||
			!normalizedTranscript.includes(normalizedQuote) ||
			!extractedClaim
		) {
			droppedCount += 1;
			continue;
		}
		claims.push({
			id: crypto.randomUUID(),
			speaker: extracted.speaker.trim() || UNKNOWN_SPEAKER,
			quote: extracted.quote,
			extractedClaim,
		});
	}

	return { claims, droppedCount };
}

export type ExtractionProviderId = "openai" | "mistral";

export interface ExtractionProvider {
	id: ExtractionProviderId;
	extract(transcript: string): Promise<ExtractClaimsResult>;
}

// Quick Check: classify + normalize a single typed/spoken utterance in one
// LLM call, rather than running the multi-speaker transcript parser above
// on a one-line input. See PRD.md's Quick Check flow and SCOPE.md.

export const quickCheckResultSchema = z.object({
	type: z
		.enum(["claim", "no_claim"])
		.describe(
			'"claim" if the input is a statement, or a yes/no-style question that presupposes a checkable claim. "no_claim" if it is an open-ended informational question, an opinion, a value judgement, or a prediction with no implicit checkable claim.',
		),
	quote: z
		.string()
		.describe(
			'The exact, verbatim input text that contains the claim, copied character-for-character. Empty string if type is "no_claim".',
		),
	extractedClaim: z
		.string()
		.describe(
			'A normalized, self-contained, checkable statement derived from the input, in German. For a yes/no-style question, this is the assertion the question presupposes (e.g. "Hat Deutschland die Atomkraft abgeschafft?" -> "Deutschland hat die Atomkraft abgeschafft."). Empty string if type is "no_claim".',
		),
});

export type QuickCheckResult = z.infer<typeof quickCheckResultSchema>;

export const QUICK_CHECK_SYSTEM_PROMPT = `Du analysierst eine einzelne, kurze Eingabe (getippt oder per Spracheingabe diktiert) einer Person, die eine politische Aussage überprüfen möchte.

Klassifiziere die Eingabe zunächst:
- "claim": die Eingabe ist eine Aussage, oder eine Ja/Nein-Frage bzw. eine bestätigende Frage, die eine überprüfbare Behauptung voraussetzt (z.B. "Hat Deutschland die Atomkraft abgeschafft?" setzt die Behauptung "Deutschland hat die Atomkraft abgeschafft." voraus).
- "no_claim": die Eingabe ist eine offene Wissensfrage ohne implizite Behauptung (z.B. "Wie funktioniert die Rentenversicherung?"), eine reine Meinung, ein Werturteil oder eine Vorhersage. Versuche NICHT, eine solche Frage zu beantworten.

Wenn "claim":
- "quote" ist die Eingabe wortwörtlich, exakt wie gegeben.
- "extractedClaim" ist eine normalisierte, eigenständig verständliche Aussage, auf Deutsch, mit Pronomen aufgelöst — ausschließlich anhand von Informationen aus der Eingabe selbst. Bei einer Frage: formuliere die Behauptung, die die Frage voraussetzt, als Aussagesatz.

Wenn "no_claim": lasse "quote" und "extractedClaim" leer.

Bewerte NICHT, ob eine Behauptung wahr oder falsch ist. Verwende KEIN Wissen außerhalb der gegebenen Eingabe.`;

/**
 * Single-input analogue of buildClaims: classifies and normalizes one typed
 * or spoken utterance instead of parsing a multi-speaker transcript. Reuses
 * the same grounding contract (quote must appear verbatim in the source)
 * and the same "Unbekannt" speaker fallback from ADR 0005 — Quick Check has
 * no speaker concept, so every claim it produces uses the placeholder
 * directly rather than inventing new speaker-handling.
 *
 * Returns null both when the model classifies the input as having no
 * implicit claim, and when a "claim" result fails grounding (ungrounded
 * quote, blank extractedClaim) — in both cases the UI asks the user to
 * rephrase as a clear statement, so the caller doesn't need to distinguish
 * the two.
 */
export function buildQuickCheckClaim(
	result: QuickCheckResult,
	input: string,
): Claim | null {
	if (result.type === "no_claim") return null;

	const normalizedInput = normalizeWhitespace(input);
	const normalizedQuote = normalizeWhitespace(result.quote);
	const extractedClaim = result.extractedClaim.trim();
	if (
		!normalizedQuote ||
		!normalizedInput.includes(normalizedQuote) ||
		!extractedClaim
	) {
		return null;
	}

	return {
		id: crypto.randomUUID(),
		speaker: UNKNOWN_SPEAKER,
		quote: result.quote,
		extractedClaim,
	};
}
