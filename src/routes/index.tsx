import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { extractClaimsFn } from "#/server/claim-extraction.functions";
import { verifyClaimFn } from "#/server/claim-verification.functions";
import type {
	Claim,
	Framing,
	FramingFlag,
	Source,
	Verdict,
	VerdictCategory,
} from "#/types/fact-check";

export const Route = createFileRoute("/")({ component: Home });

type ExtractionState =
	| { status: "idle" }
	| { status: "pending" }
	| { status: "error"; message: string }
	| { status: "success"; claims: Claim[]; droppedCount: number };

type VerificationState =
	| { status: "pending" }
	| { status: "error"; message: string }
	| { status: "success"; verdict: Verdict; framing: Framing };

const VERDICT_LABELS: Record<VerdictCategory, string> = {
	True: "Wahr",
	False: "Falsch",
	"Partly true": "Teilweise wahr",
	Unverifiable: "Nicht überprüfbar",
	Disputed: "Umstritten",
};

const FRAMING_LABELS: Record<FramingFlag, string> = {
	"No issue": "Kein Problem",
	"Missing context": "Fehlender Kontext",
	"Misleading framing": "Irreführende Darstellung",
};

function confidenceLabel(confidence: number): "Hoch" | "Mittel" | "Niedrig" {
	if (confidence >= 0.7) return "Hoch";
	if (confidence >= 0.4) return "Mittel";
	return "Niedrig";
}

function groupSourcesByStance(sources: Source[]) {
	return {
		supports: sources.filter((source) => source.stance === "supports"),
		contradicts: sources.filter((source) => source.stance === "contradicts"),
		context: sources.filter((source) => source.stance === "context"),
	};
}

function SourceList({ sources }: { sources: Source[] }) {
	if (sources.length === 0) {
		return <p className="text-sm text-gray-500">Keine Quellen gefunden.</p>;
	}
	return (
		<ul className="space-y-1">
			{sources.map((source) => (
				<li key={source.url} className="text-sm">
					<a
						href={source.url}
						target="_blank"
						rel="noreferrer"
						className="text-blue-700 underline"
					>
						{source.title}
					</a>
				</li>
			))}
		</ul>
	);
}

function VerdictPanel({ verdict }: { verdict: Verdict }) {
	const grouped =
		verdict.category === "Disputed"
			? groupSourcesByStance(verdict.sources)
			: null;
	return (
		<div className="flex-1 rounded border border-blue-200 bg-blue-50 p-4">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-blue-900">
				Bewertung
			</h3>
			<div className="mt-1 flex items-center gap-2">
				<span className="rounded bg-blue-900 px-2 py-0.5 text-sm font-semibold text-white">
					{VERDICT_LABELS[verdict.category]}
				</span>
				<span className="text-xs text-blue-800">
					Sicherheit: {confidenceLabel(verdict.confidence)}
				</span>
			</div>
			<p className="mt-2 text-sm text-gray-800">{verdict.explanation}</p>
			<div className="mt-3">
				{grouped ? (
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div>
							<h4 className="text-xs font-semibold text-gray-600">Dafür</h4>
							<SourceList sources={grouped.supports} />
						</div>
						<div>
							<h4 className="text-xs font-semibold text-gray-600">Dagegen</h4>
							<SourceList sources={grouped.contradicts} />
						</div>
						<div>
							<h4 className="text-xs font-semibold text-gray-600">Kontext</h4>
							<SourceList sources={grouped.context} />
						</div>
					</div>
				) : (
					<SourceList sources={verdict.sources} />
				)}
			</div>
		</div>
	);
}

function FramingPanel({ framing }: { framing: Framing }) {
	return (
		<div className="flex-1 rounded border border-amber-200 bg-amber-50 p-4">
			<h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
				Darstellung
			</h3>
			<div className="mt-1">
				<span className="rounded bg-amber-900 px-2 py-0.5 text-sm font-semibold text-white">
					{FRAMING_LABELS[framing.flag]}
				</span>
			</div>
			<p className="mt-2 text-sm text-gray-800">{framing.explanation}</p>
		</div>
	);
}

