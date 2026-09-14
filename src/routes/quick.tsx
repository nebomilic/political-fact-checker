// src/routes/quick.tsx
//
// Quick Check: a single typed or spoken statement/question, verified
// through the same pipeline as the transcript flow in routes/index.tsx —
// see SCOPE.md's Quick Check bullet and PRD.md. Reuses quickCheckFn's
// classify-and-normalize call (src/server/extraction/shared.ts) instead of
// the multi-speaker transcript parser, then verifyClaimFn unchanged.
//
// Voice input records audio client-side and transcribes it server-side via
// OpenAI's Whisper API (audio-transcription.functions.ts) — see ADR 0007
// for why this replaced the browser's Web Speech API.

import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { FramingPanel, VerdictPanel } from "#/components/fact-check-panels";
import { transcribeAudioFn } from "#/server/audio-transcription.functions";
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

const PREFERRED_MIME_TYPES = [
	"audio/webm;codecs=opus",
	"audio/webm",
	"audio/mp4",
	"audio/ogg;codecs=opus",
];

function pickSupportedMimeType(): string | undefined {
	return PREFERRED_MIME_TYPES.find((type) =>
		MediaRecorder.isTypeSupported(type),
	);
}

function fileExtensionForMimeType(mimeType: string): string {
	if (mimeType.includes("mp4")) return "mp4";
	if (mimeType.includes("ogg")) return "ogg";
	return "webm";
}

// A recording is capped at this many seconds and auto-stopped, so a
// forgotten open mic can't turn into an unbounded upload/Whisper cost.
const MAX_RECORDING_SECONDS = 60;

/**
 * Records audio client-side (MediaRecorder) and transcribes it server-side
 * via transcribeAudioFn (OpenAI Whisper — see ADR 0007). getUserMedia has
 * the same secure-context requirement the old Web Speech API had, so the
 * insecureContext check/message carry over unchanged.
 */
function useAudioRecording(onTranscript: (text: string) => void) {
	const [supported, setSupported] = useState(false);
	const [insecureContext, setInsecureContext] = useState(false);
	const [recording, setRecording] = useState(false);
	const [transcribing, setTranscribing] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const transcribeAudio = useServerFn(transcribeAudioFn);
	const onTranscriptRef = useRef(onTranscript);
	onTranscriptRef.current = onTranscript;

	useEffect(() => {
		const hasRecordingSupport =
			typeof navigator !== "undefined" &&
			!!navigator.mediaDevices?.getUserMedia &&
			typeof MediaRecorder !== "undefined";
		if (!hasRecordingSupport) return;
		if (!window.isSecureContext) {
			setInsecureContext(true);
			return;
		}
		setSupported(true);
	}, []);

	function stop() {
		if (autoStopTimerRef.current) {
			clearTimeout(autoStopTimerRef.current);
			autoStopTimerRef.current = null;
		}
		mediaRecorderRef.current?.stop();
	}

	async function start() {
		setError(null);
		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			const mimeType = pickSupportedMimeType();
			const recorder = new MediaRecorder(
				stream,
				mimeType ? { mimeType } : undefined,
			);
			chunksRef.current = [];

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) chunksRef.current.push(event.data);
			};
			recorder.onstop = async () => {
				for (const track of stream.getTracks()) track.stop();
				const blob = new Blob(chunksRef.current, {
					type: recorder.mimeType || mimeType || "audio/webm",
				});
				chunksRef.current = [];
				setRecording(false);
				if (blob.size === 0) return;

				setTranscribing(true);
				try {
					const formData = new FormData();
					formData.append(
						"audio",
						blob,
						`recording.${fileExtensionForMimeType(blob.type)}`,
					);
					const { text } = await transcribeAudio({ data: formData });
					if (text) onTranscriptRef.current(text);
				} catch (err) {
					setError(
						err instanceof Error
							? err.message
							: "Transkription ist fehlgeschlagen.",
					);
				} finally {
					setTranscribing(false);
				}
			};

			mediaRecorderRef.current = recorder;
			recorder.start();
			setRecording(true);
			autoStopTimerRef.current = setTimeout(stop, MAX_RECORDING_SECONDS * 1000);
		} catch (err) {
			if (err instanceof DOMException && err.name === "NotAllowedError") {
				setError("Mikrofonzugriff wurde verweigert.");
			} else if (err instanceof DOMException && err.name === "NotFoundError") {
				setError("Kein Mikrofon gefunden.");
			} else {
				setError("Zugriff auf das Mikrofon ist fehlgeschlagen.");
			}
		}
	}

	function toggle() {
		if (recording) {
			stop();
		} else {
			start();
		}
	}

	useEffect(() => {
		return () => {
			if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
			mediaRecorderRef.current?.stop();
		};
	}, []);

	return { supported, insecureContext, recording, transcribing, error, toggle };
}

function QuickCheck() {
	const [input, setInput] = useState("");
	const [state, setState] = useState<QuickCheckState>({ status: "idle" });
	const quickCheck = useServerFn(quickCheckFn);
	const verifyClaim = useServerFn(verifyClaimFn);
	const audio = useAudioRecording((transcript) => setInput(transcript));

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

	const busy =
		state.status === "checking" ||
		state.status === "verifying" ||
		audio.transcribing;

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
					<div className="relative w-full">
						<input
							id="quick-input"
							type="text"
							className="h-11 w-full rounded border border-gray-300 px-3 pr-9 text-sm"
							value={input}
							onChange={(event) => setInput(event.target.value)}
							placeholder="Deutschland hat die Atomkraft abgeschafft."
						/>
						{input.length > 0 && (
							<button
								type="button"
								onClick={() => setInput("")}
								aria-label="Eingabe löschen"
								title="Eingabe löschen"
								className="absolute inset-y-0 right-2 flex items-center text-gray-400 hover:text-gray-600"
							>
								✕
							</button>
						)}
					</div>
					{audio.supported && (
						<button
							type="button"
							onClick={audio.toggle}
							disabled={audio.transcribing}
							aria-pressed={audio.recording}
							title={
								audio.recording ? "Aufnahme stoppen" : "Spracheingabe starten"
							}
							className={`h-11 shrink-0 rounded border px-3 text-sm font-medium disabled:opacity-50 ${
								audio.recording
									? "animate-pulse border-red-600 bg-red-600 text-white"
									: "border-gray-300"
							}`}
						>
							{audio.recording ? "⏹" : "🎤"}
						</button>
					)}
				</div>
				{!audio.supported && !audio.insecureContext && (
					<p className="mt-1 text-xs text-gray-500">
						Spracheingabe wird in diesem Browser nicht unterstützt.
					</p>
				)}
				{audio.insecureContext && (
					<p className="mt-1 text-xs text-gray-500">
						Spracheingabe benötigt eine sichere Verbindung (HTTPS) oder
						„localhost“. Über eine lokale Netzwerkadresse (z. B. beim Testen auf
						dem Handy via <code>--host</code>) blockiert der Browser den
						Mikrofonzugriff automatisch.
					</p>
				)}
				{audio.recording && (
					<p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-red-700">
						<span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" />
						Aufnahme läuft — klicke auf das Mikrofon, um sie zu beenden.
					</p>
				)}
				{audio.transcribing && (
					<p className="mt-1 text-xs font-medium text-gray-600">
						Aufnahme wird transkribiert…
					</p>
				)}
				{audio.error && (
					<p className="mt-1 text-xs text-red-700">{audio.error}</p>
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
