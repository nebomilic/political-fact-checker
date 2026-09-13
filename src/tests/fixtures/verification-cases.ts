// src/tests/fixtures/verification-cases.ts
//
// Test cases for the verification step: given a Claim, check the resulting
// Verdict.category and Framing.flag. Same eval philosophy as
// claim-extraction-cases.ts — these call the real pipeline (real LLM +
// real web search), so treat results directionally, not as rigid pass/fail.
//
// Two different kinds of case here, and they should be treated differently:
//
// 1. STABLE cases — built on well-established, non-time-sensitive facts.
//    category/flag equality is a reasonable strict assertion. Most cases
//    that started out as SCENARIO were rewritten into this bucket by
//    swapping a fabricated, unnamed setup (an unnamed city's crime rate, an
//    unnamed country's "our climate measures") for a real, dated, publicly
//    documented fact — once retrieval has something genuine to find, the
//    case stops being a coin flip on whether an assumed context exists.
// 2. SCENARIO cases (marked below) — assume a specific evidence context
//    that the real retrieval step has to actually find for the expected
//    framing flag to make sense. A mismatch here may mean the framing logic
//    is wrong, OR that retrieval simply didn't surface the assumed context
//    — treat as a prompt to investigate, not an automatic failure.
//
// Also worth knowing: a handful of these were chosen to test that
// `category` and `flag` are independent axes — a flatly false or
// authoritatively-worded claim isn't automatically "misleading framing,"
// and a true claim isn't automatically "no issue." Don't let the two
// fields drift into influencing each other.

import type { Claim, VerdictCategory, FramingFlag } from '#/types/fact-check'

export interface VerificationTestCase {
  name: string
  claim: Omit<Claim, 'id'>
  expectedVerdictCategory: VerdictCategory
  expectedFramingFlag: FramingFlag
  /** STABLE or SCENARIO — see file header. */
  kind: 'stable' | 'scenario'
  note: string
}

