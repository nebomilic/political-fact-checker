# METHODOLOGY.md

How work on this project actually happens: the split between deliberation
and execution, and the docs that bridge them. Read this if you're picking
the project back up after a while, or wondering why a decision lives in one
file and not another.

## Two environments, deliberately split

- **Claude Chat** (claude.ai) — deliberation: product decisions, tradeoffs,
  scope calls, business/strategy questions. Has no persistent connection to
  this repo — informed only by whatever's attached or pasted in (docs, logs,
  screenshots), never by inspecting the repo directly.
- **Claude Code** — execution: reads the repo directly, including
  uncommitted changes, implements, runs commands, runs evals and tests.

Neither replaces the other. Chat is for deciding, Claude Code is for doing.
Trying to do deep deliberation inside a Claude Code session fights the grain
of what it's for (and burns context budget on discussion instead of
implementation); trying to make real product decisions in Claude Code means
making them blind to the reasoning that chat is actually good at surfacing.

## The docs that bridge them

Each has one job. A given fact belongs in exactly one of these, not copied
across:

- **`CLAUDE.md`** — how to work in this repo: stack, conventions, commands,
  workflow. Read automatically by Claude Code at the start of every session.
- **`SCOPE.md`** — the boundary document: what's in/out for the current
  milestone, success criteria, open questions. Answers *what and why (and
  why not yet)*.
- **`PRD.md`** — the build spec: user flow and data shapes that operationalize
  whatever `SCOPE.md` says is in bounds. Answers *what to actually build*,
  without re-stating the boundaries.
- **`docs/adr/*.md`** — why a decision was made: the real alternatives
  considered, what was chosen, and the consequences — including ones not
  yet resolved. Not what or how — why, and what was given up.
- **`MANUAL_TESTS.md`** — real-world cases and observations, judged by eye,
  kept separate from both automated test layers below.

## Syncing chat and repo

Since chat has no live repo access, bring current state to it deliberately:
attach `CLAUDE.md`, `SCOPE.md`, `PRD.md`, and `docs/adr/*.md` at the start of
a chat session involving real decisions. For anything more granular — a
specific bug, a deploy log, a file's contents — paste it in as needed rather
than trying to sync everything up front.

## The drift-check ritual: the `docs-sync` skill

These docs describe decisions, not necessarily current reality — they can
drift from what's actually built (this has happened at least once already,
caught only because it was asked about directly). The informal fix — asking
Claude Code to diff implementation against the docs — is now a standing
skill: `/docs-sync` (`.claude/skills/docs-sync/SKILL.md`). It reviews
`CLAUDE.md`, `SCOPE.md`, and `PRD.md` section by section against current
repo state (or a given scope — a commit range, a PR), updates whichever have
gone stale, updates any existing ADR a session's work has quietly
invalidated, and adds a new ADR when the work contains a decision that
clears the bar below. Invoked deliberately — typically at the end of a task
or session, before a version tag, or after wrapping a feature — never
automatically after a routine change.

## Testing layers

Three layers, kept deliberately separate (exact rules in `CLAUDE.md`'s
Conventions section):

- **Fast unit tests** — deterministic, no LLM calls, safe on every save.
- **Evals** — real LLM calls, non-deterministic, loose assertions, their own
  command, not run on every save.
- **Manual tests** — real-world cases, human judgment, logged in
  `MANUAL_TESTS.md`. Promoted into an eval or unit test once one surfaces
  something worth protecting against regressions, rather than staying a
  one-off check.

## When to write an ADR

A decision earns an ADR when real alternatives were seriously weighed, not
when there was only ever one reasonable option. Capture the context, the
decision, and the consequences — including the ones still open. Numbered
sequentially in `docs/adr/`. This is also the bar `docs-sync` applies when
deciding whether a session's work needs a new one — most sessions shouldn't
produce one, and the skill says so explicitly rather than adding an ADR by
default.

## Model and context discipline

See `CLAUDE.md`'s Workflow section for the specifics (model defaults,
`/clear`, `/compact`, `/context`) — not duplicated here.