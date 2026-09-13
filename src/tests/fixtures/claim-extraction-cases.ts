// src/tests/fixtures/claim-extraction-cases.ts
//
// Test cases for the claim-extraction step only — no verification/framing yet.
// Assert on `expectedClaimCount` and loose topic coverage, not exact string
// equality: LLM output phrasing varies run to run even when the underlying
// judgment is correct.

export interface ExtractionTestCase {
  name: string
  speaker: string
  quote: string
  expectedClaimCount: number
  /** What each expected claim should be about — check coverage, not exact wording. */
  expectedClaimTopics: string[]
  /** What this case is actually probing. */
  note: string
}

export const claimExtractionTestCases: ExtractionTestCase[] = [
  {
    name: 'single clear factual claim',
    speaker: 'Politikerin A',
    quote: 'Die Inflation lag im letzten Jahr bei 6,2 Prozent.',
    expectedClaimCount: 1,
    expectedClaimTopics: ['Inflationsrate von 6,2 Prozent im letzten Jahr'],
    note: 'Baseline case — one clean, checkable statistic. Should always pass.',
  },
  {
    name: 'two claims joined in one sentence',
    speaker: 'Abgeordneter B',
    quote: 'Die Arbeitslosigkeit ist um 20 Prozent gestiegen, und das ist ein historischer Höchststand.',
    expectedClaimCount: 2,
    expectedClaimTopics: [
      'Arbeitslosigkeit um 20 Prozent gestiegen',
      'historischer Höchststand der Arbeitslosigkeit',
    ],
    note: 'Tests whether a compound sentence gets split into two separately checkable claims rather than merged into one.',
  },
  {
    name: 'pure opinion, zero claims',
    speaker: 'Politiker C',
    quote: 'Diese Politik ist eine Katastrophe für unser Land.',
    expectedClaimCount: 0,
    expectedClaimTopics: [],
    note: 'Value judgment with nothing checkable. Extraction should correctly return zero claims, not force one out.',
  },
  {
    name: 'mixed fact and opinion',
    speaker: 'Politikerin D',
    quote: 'Wir haben letztes Jahr 50.000 neue Wohnungen gebaut, was viel zu wenig ist.',
    expectedClaimCount: 1,
    expectedClaimTopics: ['50.000 neue Wohnungen im letzten Jahr gebaut'],
    note: 'The factual clause should be extracted; the opinion clause ("viel zu wenig") should not become its own claim.',
  },
  {
    name: 'claim with cited source',
    speaker: 'Abgeordnete E',
    quote: 'Laut dem Statistischen Bundesamt sind die Lebensmittelpreise seit 2021 um 30 Prozent gestiegen.',
    expectedClaimCount: 1,
    expectedClaimTopics: ['Lebensmittelpreise seit 2021 um 30 Prozent gestiegen, laut Statistischem Bundesamt'],
    note: 'Quote should capture the full attributed claim, including the cited source, not just the bare number.',
  },
  {
    name: 'claim qualified across two sentences',
    speaker: 'Politiker F',
    quote: 'Die Steuereinnahmen sind gestiegen. Allerdings nur, weil wir die Steuersätze gleichzeitig erhöht haben.',
    expectedClaimCount: 1,
    expectedClaimTopics: ['Steuereinnahmen gestiegen aufgrund gleichzeitig erhöhter Steuersätze'],
    note: 'Tests the multi-sentence quote-span rule from PRD.md — the second sentence changes the meaning of the first, so both should land in one claim rather than being split or the caveat dropped.',
  },
  {
    name: 'vague, borderline-unverifiable claim',
    speaker: 'Politikerin G',
    quote: 'Vielen Familien in unserem Land geht es heute schlechter als vor zehn Jahren.',
    expectedClaimCount: 1,
    expectedClaimTopics: ['Verschlechterung der Lage vieler Familien in den letzten zehn Jahren'],
    note: 'Genuinely ambiguous — vague enough to be borderline checkable. No confidently "correct" answer; the point is seeing where the current prompt draws the line, not enforcing one.',
  },
  {
    name: 'rhetorical question, not a claim',
    speaker: 'Abgeordneter H',
    quote: 'Wollen wir wirklich, dass unsere Kinder in einem Land ohne Zukunft aufwachsen?',
    expectedClaimCount: 0,
    expectedClaimTopics: [],
    note: 'Carries an implied claim but is not itself a factual assertion. Tests that questions get filtered rather than having their implied proposition extracted.',
  },
  {
    name: 'numeric claim with specific date range',
    speaker: 'Politikerin I',
    quote: 'Zwischen 2015 und 2020 sind die Mieten in Berlin um über 40 Prozent gestiegen.',
    expectedClaimCount: 1,
    expectedClaimTopics: ['Mieten in Berlin zwischen 2015 und 2020 um über 40 Prozent gestiegen'],
    note: 'Checks that specific figures and the date range survive intact in extractedClaim rather than being vaguely paraphrased away.',
  },
  {
    name: 'checkable stat plus separate evaluative conclusion',
    speaker: 'Abgeordneter J',
    quote: 'Nur 2 Prozent der Anträge wurden abgelehnt – unser System funktioniert also hervorragend.',
    expectedClaimCount: 1,
    expectedClaimTopics: ['nur 2 Prozent der Anträge abgelehnt'],
    note: 'Extraction should isolate the checkable statistic only. The evaluative conclusion ("funktioniert hervorragend") is a good future candidate for a "Misleading framing" flag once verification runs — but that is out of scope for extraction, which should not treat it as a separate claim nor refuse to extract because the sentence "feels" spin-y.',
  },
]