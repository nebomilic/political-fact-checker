# Faktencheck 🔍

AI fact-checker for German political conversations. Paste a transcript, and
it extracts discrete factual claims, verifies each one against retrieved
web evidence with a categorical verdict (True / False / Partly true /
Unverifiable / Disputed), and separately flags misleading framing (No
issue / Missing context / Misleading framing) — kept structurally distinct
from the verdict, never merged into one score.

This is a v0/single-user tool, not a production product yet. See
[`SCOPE.md`](./SCOPE.md) for what's in and out of scope, and
[`METHODOLOGY.md`](./METHODOLOGY.md) for how the project's docs fit
together and how decisions get made.

## Docs map

- [`SCOPE.md`](./SCOPE.md) — what v0 is and isn't, success criteria, open questions
- [`PRD.md`](./PRD.md) — user flow and data shapes
- [`CLAUDE.md`](./CLAUDE.md) — stack, conventions, commands (read automatically by Claude Code)
- [`METHODOLOGY.md`](./METHODOLOGY.md) — how deliberation (chat) and execution (Claude Code) split, and how the docs bridge them
- [`docs/adr/`](./docs/adr/) — architecture decision records: why, not just what
- [`MANUAL_TESTS.md`](./MANUAL_TESTS.md) — real-world test cases logged by hand against professional fact-checks

## Getting started

```bash
npm install
cp .env.example .env
```

Fill in `OPENAI_API_KEY` in `.env` — this is the only key required to run
the app. (`MISTRAL_API_KEY` is only needed for the dev-time provider-comparison
evals, see below and `CLAUDE.md`'s Stack section.)

```bash
npm run dev
```

Runs at `http://localhost:3000`.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (port 3000) |
| `npm run build` | Production build |
| `npm run preview` | Preview a production build |
| `npm run lint` / `npm run format` / `npm run check` | Biome lint / format / combined check |
| `npm run test` / `npm run test:watch` | Fast unit tests — deterministic, no LLM calls |
| `npm run eval:extraction` / `npm run eval:verification` | Evals against the real LLM — non-deterministic, not run on every save. Accepts `-- --provider openai\|mistral` or `-- --compare` |
| `npm run generate-routes` | Regenerate the TanStack Router route tree (normally automatic) |

See `CLAUDE.md`'s Commands section for the fuller picture, including what
each test layer actually covers.

## Stack

TypeScript, [TanStack Start](https://tanstack.com/start) (Vite + TanStack
Router + Nitro, file-router mode), [Biome](https://biomejs.dev/) for
lint/format, OpenAI as the production LLM provider (Mistral evaluated
alongside it as a dev-time comparison — not user-facing). Deploy target is
a Hetzner VPS via Coolify. Full rationale for each of these lives in
`CLAUDE.md` and the relevant ADRs under `docs/adr/`.
