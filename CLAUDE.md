# CLAUDE.md

## Project

AI fact-checker for German political conversations — extracts factual claims from text, verifies them against retrieved evidence, and separately flags misleading framing. See `SCOPE.md` for v0 in/out scope — check it before making structural decisions or when scope is ambiguous. See `METHODOLOGY.md` for how this project's docs and dev workflow fit together (chat vs. Claude Code, testing layers, the ADR practice).

## Stack

- TypeScript throughout
- TanStack Start (Vite + TanStack Router + Nitro), file-router mode — full-stack, file-based type-safe routing, no RSC / no `"use client"` patterns
- Package manager: npm
- Toolchain: Biome (lint + format, single config, no separate Prettier)
- LLM provider: OpenAI API is the production default for both pipeline steps. Mistral is being evaluated as an alternative for both, behind a `--provider`/`--compare` flag on `eval:extraction` and `eval:verification` — dev-time comparison only, not a user-facing option or a production decision yet. The two steps use different OpenAI/Mistral APIs because they have different requirements:
  - Verification must ground every verdict in retrieved evidence (see Conventions), so it needs a built-in web search tool. OpenAI: the Responses API (`/v1/responses`) via `@ai-sdk/openai`'s `openai.tools.webSearch()` — Chat Completions doesn't support it. Mistral: the Agents/Conversations API (`/v1/conversations`) via the raw `@mistralai/mistralai` SDK, since `@ai-sdk/mistral` doesn't cover that API.
  - Extraction has no retrieval requirement — it's grounded directly in the pasted transcript (quotes are checked against it post-generation, see `src/server/extraction/shared.ts`) — so both providers use plain structured-output chat calls via the `ai` SDK: `@ai-sdk/openai` and `@ai-sdk/mistral`, both through `generateObject`.
  - Quick Check's classify-and-normalize call (`classifyQuickCheckInput` in `src/server/extraction/openai.ts`) is OpenAI-only — not part of the `ExtractionProvider` interface, since that interface exists to serve the `--provider`/`--compare` eval knob and Quick Check has no such flag. See ADR 0006.
  - Quick Check's voice input is transcribed server-side via OpenAI's Whisper API (`transcribeAudio` in `src/server/audio-transcription.server.ts`, using `transcribe()` from the `ai` SDK and `openai.transcription(modelId)` from `@ai-sdk/openai`, model configurable via `OPENAI_TRANSCRIPTION_MODEL`, default `whisper-1`) — also OpenAI-only, no Mistral counterpart. See ADR 0007.
- Database: TBD — self-hosting alongside the app via Coolify (same box) is a real, available option now that the deploy target is confirmed; still deciding against a managed alternative
- Deploy target: Hetzner VPS via Coolify — confirmed. Nitro build target: `node-server` preset (Coolify deploys via Docker)

## Commands

- Dev server: `npm run dev` (port 3000)
- Build: `npm run build`
- Preview production build: `npm run preview`
- Lint: `npm run lint` (Biome)
- Format: `npm run format` (Biome)
- Combined lint + format check: `npm run check` (Biome — this is not a type check)
- Regenerate route tree manually: `npm run generate-routes` (normally automatic during dev/build)
- Type check: none yet — no `tsc --noEmit` script exists. Worth adding (`"typecheck": "tsc --noEmit"`) given how much this stack leans on TypeScript inference
- Fast unit tests (deterministic, no LLM calls, safe on every save): `npm run test` / `npm run test:watch`. Config: `vitest.unit.config.ts`, specs in `src/tests/unit/**/*.test.ts`. Scope so far: the pure validation/grounding functions in `src/server/extraction/shared.ts` and `src/server/claim-verification.functions.ts`
- Extraction/verdict evals (real LLM calls, non-deterministic — see Conventions): `npm run eval:extraction` and `npm run eval:verification`, both defaulting to OpenAI and both accepting `-- --provider openai|mistral` or `-- --compare` (runs both providers, prints a per-case comparison table, never fails on mismatch — see each script's own eval file for what "compare" reports). Config: `vitest.config.ts`, specs in `src/tests/evals/**/*.eval.ts`

## Conventions

- Lean on TanStack Router's type inference end to end — avoid `any`, avoid manually duplicating types the loader already infers
- LLM calls must ground verdicts in retrieved evidence — never answer a verification question from the model's own memory/training data
- Keep the truth verdict (True / False / Partly true / Unverifiable / Disputed) and the framing flag (No issue / Missing context / Misleading framing) as separate fields, always — never merge them into a single score or badge
- No auth/session/account code in v0 (see `SCOPE.md`)
- Extraction/verdict tests are evals, not unit tests — they call the real LLM and are non-deterministic. Assert on claim count and loose topic coverage (substring/keyword match), never exact string equality on generated text. Kept behind a separate command (`npm run eval:*`, `vitest.config.ts`) from fast unit tests (`npm run test`, `vitest.unit.config.ts`), since they cost tokens and shouldn't run on every save
- Pure, deterministic logic (parsing, validation, grounding filters — no LLM call) gets a fast unit test in `src/tests/unit/`, not an eval fixture, even when the bug that motivated it was first found via extraction/verification. If it doesn't need a model to exercise, it doesn't belong behind `eval:*`
- Real-world cases (real transcripts, real professional fact-checks) are logged by hand in `MANUAL_TESTS.md`, separate from both test suites above. When one surfaces a real bug or edge case, promote it into an eval fixture or unit test per that file's promotion rule, rather than leaving it a one-off manual check
- UI copy is German-only (end users are German-language, single-user local tool — see `SCOPE.md`); the underlying `VerdictCategory`/`FramingFlag` types, LLM schema/prompts, and eval fixtures stay English, translated only at the presentation layer (`VERDICT_LABELS`/`FRAMING_LABELS` maps in `src/components/fact-check-panels.tsx`, shared by both routes). See ADR 0004
- Voice input (Quick Check's mic button, `src/routes/index.tsx`) is recorded client-side (`MediaRecorder`/`getUserMedia`) and transcribed server-side via OpenAI's Whisper API — not persisted anywhere, only forwarded to OpenAI. Replaced the original client-only Web Speech API approach, which proved unreliable outside actual Google Chrome (see ADR 0007). See `SCOPE.md`'s Quick Check bullet

## Workflow

- Plan Mode (or "list the files you'll touch first") for anything touching more than 2-3 files
- Model defaults: Sonnet for most work; `/model opusplan` for architecture/schema decisions; Haiku for repetitive mechanical tasks
- `/clear` between unrelated tasks; `/compact` mid-task when context is getting full

## Notes

_Empty for now — add a note here only after correcting Claude twice on the same thing, not on the first occurrence. Prune anything stale every few weeks._