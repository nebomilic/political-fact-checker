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

/**
 * Enforces the grounding contract shared by every provider: a claim's quote
 * must actually appear in the source transcript (whitespace-normalized).
 * Claims that fail this — typically a paraphrase rather than a verbatim
 * span — are dropped rather than surfaced with a fabricated source span.
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
		if (!normalizedQuote || !normalizedTranscript.includes(normalizedQuote)) {
			droppedCount += 1;
			continue;
		}
		claims.push({
			id: crypto.randomUUID(),
			speaker: extracted.speaker,
			quote: extracted.quote,
			extractedClaim: extracted.extractedClaim,
		});
	}

	return { claims, droppedCount };
}

export type ExtractionProviderId = "openai" | "mistral";

export interface ExtractionProvider {
	id: ExtractionProviderId;
	extract(transcript: string): Promise<ExtractClaimsResult>;
}
