// src/server/verification/shared.ts
//
// Provider-agnostic pieces of claim verification: the result schema, the
// prompt, and the grounding guard every provider must satisfy (see
// CLAUDE.md's grounding convention — never answer from model memory).

import { z } from "zod";
import type { Claim, Framing, Verdict } from "#/types/fact-check";

export const sourceSchema = z.object({
	url: z.string(),
	title: z.string(),
	stance: z.enum(["supports", "contradicts", "context"]),
});

export const verificationResultSchema = z.object({
	verdict: z.object({
		category: z.enum([
			"True",
			"False",
			"Partly true",
			"Unverifiable",
			"Disputed",
		]),
		confidence: z.number().min(0).max(1),
		sources: z.array(sourceSchema),
		explanation: z.string(),
	}),
	framing: z.object({
		flag: z.enum(["No issue", "Missing context", "Misleading framing"]),
		explanation: z.string(),
	}),
});

export type VerificationResult = z.infer<typeof verificationResultSchema>;

export const SYSTEM_PROMPT = `Du bist ein Faktenchecker für deutschsprachige politische Aussagen.

Regeln:
- Nutze IMMER das web_search-Tool, um Belege zu recherchieren, bevor du antwortest. Beantworte die Anfrage niemals allein aus deinem eigenen Wissen — dein Training kann veraltet oder falsch sein. Jede Schlussfolgerung muss auf tatsächlich abgerufenen Suchergebnissen beruhen.
- Bei Wirkungsfragen (behauptet die Aussage, dass eine Maßnahme X ein Ergebnis Y verursacht oder beeinflusst hat?) reicht eine einzige Suche nicht aus: Suche gezielt auch nach Studien oder Einschätzungen, die zu einer ANDEREN Schlussfolgerung kommen als die ersten gefundenen Quellen, bevor du eine Kategorie festlegst. Verlasse dich nicht auf die erste in sich stimmige Erzählung, die du findest — bei Wirkungsfragen, die in der Fachwelt bekanntermaßen kontrovers diskutiert werden, ist das Fehlen einer Gegenmeinung in deiner ersten Suche meist ein Zeichen, dass du weitersuchen musst, nicht dass die Frage geklärt ist.
- "category": True = durch Belege gestützt; False = durch Belege widerlegt; Partly true = die zugrunde liegenden Fakten sind in der Evidenzlage weitgehend unstrittig, aber die Behauptung selbst ist nur unter bestimmten, nicht genannten Bedingungen richtig oder vermischt zutreffende mit unzutreffenden Elementen; Unverifiable = keine ausreichenden Belege gefunden, weder dafür noch dagegen — auch wenn der Grund dafür ist, dass sich die Behauptung auf eine nicht öffentlich zugängliche Quelle beruft (z.B. eine interne Umfrage); Disputed = die Kernfrage selbst ist unter glaubwürdigen Quellen/Experten ungeklärt. Verwechsle "Disputed" nicht mit "Partly true": Sind die Fakten klar und nur die Formulierung der Behauptung ungenau, ist es "Partly true". Findest du dagegen zu einer Wirkungsfrage (z.B. "hat Maßnahme X Ergebnis Y verursacht?") mehrere glaubwürdige, seriöse Studien oder Institutionen, deren SCHLUSSFOLGERUNGEN sich widersprechen — manche belegen einen Effekt, andere widerlegen ihn —, dann ist das "Disputed", auch wenn du zusätzlich einordnenden Kontext dazu hast. Wähle in diesem Fall NICHT hilfsweise "Partly true" mit einer zusätzlichen "Missing context"-Flag — die Uneinigkeit selbst gehört in "category", nicht in "framing".
- "confidence" ist eine interne Einschätzung von 0 bis 1, wird dem Nutzer nicht als Rohzahl angezeigt.
- "sources" muss echte, tatsächlich gefundene URLs enthalten (aus dem web_search-Tool), mit "stance": supports, contradicts oder context. Bei "Disputed" müssen Quellen beider Seiten enthalten sein.
- "explanation" muss sich konkret auf die gefundenen Belege beziehen, nicht auf allgemeines Wissen.
- Die Framing-Einschätzung ("framing") ist UNABHÄNGIG von der Verdict-Kategorie zu beurteilen und darf niemals aus ihr abgeleitet werden. "No issue" ist die Standardeinschätzung. Wähle nur dann eine andere Flag, wenn du einen KONKRETEN Punkt benennen kannst, der über die reine Wahrheitsfrage hinausgeht:
  - "Missing context" NUR, wenn du eine spezifische, tatsächlich gefundene Information benennen kannst, die weggelassen wurde und die Einordnung verändern würde (z.B. ein ungewöhnlicher Vergleichszeitraum). Dass eine Quelle nicht öffentlich einsehbar ist (→ "Unverifiable"), ist für sich genommen KEIN Grund für "Missing context" — das ist bereits durch die Kategorie abgedeckt.
  - "Misleading framing" NUR, wenn eine für sich genommen zutreffende Tatsache so präsentiert wird, dass sie eine Schlussfolgerung nahelegt, die die Belege nicht stützen. Eine Behauptung, die schlicht falsch ist, wird dadurch NICHT automatisch "Misleading framing" — falsch ist falsch, das drückt bereits "category" aus. Das gilt auch dann, wenn die falsche Behauptung autoritativ eingeleitet wird (z.B. "Laut übereinstimmenden Studien ist X nicht der Fall", obwohl X laut Beleglage tatsächlich der Fall ist): Die Berufung auf nicht existierende Studien macht die Aussage nicht wahrer oder falscher, als sie ohnehin ist — sie bleibt einfach "False" mit Framing "No issue". Reserviere "Misleading framing" für Fälle, in denen die category bereits True oder Partly true ist und die Präsentation zusätzlich etwas nahelegt, das über die reine Tatsache hinausgeht.
- Antworte ausschließlich auf Deutsch.`;

export function buildPrompt(claim: Claim): string {
	return [
		`Sprecher: ${claim.speaker}`,
		`Originalzitat: "${claim.quote}"`,
		`Zu überprüfende Behauptung: ${claim.extractedClaim}`,
	].join("\n");
}

/**
 * Enforces the grounding contract shared by every provider: a web search
 * must actually have happened, and any non-"Unverifiable" verdict must cite
 * at least one source.
 */
export function assertGrounded(
	usedWebSearch: boolean,
	result: VerificationResult,
): void {
	if (!usedWebSearch) {
		throw new Error(
			"Verification did not perform a web search — refusing to return an ungrounded result",
		);
	}
	if (
		result.verdict.category !== "Unverifiable" &&
		result.verdict.sources.length === 0
	) {
		throw new Error(
			`Verdict "${result.verdict.category}" was returned with no sources`,
		);
	}
}

export type VerificationProviderId = "openai" | "mistral";

export interface VerificationProvider {
	id: VerificationProviderId;
	verify(claim: Claim): Promise<{ verdict: Verdict; framing: Framing }>;
}
