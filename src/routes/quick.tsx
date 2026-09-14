// src/routes/quick.tsx
//
// Quick Check: a single typed or spoken statement/question, verified
// through the same pipeline as the transcript flow in routes/index.tsx —
// see SCOPE.md's Quick Check bullet and PRD.md. Reuses quickCheckFn's
// classify-and-normalize call (src/server/extraction/shared.ts) instead of
// the multi-speaker transcript parser, then verifyClaimFn unchanged.

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { FramingPanel, VerdictPanel } from "#/components/fact-check-panels";
import { quickCheckFn } from "#/server/claim-extraction.functions";
import { verifyClaimFn } from "#/server/claim-verification.functions";
import type { Claim, Framing, Verdict } from "#/types/fact-check";

export const Route = createFileRoute("/quick")({ component: QuickCheck });

type QuickCheckState =
	| { status: "idle" }
	| { status: "checking" }
	| { status: "no_claim" }
	| { status: "error"; message: string }
	| { status: "verifying"; claim: Claim }
	| { status: "verified"; claim: Claim; verdict: Verdict; framing: Framing };

const SPEECH_ERROR_MESSAGES: Partial<Record<string, string>> = {
	"not-allowed": "Mikrofonzugriff wurde verweigert.",
	"service-not-allowed": "Mikrofonzugriff wurde verweigert.",
	"no-speech": "Es wurde keine Sprache erkannt. Versuche es erneut.",
	"audio-capture": "Kein Mikrofon gefunden.",
	// Chrome's built-in speech recognition sends audio to Google's servers
	// using an API key baked into official Google Chrome builds. Other
	// Chromium-based browsers (Brave, Vivaldi, Arc, Edge, ...) generally
	// lack that key, so every request fails with this exact error
	// regardless of actual connectivity — not something fixable here, so
	// the message names the likely cause instead of implying a real outage.
	network:
		"Die Spracherkennung konnte keine Verbindung herstellen. Das passiert oft, wenn kein offizielles Google Chrome verwendet wird (z. B. Brave, Vivaldi, Arc oder Edge) — versuche es in Google Chrome.",
};

/**
 * continuous + interimResults so the browser doesn't auto-stop the session
 * on the first pause in speech — recording only ends when the user clicks
 * the mic button again (recognition.stop()) or a real error occurs. Final
 * segments are accumulated across the session and committed to the input
 * as they land, so by the time recording actually stops the transcript is
 * already there.
 */
function useSpeechInput(onFinalTranscript: (text: string) => void) {
	const [supported, setSupported] = useState(false);
	// Mic access (getUserMedia, which SpeechRecognition uses under the hood)
	// is only granted in a secure context: HTTPS, or the browser-special-cased
	// "localhost"/"127.0.0.1". Opening the dev server via `--host` and
	// hitting it from another device (e.g. a phone, over the LAN IP) is
	// plain HTTP on a non-localhost address, so the browser silently denies
	// mic access without ever showing a permission prompt — indistinguishable
	// from a real "not-allowed" error unless we check this ourselves and say
	// so, instead of implying the user clicked "block".
	const [insecureContext, setInsecureContext] = useState(false);
	const [listening, setListening] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const recognitionRef = useRef<SpeechRecognition | null>(null);
	const finalTranscriptRef = useRef("");
	const onFinalTranscriptRef = useRef(onFinalTranscript);
	onFinalTranscriptRef.current = onFinalTranscript;

	useEffect(() => {
		const SpeechRecognitionImpl =
			window.SpeechRecognition ?? window.webkitSpeechRecognition;
		if (!SpeechRecognitionImpl) return;
		if (!window.isSecureContext) {
			setInsecureContext(true);
			return;
		}

		const recognition = new SpeechRecognitionImpl();
		recognition.lang = "de-DE";
		recognition.continuous = true;
		recognition.interimResults = true;

		recognition.onstart = () => {
			setError(null);
			setListening(true);
		};
		recognition.onresult = (event) => {
			for (let i = event.resultIndex; i < event.results.length; i++) {
				const result = event.results[i];
				const transcript = result?.[0]?.transcript;
				if (result?.isFinal && transcript) {
					finalTranscriptRef.current =
						`${finalTranscriptRef.current} ${transcript}`.trim();
					onFinalTranscriptRef.current(finalTranscriptRef.current);
				}
			}
		};
		recognition.onerror = (event) => {
			setListening(false);
			setError(
				SPEECH_ERROR_MESSAGES[event.error] ??
					"Spracheingabe ist fehlgeschlagen.",
			);
		};
		recognition.onend = () => setListening(false);

		recognitionRef.current = recognition;
		setSupported(true);

		return () => {
			recognition.onstart = null;
			recognition.onresult = null;
			recognition.onerror = null;
			recognition.onend = null;
			recognition.abort();
		};
	}, []);

	function toggle() {
		const recognition = recognitionRef.current;
		if (!recognition) return;
		if (listening) {
			recognition.stop();
			return;
		}
		finalTranscriptRef.current = "";
		setError(null);
		try {
			recognition.start();
		} catch {
			// Already starting/started (browser-dependent InvalidStateError on a
			// rapid double click) — the in-flight session's onstart/onend will
			// resolve the listening state, nothing to do here.
		}
	}

	return { supported, insecureContext, listening, error, toggle };
}