function Home() {
	const [transcript, setTranscript] = useState("");
	const [state, setState] = useState<ExtractionState>({ status: "idle" });
	const [verifications, setVerifications] = useState<
		Record<string, VerificationState>
	>({});
	const extractClaims = useServerFn(extractClaimsFn);
	const verifyClaim = useServerFn(verifyClaimFn);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (transcript.trim().length === 0) return;

		setState({ status: "pending" });
		setVerifications({});
		try {
			const result = await extractClaims({ data: { transcript } });
			setState({
				status: "success",
				claims: result.claims,
				droppedCount: result.droppedCount,
			});
		} catch (error) {
			setState({
				status: "error",
				message:
					error instanceof Error
						? error.message
						: "Die Erkennung ist fehlgeschlagen.",
			});
		}
	}

	async function handleVerify(claim: Claim) {
		setVerifications((prev) => ({
			...prev,
			[claim.id]: { status: "pending" },
		}));
		try {
			const result = await verifyClaim({ data: { claim } });
			setVerifications((prev) => ({
				...prev,
				[claim.id]: {
					status: "success",
					verdict: result.verdict,
					framing: result.framing,
				},
			}));
		} catch (error) {
			setVerifications((prev) => ({
				...prev,
				[claim.id]: {
					status: "error",
					message:
						error instanceof Error
							? error.message
							: "Die Prüfung ist fehlgeschlagen.",
				},
			}));
		}
	}

	return (
		<div className="mx-auto max-w-3xl p-8">
			<h1 className="text-3xl font-bold">Faktencheck 🔍</h1>
			<p className="mt-2 text-sm text-gray-600">
				Füge unten das Transkript einer politischen Rede oder Debatte ein. Das
				Tool erkennt automatisch überprüfbare Behauptungen im Text. Für jede
				Behauptung kannst du anschließend eine Prüfung starten und bekommst zwei
				getrennte Ergebnisse: eine Bewertung des Wahrheitsgehalts (z. B. wahr,
				falsch, umstritten) und eine Einschätzung, ob die Aussage fair oder
				irreführend dargestellt wurde.
			</p>

			<form className="mt-6" onSubmit={handleSubmit}>
				<label htmlFor="transcript" className="block text-sm font-medium">
					Transkript
				</label>
				<textarea
					id="transcript"
					className="mt-1 h-64 w-full rounded border border-gray-300 p-3 font-mono text-sm"
					value={transcript}
					onChange={(event) => setTranscript(event.target.value)}
					placeholder="[Anna Schmidt]: ..."
				/>
				<p className="mt-1 text-xs text-gray-500">
					Tipp: Kennzeichne Sprecher:innen wie im Beispiel (funktioniert aber
					auch ohne).
				</p>
				<button
					type="submit"
					disabled={
						state.status === "pending" || transcript.trim().length === 0
					}
					className="mt-3 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{state.status === "pending"
						? "Behauptungen werden erkannt…"
						: "Behauptungen erkennen"}
				</button>
			</form>

			{state.status === "error" && (
				<p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
					{state.message}
				</p>
			)}

			{state.status === "success" && (
				<div className="mt-8">
					{state.claims.length === 0 ? (
						<h2 className="text-lg font-semibold">
							Keine überprüfbaren Behauptungen gefunden.
						</h2>
					) : (
						<>
							<h2 className="text-lg font-semibold">
								{state.claims.length} Behauptung
								{state.claims.length === 1 ? "" : "en"} erkannt
							</h2>
							<p className="mt-1 text-sm text-gray-600">
								Klicke bei einer Behauptung auf „Behauptung prüfen“, um sie zu
								verifizieren.
							</p>
						</>
					)}
					{state.droppedCount > 0 && (
						<p className="mt-1 text-sm text-amber-700">
							{state.droppedCount} erkannte Behauptung
							{state.droppedCount === 1 ? "" : "en"}{" "}
							{state.droppedCount === 1 ? "konnte" : "konnten"} nicht angezeigt
							werden, da das zugehörige Zitat nicht exakt im Transkript gefunden
							wurde.
						</p>
					)}
					<ul className="mt-4 space-y-4">
						{state.claims.map((claim) => {
							const verification = verifications[claim.id];
							return (
								<li
									key={claim.id}
									className="rounded border border-gray-200 p-4"
								>
									<p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
										{claim.speaker}
									</p>
									<p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
										Zitat
									</p>
									<blockquote className="mt-1 border-l-2 border-gray-300 pl-3 text-sm italic text-gray-700">
										{claim.quote}
									</blockquote>
									<p className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
										Erkannte Behauptung
									</p>
									<p className="mt-1 text-sm">{claim.extractedClaim}</p>

									<button
										type="button"
										onClick={() => handleVerify(claim)}
										disabled={verification?.status === "pending"}
										className="mt-3 rounded border border-gray-900 px-3 py-1 text-xs font-medium disabled:opacity-50"
									>
										{verification?.status === "pending"
											? "Wird geprüft…"
											: "Behauptung prüfen"}
									</button>

									{verification?.status === "error" && (
										<p className="mt-3 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
											{verification.message}
										</p>
									)}

									{verification?.status === "success" && (
										<div className="mt-3 flex flex-col gap-3 sm:flex-row">
											<VerdictPanel verdict={verification.verdict} />
											<FramingPanel framing={verification.framing} />
										</div>
									)}
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
}
