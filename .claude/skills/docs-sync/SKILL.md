---
name: docs-sync
description: Review recent work and update CLAUDE.md, SCOPE.md, PRD.md, and README.md if they've gone stale, and add or update Architecture Decision Records under docs/adr/ for any genuinely non-obvious decisions made. Invoke deliberately at the end of a task or session — not automatically after every change.
---

# docs-sync

Keeps this project's standing documentation (`CLAUDE.md`, `SCOPE.md`,
`PRD.md`, `README.md`) accurate, and `docs/adr/` populated with real
decision records — without letting either rot from neglect or bloat from
over-documentation. Invoked deliberately by the user, typically at the end
of a task or a working session. Never run this automatically after a
routine change.

Ground rule for the whole skill: **only state what's actually true or
actually discussed.** Every doc update and every ADR must be grounded in
verifiable repo state (read the file, run the command, check the diff) or
in reasoning that was genuinely part of the conversation/work being
reviewed. Never invent a rationale that sounds plausible but wasn't the
real reason something was done.

## Step 1 — Establish what changed

Prefer the current conversation's context if this is being run in the same
session as the work — it's the richest source of *why*, not just *what*.
If invoked with an explicit scope (a commit range, a PR, "since last
week"), use that instead. If invoked cold with neither (fresh session, no
argument), fall back to `git log` / `git diff` against the most recent
commits, and `git status` for anything uncommitted — read enough of the
actual diffs to understand the change, don't guess from commit messages
alone.

## Step 2 — CLAUDE.md pass

Re-read `CLAUDE.md` section by section against current repo reality:

- **Stack**: still accurate? New dependencies, providers, or architectural
  splits that change what this section claims?
- **Commands**: does every command listed still work as described? Are
  there new commands (scripts in `package.json`) that aren't documented
  yet?
- **Conventions**: did this work establish, confirm, or contradict a
  convention? Only add a new convention bullet if it's a real, durable rule
  future work should follow — not a one-off implementation detail.
- **Workflow**: rarely changes; touch only if the actual working process
  changed.
- **Notes**: do **not** add to this section as part of this skill. Its own
  text reserves it for behavioral corrections after repeated mistakes —
  that's a narrower, different purpose than doc-syncing, and not this
  skill's call to make.

Edit directly rather than asking permission first — these are low-risk,
reversible doc edits — but report exactly what you changed and why in the
final summary (Step 7).

## Step 3 — SCOPE.md pass

Check each section against what was actually built or decided:

- Did anything move from "explicitly out of scope" into something the
  codebase now actually does? That's worth flagging prominently, not
  quietly editing past.
- Did an "open question" get answered by this work? Update it to reflect
  the answer, or point to the ADR that now covers it, rather than deleting
  the question silently.
- Do the success criteria still make sense given what's been built?

## Step 4 — PRD.md pass

Check that documented flows/behavior still match what's implemented. If
the PRD describes something that changed shape (a field, a step, a UI
flow), update the description — but PRD.md is product intent, not
implementation detail; don't turn it into a changelog.

## Step 5 — README.md pass

README.md is the front door — a newcomer's or future-you's first few
minutes, not a restatement of PRD.md's full detail. Check only the parts a
reader would actually rely on:

- **Getting started**: does the install/setup/run sequence still match
  `package.json` and `.env.example`? A new required env var or a changed
  setup step here is a real bug, not a style nit.
- **Commands**: does it match `CLAUDE.md`'s Commands section and the
  scripts in `package.json`? Either mirror CLAUDE.md's list or stay
  deliberately trimmed with a pointer there for the rest — don't let it
  drift into a third, independent command list.
- **Feature/flow overview**: if the product now does something README
  doesn't mention (a new entry point, a changed flow), add a short
  mention — a sentence or two, not PRD.md's full step-by-step.
- **Docs map**: any new standing doc worth linking from here?

## Step 6 — ADR pass

Two separate checks:

**(a) Do any existing ADRs need updating?** Read every file in
`docs/adr/`. If this session's work changed a fact, decision, or
consequence an existing ADR describes (a new option added to something it
called "not yet implemented," a prediction it made now has real data
behind it, an API/approach it named got extended or replaced), update that
ADR in place rather than leaving it to quietly go stale. This is usually
the more common case — don't skip straight to "should I add a new one."

**(b) Does this work contain a decision worth a new ADR?** Apply this bar
honestly; most changes should *not* get one:

- Was there a real alternative that was seriously considered and rejected
  (not just "the only sane option")?
- Would a future contributor plausibly look at the code and ask "why is
  this built this way and not the obvious other way"?
- Does it commit to something meaningfully hard to reverse (a schema
  shape, an external API/vendor choice, a scope boundary, a cost/latency
  tradeoff), rather than an easily-changed implementation detail?
- Is the reasoning actually non-obvious — would restating it in one line of
  a code comment have been enough?

If a decision clears that bar, write a new ADR matching the house style
established in `docs/adr/`:
- Filename: `NNNN-kebab-case-title.md`, next sequential number.
- Sections: `# ADR NNNN: <title>`, `**Status**`, `## Context`, `##
  Decision`, `## Consequences`.
- Consequences should include real costs/gaps/open threads, not just
  benefits — every existing ADR in this repo does this; match that honesty
  rather than writing a one-sided justification.
- Cross-reference related ADRs by number where relevant, the way the
  existing ones do.

If nothing clears the bar, say so explicitly in the summary rather than
silently skipping it — "considered an ADR for X, didn't add one because Y"
is useful output, not a non-event.

## Step 7 — Summarize

Close with a concise, scannable summary: what was updated in each of the
four standing docs (or "no changes needed" per file, stated plainly), which
ADRs were updated and why, which new ADRs were added, and — explicitly —
what was considered and deliberately *not* added or changed, with the
reason. The goal is for the user to be able to skim the summary and catch
a disagreement without having to re-read every diff.