export const verificationTestCases: VerificationTestCase[] = [
  {
    name: 'clearly true, stable, uncontested fact',
    claim: {
      speaker: 'Politikerin A',
      quote: 'Deutschland ist Mitglied der Europäischen Union.',
      extractedClaim: 'Deutschland ist Mitglied der EU.',
    },
    expectedVerdictCategory: 'True',
    expectedFramingFlag: 'No issue',
    kind: 'stable',
    note: 'Baseline true case — stable, uncontested, should always pass.',
  },
  {
    name: 'clearly false, easily checkable statistic',
    claim: {
      speaker: 'Politiker B',
      quote: 'Deutschland hat aktuell über 200 Millionen Einwohner.',
      extractedClaim: 'Deutschland hat über 200 Millionen Einwohner.',
    },
    expectedVerdictCategory: 'False',
    expectedFramingFlag: 'No issue',
    kind: 'stable',
    note: 'Baseline false case. Also tests axis independence: a plainly false claim isn\'t "framed" misleadingly — it\'s just wrong. Framing should stay "No issue" here, not get pulled toward a framing flag just because the claim is false.',
  },
  {
    name: 'true only with an unstated caveat',
    claim: {
      speaker: 'Politikerin C',
      quote: 'Deutschland hat den Atomausstieg vollzogen.',
      extractedClaim: 'Deutschland hat vollständig auf Kernkraft verzichtet.',
    },
    expectedVerdictCategory: 'Partly true',
    expectedFramingFlag: 'Missing context',
    kind: 'stable',
    note: 'Germany shut down its last commercial reactors in 2023, but still imports nuclear-generated electricity via the grid from neighboring countries — "vollständig verzichtet" glosses over that. Verify current sourcing before trusting this as fixed ground truth; energy policy specifics can shift.',
  },
  {
    name: 'unverifiable — cites a non-public internal source',
    claim: {
      speaker: 'Abgeordneter D',
      quote: 'Laut einer internen Umfrage unserer Partei unterstützen 68 Prozent der Bürger unser neues Rentenkonzept.',
      extractedClaim: '68 Prozent der Bürger unterstützen laut interner Parteiumfrage das neue Rentenkonzept.',
    },
    expectedVerdictCategory: 'Unverifiable',
    expectedFramingFlag: 'No issue',
    kind: 'stable',
    note: 'An internal, unpublished survey has no independently checkable evidence trail. Tests that the system says "Unverifiable" rather than fabricating confidence around a source it can\'t actually access.',
  },
  {
    name: 'genuinely disputed policy-effectiveness claim',
    claim: {
      speaker: 'Politikerin E',
      quote: 'Die Erhöhung des Mindestlohns hat zu einem spürbaren Verlust von Arbeitsplätzen geführt.',
      extractedClaim: 'Die Mindestlohnerhöhung führte zu spürbaren Arbeitsplatzverlusten.',
    },
    expectedVerdictCategory: 'Disputed',
    expectedFramingFlag: 'No issue',
    kind: 'stable',
    note: 'Minimum-wage employment effects are genuinely contested in economic literature — credible sources land on both sides. Tests that the system surfaces the disagreement rather than forcing a single verdict.',
  },
  {
    name: 'true statistic, missing context (pandemic-depressed baseline)',
    claim: {
      speaker: 'Politiker F',
      quote: 'Die Zahl der Fluggäste an deutschen Flughäfen hat sich 2022 im Vergleich zum Vorjahr mehr als verdoppelt.',
      extractedClaim: 'Fluggastzahlen an deutschen Flughäfen haben sich 2022 gegenüber 2021 mehr als verdoppelt.',
    },
    expectedVerdictCategory: 'True',
    expectedFramingFlag: 'Missing context',
    kind: 'stable',
    note: 'Real and well-documented: German air passenger numbers did roughly more than double in 2022 versus 2021, but only because 2021 was still catastrophically depressed by pandemic travel restrictions — 2022 levels remained well below pre-pandemic 2019 traffic. Replaces an earlier version of this case that named no city and assumed a fabricated "unusual spike," which made it unverifiable rather than a real missing-context test. This one is grounded in an actual, stable, widely-reported baseline-distortion pattern, so it counts as stable rather than scenario.',
  },
  {
    name: 'true statistic used to imply an unsupported conclusion',
    claim: {
      speaker: 'Abgeordnete G',
      quote: 'Der Anteil erneuerbarer Energien am deutschen Bruttostromverbrauch lag 2023 erstmals bei über 50 Prozent – wir sind beim Klimaschutz also auf einem hervorragenden Weg.',
      extractedClaim: 'Der Anteil erneuerbarer Energien am Bruttostromverbrauch lag 2023 erstmals über 50 Prozent.',
    },
    expectedVerdictCategory: 'True',
    expectedFramingFlag: 'Misleading framing',
    kind: 'stable',
    note: 'Real and stable: Germany\'s renewable share of gross electricity consumption did cross 50% for the first time in 2023 (widely reported, e.g. by Fraunhofer ISE / AG Energiebilanzen). But electricity-sector progress isn\'t the same as overall climate-neutrality progress — Germany has repeatedly missed its own targets in transport and buildings specifically. Same true-fact-implies-unsupported-conclusion pattern as extraction test case 10 and the original version of this case, but now anchored to a real, checkable figure instead of an unnamed "our climate measures," so retrieval has something genuine to confirm rather than nothing to find.',
  },
  {
    name: 'fair framing despite comparative structure',
    claim: {
      speaker: 'Politikerin H',
      quote: 'Die Arbeitslosigkeit ist im Vergleich zum Vorjahresmonat leicht gestiegen, bleibt aber im langjährigen Vergleich niedrig.',
      extractedClaim: 'Arbeitslosigkeit im Vergleich zum Vorjahresmonat leicht gestiegen, im langjährigen Vergleich aber niedrig.',
    },
    expectedVerdictCategory: 'True',
    expectedFramingFlag: 'No issue',
    kind: 'scenario',
    note: 'SCENARIO: verify the current actual unemployment comparison before trusting the True label — the real point of this case is the framing flag: the claim already includes its own caveat rather than omitting one. Tests that the system doesn\'t over-flag any claim with a comparative structure just because comparisons can be misused.',
  },
  {
    name: 'false claim wrapped in authoritative-sounding language',
    claim: {
      speaker: 'Politiker I',
      quote: 'Nach übereinstimmenden wissenschaftlichen Studien ist der Meeresspiegel in den letzten zehn Jahren nicht gestiegen.',
      extractedClaim: 'Der Meeresspiegel ist in den letzten zehn Jahren laut wissenschaftlichen Studien nicht gestiegen.',
    },
    expectedVerdictCategory: 'False',
    expectedFramingFlag: 'No issue',
    kind: 'stable',
    note: 'Global sea level rise over the past decade is well-documented and not scientifically contested. Tests that invoking "übereinstimmende Studien" doesn\'t push the system toward "Disputed" when the actual evidence is one-sided.',
  },
  {
    name: 'vague, composite claim without a clear metric',
    claim: {
      speaker: 'Abgeordneter J',
      quote: 'Die Lebensqualität für Familien hat sich in den letzten Jahren insgesamt verschlechtert.',
      extractedClaim: 'Die Lebensqualität für Familien hat sich in den letzten Jahren verschlechtert.',
    },
    expectedVerdictCategory: 'Unverifiable',
    expectedFramingFlag: 'No issue',
    kind: 'stable',
    note: 'Genuinely ambiguous — no confidently "correct" verdict. "Disputed" would also be a defensible outcome if the model finds conflicting quality-of-life indices. The point is seeing where the current implementation draws this line, same spirit as extraction test case 7.',
  },
  {
    name: 'directionally right number, wrong attribution',
    claim: {
      speaker: 'Politikerin K',
      quote: 'Laut der Deutschen Bundesbank lag die Inflationsrate in Deutschland im Jahr 2022 bei rund 8 Prozent.',
      extractedClaim: 'Inflationsrate in Deutschland lag 2022 laut Deutscher Bundesbank bei rund 8 Prozent.',
    },
    expectedVerdictCategory: 'Partly true',
    expectedFramingFlag: 'No issue',
    kind: 'stable',
    note: 'Real and stable: German CPI inflation for 2022 was about 7.9% (roundable to "rund 8 Prozent"), so the number is right. But the official inflation rate is calculated and published by the Statistisches Bundesamt (Destatis), not the Bundesbank — a structurally verifiable misattribution (which body has the mandate to publish this statistic), not a live-data question. Anchored to a fixed historical year so it won\'t drift the way a "last quarter" figure would. Tests the same right-number-wrong-source pattern as the original version of this case, without depending on which body happens to have most recently published the freshest current figure.',
  },
]