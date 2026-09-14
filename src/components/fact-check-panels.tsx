// src/components/fact-check-panels.tsx
//
// Verdict + framing panels shared by the transcript flow (routes/index.tsx)
// and Quick Check (routes/quick.tsx) — kept structurally separate per
// CLAUDE.md's framing convention. Single translation layer for the German
// labels (ADR 0004): one VERDICT_LABELS/FRAMING_LABELS map, not one per route.

import type {
	Framing,
	FramingFlag,
	Source,
	Verdict,
	VerdictCategory,
} from "#/types/fact-check";

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

export function VerdictPanel({ verdict }: { verdict: Verdict }) {
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

export function FramingPanel({ framing }: { framing: Framing }) {
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
