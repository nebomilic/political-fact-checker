# CLAUDE.md

## Project

AI fact-checker for German political conversations — extracts factual claims from text, verifies them against retrieved evidence, and separately flags misleading framing. See `SCOPE.md` for v0 in/out scope — check it before making structural decisions or when scope is ambiguous.

## Stack

- TypeScript throughout
- TanStack Start (Vite + TanStack Router + Nitro), file-router mode — full-stack, file-based type-safe routing, no RSC / no `"use client"` patterns
- Package manager: npm
- Toolchain: Biome (lint + format, single config, no separate Prettier)
- LLM provider: OpenAI API, via the Responses API (`/v1/responses`) — needed specifically for the built-in `web_search` tool, which Chat Completions doesn't support. Provider abstraction (e.g. Vercel AI SDK) only worth adding if multi-provider actually becomes a real need
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
- Test: none yet — adopting Vitest. Extraction/verdict evals will run as their own command (e.g. `npm run eval:extraction`), separate from any fast unit tests added later (see Conventions)

## Conventions

- Lean on TanStack Router's type inference end to end — avoid `any`, avoid manually duplicating types the loader already infers
- LLM calls must ground verdicts in retrieved evidence — never answer a verification question from the model's own memory/training data
- Keep the truth verdict (True / False / Partly true / Unverifiable / Disputed) and the framing flag (No issue / Missing context / Misleading framing) as separate fields, always — never merge them into a single score or badge
- No auth/session/account code in v0 (see `SCOPE.md`)
- Extraction/verdict tests are evals, not unit tests — they call the real LLM and are non-deterministic. Assert on claim count and loose topic coverage (substring/keyword match), never exact string equality on generated text. Keep them behind a separate command from any future fast/mocked unit tests, since they cost tokens and shouldn't run on every save

## Workflow

- Plan Mode (or "list the files you'll touch first") for anything touching more than 2-3 files
- Model defaults: Sonnet for most work; `/model opusplan` for architecture/schema decisions; Haiku for repetitive mechanical tasks
- `/clear` between unrelated tasks; `/compact` mid-task when context is getting full

## Notes

_Empty for now — add a note here only after correcting Claude twice on the same thing, not on the first occurrence. Prune anything stale every few weeks._