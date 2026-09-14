// src/types/speech-recognition.d.ts
//
// TypeScript's DOM lib ships the Web Speech API's event types
// (SpeechRecognitionEvent, SpeechRecognitionErrorEvent, ...) but not the
// SpeechRecognition interface or its window constructors. Declares only
// the members Quick Check's mic button actually uses (src/routes/quick.tsx)
// — not a full spec surface.

interface SpeechRecognition extends EventTarget {
	lang: string;
	continuous: boolean;
	interimResults: boolean;
	start(): void;
	stop(): void;
	abort(): void;
	onstart: (() => void) | null;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onend: (() => void) | null;
}

declare var SpeechRecognition: {
	prototype: SpeechRecognition;
	new (): SpeechRecognition;
};

interface Window {
	SpeechRecognition?: typeof SpeechRecognition;
	webkitSpeechRecognition?: typeof SpeechRecognition;
}