function QuickCheck() {
	const [input, setInput] = useState("");
	const [state, setState] = useState<QuickCheckState>({ status: "idle" });
	const quickCheck = useServerFn(quickCheckFn);
	const verifyClaim = useServerFn(verifyClaimFn);
	const speech = useSpeechInput((transcript) => setInput(transcript));

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (input.trim().length === 0) return;

		setState({ status: "checking" });
		try {
			const { claim } = await quickCheck({ data: { input } });
			if (!claim) {
				setState({ status: "no_claim" });
				return;
			}
			setState({ status: "verifying", claim });
			const result = await verifyClaim({ data: { claim } });
			setState({
				status: "verified",
				claim,
				verdict: result.verdict,
				framing: result.framing,
			});
		} catch (error) {
			setState({
				status: "error",
				message:
					error instanceof Error
						? error.message
						: "Die Prüfung ist fehlgeschlagen.",
			});
		}
	}

	const busy = state.status === "checking" || state.status === "verifying";

	return (
		<div className="mx-auto max-w-3xl p-8">
			<h1 className="text-3xl font-bold">Schnellcheck ⚡</h1>
			<p className="mt-2 text-sm text-gray-600">
				Tippe oder sprich eine einzelne Aussage oder eine Ja/Nein-Frage ein.
				Offene Wissensfragen ohne enthaltene Behauptung werden nicht
				beantwortet.
			</p>

			<form className="mt-6" onSubmit={handleSubmit}>
				<label htmlFor="quick-input" className="block text-sm font-medium">
					Aussage oder Frage
				</label>
				<div className="mt-1 flex gap-2">
					<input
						id="quick-input"
						type="text"
						className="h-11 w-full rounded border border-gray-300 px-3 text-sm"
						value={input}
						onChange={(event) => setInput(event.target.value)}
						placeholder="Deutschland hat die Atomkraft abgeschafft."
					/>
					{speech.supported && (
						<button
							type="button"
							onClick={speech.toggle}
							aria-pressed={speech.listening}
							title={
								speech.listening ? "Aufnahme stoppen" : "Spracheingabe starten"
							}
							className={`h-11 shrink-0 rounded border px-3 text-sm font-medium ${
								speech.listening
									? "animate-pulse border-red-600 bg-red-600 text-white"
									: "border-gray-300"
							}`}
						>
							{speech.listening ? "⏹" : "🎤"}
						</button>
					)}
				</div>
				{!speech.supported && !speech.insecureContext && (
					<p className="mt-1 text-xs text-gray-500">
						Spracheingabe wird in diesem Browser nicht unterstützt.
					</p>
				)}
				{speech.insecureContext && (
					<p className="mt-1 text-xs text-gray-500">
						Spracheingabe benötigt eine sichere Verbindung (HTTPS) oder
						„localhost“. Über eine lokale Netzwerkadresse (z. B. beim Testen auf
						dem Handy via <code>--host</code>) blockiert der Browser den
						Mikrofonzugriff automatisch.
					</p>
				)}
				{speech.listening && (
					<p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-700">
						<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" />
						Aufnahme läuft — klicke auf das Mikrofon, um sie zu beenden.
					</p>
				)}
				{speech.error && (
					<p className="mt-1 text-xs text-red-700">{speech.error}</p>
				)}
				<button
					type="submit"
					disabled={busy || input.trim().length === 0}
					className="mt-3 rounded bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
				>
					{state.status === "checking"
						? "Wird analysiert…"
						: state.status === "verifying"
							? "Wird geprüft…"
							: "Prüfen"}
				</button>
			</form>

			{state.status === "error" && (
				<p className="mt-6 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
					{state.message}
				</p>
			)}

			{state.status === "no_claim" && (
				<p className="mt-6 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
					Daraus lässt sich keine überprüfbare Behauptung ableiten — das klingt
					nach einer offenen Wissensfrage. Formuliere sie als Aussage oder als
					Ja/Nein-Frage, z. B. „Hat Deutschland die Atomkraft abgeschafft?“
					statt „Wie funktioniert die Energiewende?“.
				</p>
			)}

			{(state.status === "verifying" || state.status === "verified") && (
				<div className="mt-8">
					<p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
						Erkannte Behauptung
					</p>
					<p className="mt-1 text-sm">{state.claim.extractedClaim}</p>

					{state.status === "verified" && (
						<div className="mt-3 flex flex-col gap-3 sm:flex-row">
							<VerdictPanel verdict={state.verdict} />
							<FramingPanel framing={state.framing} />
						</div>
					)}
				</div>
			)}
		</div>
	);
}
