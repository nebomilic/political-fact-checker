import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { extractClaimsFn } from "#/server/claim-extraction.functions";
import type { Claim } from "#/types/fact-check";

export const Route = createFileRoute("/")({ component: Home });

type ExtractionState =
	| { status: "idle" }
	| { status: "pending" }
	| { status: "error"; message: string }
	| { status: "success"; claims: Claim[]; droppedCount: number };

function Home() {
	const [transcript, setTranscript] = useState("");
	const [state, setState] = useState<ExtractionState>({ status: "idle" });
	const extractClaims = useServerFn(extractClaimsFn);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (transcript.trim().length === 0) return;

		setState({ status: "pending" });
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
				message: error instanceof Error ? error.message : "Extraction failed",
			});
		}
	}

	return (
		<div className="mx-auto max-w-3xl p-8">
			<h1 className="text-3xl font-bold">Claim extraction</h1>
			<p className="mt-2 text-sm text-gray-600">
				Paste a transcript with speakers labeled as <code>[Name]: ...</code>.
				Claims are extracted from this text only — nothing is verified yet.
			</p>

			<form className="mt-6" onSubmit={handleSubmit}>
				<label htmlFor="transcript" className="block text-sm font-medium">
					Transcript
				</label>
				<textarea
					id="transcript"
					className="mt-1 h-64 w-full rounded border border-gray-300 p-3 font-mono text-sm"
					value={transcript}
					onChange={(event) => setTranscript(event.target.value)}
					placeholder="[Anna Schmidt]: ..."
				/>
				<button
					type="submit"
					disabled={
						state.status === "pending" || transcript.trim().length === 0
					}
					className="mt-3 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{state.status === "pending" ? "Extracting…" : "Extract claims"}
				</button>
			</form>

			{state.status === "error" && (
				<p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
					{state.message}
				</p>
			)}

			{state.status === "success" && (
				<div className="mt-8">
					<h2 className="text-lg font-semibold">
						{state.claims.length} claim{state.claims.length === 1 ? "" : "s"}{" "}
						extracted
					</h2>
					{state.droppedCount > 0 && (
						<p className="mt-1 text-sm text-amber-700">
							{state.droppedCount} candidate claim
							{state.droppedCount === 1 ? "" : "s"} were dropped because the
							quote could not be matched verbatim in the transcript.
						</p>
					)}
					<ul className="mt-4 space-y-4">
						{state.claims.map((claim) => (
							<li key={claim.id} className="rounded border border-gray-200 p-4">
								<p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
									{claim.speaker}
								</p>
								<blockquote className="mt-1 border-l-2 border-gray-300 pl-3 text-sm italic text-gray-700">
									{claim.quote}
								</blockquote>
								<p className="mt-2 text-sm">{claim.extractedClaim}</p>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
