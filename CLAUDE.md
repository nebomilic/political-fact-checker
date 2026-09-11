# CLAUDE.md

## Project

AI fact-checker for German political conversations — extracts factual claims from text, verifies them against retrieved evidence, and separately flags misleading framing. See `SCOPE.md` for v0 in/out scope — check it before making structural decisions or when scope is ambiguous.

## Stack

- TypeScript throughout
- TanStack Start (Vite + TanStack Router + Nitro) — full-stack, file-based type-safe routing, no RSC / no `"use client"` patterns
- LLM provider: TBD (Claude API and/or OpenAI-compatible endpoints — provider abstraction likely via Vercel AI SDK if multi-provider ends up mattering)
- Database: TBD
- Deploy target: TBD (Nitro supports Vercel/Cloudflare/Node — decide at first deploy)

## Commands

_Fill in once the boilerplate exists:_
- Dev server: `TODO`
- Lint: `TODO`
- Type check: `TODO`
- Test: `TODO`

## Conventions

- Lean on TanStack Router's type inference end to end — avoid `any`, avoid manually duplicating types the loader already infers
- LLM calls must ground verdicts in retrieved evidence — never answer a verification question from the model's own memory/training data
- Keep the truth verdict (True / False / Partly true / Unverifiable / Disputed) and the framing flag (No issue / Missing context / Misleading framing) as separate fields, always — never merge them into a single score or badge
- No auth/session/account code in v0 (see `SCOPE.md`)

## Workflow

- Plan Mode (or "list the files you'll touch first") for anything touching more than 2-3 files
- Model defaults: Sonnet for most work; `/model opusplan` for architecture/schema decisions; Haiku for repetitive mechanical tasks
- `/clear` between unrelated tasks; `/compact` mid-task when context is getting full

## Notes

_Empty for now — add a note here only after correcting Claude twice on the same thing, not on the first occurrence. Prune anything stale every few weeks._