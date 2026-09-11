// src/types/fact-check.ts
//
// Core domain types for claim extraction, verification, and framing.
// Field meanings and taxonomy definitions: see PRD.md — not repeated here.
//
// Naming note: PRD.md uses snake_case as spec shorthand; this file uses
// camelCase, the normal TypeScript convention. Fields otherwise match 1:1.

export interface Claim {
  id: string
  speaker: string
  /**
   * Minimal contiguous span of source text, extended to full sentence
   * boundaries, that contains the checkable claim. May span multiple
   * sentences. Quotes for different claims may overlap rather than
   * force-splitting a shared sentence.
   */
  quote: string
  /** Normalized, checkable statement derived from `quote`. */
  extractedClaim: string
}

export type VerdictCategory =
  | 'True'
  | 'False'
  | 'Partly true'
  | 'Unverifiable'
  | 'Disputed'

export type SourceStance = 'supports' | 'contradicts' | 'context'

export interface Source {
  url: string
  title: string
  stance: SourceStance
}

export interface Verdict {
  claimId: string
  category: VerdictCategory
  /**
   * 0–1, internal only. Used to threshold what surfaces and to sort for
   * review — never shown to the user as a raw number (see PRD.md).
   */
  confidence: number
  /**
   * If `category` is 'Disputed', sources should be grouped by which side
   * of the dispute they support — filter/group on `stance` at the UI
   * layer rather than collapsing into one verdict.
   */
  sources: Source[]
  /** Short text grounding the verdict in the cited evidence. */
  explanation: string
}

export type FramingFlag =
  | 'No issue'
  | 'Missing context'
  | 'Misleading framing'

export interface Framing {
  claimId: string
  flag: FramingFlag
  /** One line: what's omitted, or why the framing is misleading. */
  explanation: string
}