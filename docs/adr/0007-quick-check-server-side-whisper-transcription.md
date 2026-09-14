# ADR 0007: Quick Check voice input moves from the browser's Web Speech API to server-side Whisper transcription

**Status**: Accepted

## Context

Quick Check's mic button originally used the browser's built-in
`SpeechRecognition` (Web Speech API) — a deliberate choice (`SCOPE.md`)
to keep voice input entirely client-side: no server-side STT, no audio
ever leaving the browser, no new provider dependency.

In practice this proved unreliable enough to be a real usability problem,
not just a rough edge:

- It only works against Google's speech backend using an API key baked
  into official Google Chrome builds. Every other Chromium-based browser
  (Brave, Vivaldi, Arc, Edge, ...) gets a generic `"network"` error on
  every single request, regardless of actual connectivity — indistinguishable
  from a real outage unless you already know this.
- `getUserMedia`, which `SpeechRecognition` uses internally, only grants
  mic access in a secure context (HTTPS, or the browser-special-cased
  `localhost`). Testing on a phone against the dev server via `--host`
  (a LAN IP over plain HTTP) silently denied mic access without ever
  showing a permission prompt.
- Firefox has no support for the API at all.

These are the exact failures hit and worked around during this feature's
build. The user decided the reliability bar isn't met and asked to switch
to OpenAI's Whisper — a provider the app already depends on for extraction
and verification.

## Decision

Record audio client-side with the standard, broadly-supported
`MediaRecorder`/`getUserMedia` APIs (`src/routes/quick.tsx`'s
`useAudioRecording` hook), capped at 60 seconds per recording (auto-stops
and transcribes). On stop, the recorded clip is uploaded as `FormData` to
a new server function, `transcribeAudioFn`
(`src/server/audio-transcription.functions.ts`), which calls
`transcribeAudio` (`src/server/audio-transcription.server.ts`) — OpenAI's
Whisper API via `transcribe()` from the `ai` SDK and
`openai.transcription(modelId)` from `@ai-sdk/openai`, defaulting to
`whisper-1` (configurable via `OPENAI_TRANSCRIPTION_MODEL`), with a
`language: "de"` hint given the app is German-only. The resulting text is
written into the exact same `input` state Quick Check already had — the
classify → verify pipeline (ADR 0006) is completely unaffected by this
change.

No dual-provider treatment: transcription is OpenAI-only, same reasoning
as Quick Check's classify call (ADR 0006, ADR 0003) — there's no eval
harness to compare against, and the user asked for Whisper specifically.

## Consequences

- Reverses `SCOPE.md`'s original Quick Check constraint that voice input
  stays client-side with no server-side STT and no audio upload. Audio now
  transiently leaves the browser and is forwarded to OpenAI for
  transcription — it is not persisted anywhere (no disk write, no
  database — there isn't one yet), but this is a real, deliberate scope
  change worth being explicit about, not a quiet implementation detail.
  `SCOPE.md` has been updated to reflect this.
- New per-request cost and latency: every voice submission now costs a
  Whisper API call and an extra network round-trip, on top of the
  classify+verify calls Quick Check already makes. Negligible for a
  v0/single-user tool, but a materially different cost profile than the
  previous zero-cost client-only approach.
- No new vendor dependency — this reuses OpenAI, already the app's
  production LLM provider, rather than introducing a third-party STT
  service.
- The secure-context requirement is **not** resolved by this change:
  `getUserMedia` needs HTTPS or `localhost` exactly like `SpeechRecognition`
  did, so testing voice input on a phone over `--host` still requires one
  of the workarounds already documented in `CLAUDE.md`/session history
  (a tunnel, the Chrome insecure-origin flag, or just testing against a
  real deployment).
- The 60-second recording cap is an arbitrary safety net against a
  forgotten open mic turning into an unbounded upload/Whisper cost — worth
  revisiting if a genuine use case needs longer single utterances.
- `src/types/speech-recognition.d.ts` (the ambient `SpeechRecognition`
  typings TypeScript's DOM lib didn't ship) was deleted — `MediaRecorder`
  and `getUserMedia` are already fully typed, so no replacement ambient
  file was needed.
