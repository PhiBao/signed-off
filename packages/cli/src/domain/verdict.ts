import type { EvidencePack, Observation, PackCriterion } from '../kane/pack.ts';
import type { DeliveryPromise, PromiseState, Strength } from './promise.ts';

/**
 * Turning an evidence pack into client-facing verdicts.
 *
 * The rule that matters most here is that a green assertion is necessary but
 * not sufficient. During development this exact suite went green against a
 * storefront that really did offer Sunday delivery: the criterion said "Sunday
 * is not shown as the selected delivery date", and the generated assertion
 * checked the `<select>` element's *value* — which is `2026-08-23`, not
 * `Sunday 23 August`. The string "Sunday" never appears in the value, so the
 * assertion passed while the bug sat in plain sight.
 *
 * Kane had in fact recorded the truth one step earlier:
 *
 *   {"selectedText":"Sunday 23 August","selectedValue":"2026-08-23",
 *    "sundayOptions":["Sunday 23 August","Sunday 30 August","Sunday 6 September"]}
 *
 * So the evidence disproved the verdict it shipped with. A handover page that
 * rendered that as "proven" would be worse than useless — it would be a
 * confident lie with a video attached.
 *
 * Two safeguards follow, and neither costs a credit:
 *
 *   1. Observations are always surfaced next to the promise, so a human can see
 *      what the run actually read rather than only its conclusion.
 *   2. A narrow corroboration check: when a promise forbids something and the
 *      run recorded that thing present in the state the promise was about, the
 *      promise is reported as NOT proven, quoting what was seen.
 *
 * The check is deliberately conservative. It only fires for `forbidden-presence`
 * criteria, and only on observations that describe a current or selected state,
 * because page copy legitimately mentions forbidden things ("Sundays are not
 * available") and must never be mistaken for a violation.
 */

export interface Corroboration {
  /** Evidence that contradicts a passing assertion. */
  readonly contradicted: boolean;
  /** The observation that disagrees, phrased for a client. */
  readonly observed?: string;
  readonly detail?: string;
}

/**
 * Observation keys and intents that describe a live field state rather than
 * page prose. Only these can contradict a forbidden-presence promise.
 */
const STATE_HINT = /select|chosen|current|value|field|state|option/i;

/** Observation keys that are page copy, validation text or messaging. */
const COPY_HINT = /validation|message|copy|notice|help|hint|banner|label|text_content/i;

/**
 * Pull the distinctive term out of a forbidden-presence operand.
 *
 * "Sunday shown as the selected delivery date after the selection attempt"
 * yields "Sunday" — the proper noun is what makes the violation checkable.
 * Operands with no distinctive term yield nothing and the check does not run,
 * which is the safe default.
 */
export function forbiddenTerm(operand: string): string | undefined {
  // Proper nouns and quoted literals are the reliable signals.
  const quoted = /['"]([^'"]{2,40})['"]/.exec(operand);
  if (quoted?.[1] !== undefined) return quoted[1];

  const words = operand.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^A-Za-z0-9-]/g, '');
    if (clean.length < 3) continue;
    // A capitalised word that is not the first word is a proper noun.
    if (/^[A-Z][a-z]+$/.test(clean)) return clean;
  }
  return undefined;
}

/**
 * Does the evidence contradict a passing forbidden-presence assertion?
 */
export function corroborate(
  criterion: PackCriterion,
  observations: readonly Observation[],
): Corroboration {
  if (criterion.kind !== 'forbidden-presence') return { contradicted: false };

  const term = criterion.operand === undefined ? undefined : forbiddenTerm(criterion.operand);
  if (term === undefined) return { contradicted: false };

  const pattern = new RegExp(`\\b${escapeRegExp(term)}`, 'i');

  for (const observation of observations) {
    const context = `${observation.key} ${observation.intent}`;

    // Page copy may legitimately name the forbidden thing.
    if (COPY_HINT.test(context) && !STATE_HINT.test(observation.key)) continue;
    if (!STATE_HINT.test(context)) continue;

    const violation = findViolation(observation.value, pattern, term);
    if (violation !== undefined) {
      return {
        contradicted: true,
        observed: violation,
        detail:
          `The run recorded ${describeKey(observation.key)} as ${violation}, ` +
          `but this was promised not to happen.`,
      };
    }
  }

  return { contradicted: false };
}

/**
 * Look for the forbidden term inside an observed value.
 *
 * Structured observations are inspected field by field so that a selected value
 * counts and an unrelated sibling does not.
 */
function findViolation(value: string, pattern: RegExp, term: string): string | undefined {
  const trimmed = value.trim();

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return pattern.test(trimmed) ? quote(trimmed) : undefined;
    }
    return findInJson(parsed, pattern, term);
  }

  if (/^(false|no|none|null|0)$/i.test(trimmed)) return undefined;
  return pattern.test(trimmed) ? quote(trimmed) : undefined;
}

function findInJson(node: unknown, pattern: RegExp, term: string): string | undefined {
  if (typeof node === 'string') return pattern.test(node) ? quote(node) : undefined;

  if (Array.isArray(node)) {
    // A non-empty list of forbidden things is itself the violation.
    const hits = node.filter((item) => typeof item === 'string' && pattern.test(item));
    if (hits.length > 0) {
      return hits.length === 1 ? quote(String(hits[0])) : `${hits.length} × ${term} (${hits.map(String).map(quote).join(', ')})`;
    }
    return undefined;
  }

  if (typeof node === 'object' && node !== null) {
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      // Only fields describing a selection or current state can contradict.
      if (!STATE_HINT.test(key)) continue;
      const found = findInJson(child, pattern, term);
      if (found !== undefined) return found;
    }
  }

  return undefined;
}

function quote(text: string): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  const clipped = collapsed.length > 80 ? `${collapsed.slice(0, 77)}…` : collapsed;
  return `“${clipped}”`;
}

/** Turn an extraction key into something a client can read. */
function describeKey(key: string): string {
  const words = key
    .replace(/^answer_?/, '')
    .replace(/_/g, ' ')
    .replace(/\bcheck\b/g, '')
    .trim();
  return words === '' ? 'the page state' : `the ${words}`;
}

/**
 * Map a Kane execution status onto a client-facing verdict.
 *
 * `not-run` is `cannot_check`, never `not_proven`: a criterion nobody exercised
 * is an absence of evidence, not evidence of a defect.
 */
function verdictFor(execution: string): PromiseState {
  switch (execution) {
    case 'passed':
      return 'proven';
    case 'failed':
      return 'not_proven';
    default:
      return 'cannot_check';
  }
}

export interface VerdictOptions {
  /** Promises from the pre-build inventory, used to carry over provenance. */
  readonly inventory?: readonly DeliveryPromise[];
  /** Criteria Kane could never observe in a browser. */
  readonly unmeasurableIds?: ReadonlySet<string>;
}

/**
 * Build the client-facing promise list from a sealed pack.
 */
export function verdictsFromPack(
  pack: EvidencePack,
  options: VerdictOptions = {},
): readonly DeliveryPromise[] {
  const priorById = new Map((options.inventory ?? []).map((p) => [p.id, p]));
  const sourceText = [...pack.sources.values()][0] ?? '';

  return pack.criteria.map((criterion): DeliveryPromise => {
    const prior = priorById.get(criterion.id);
    const unmeasurable = options.unmeasurableIds?.has(criterion.id) === true
      || prior?.checkability === 'unmeasurable';

    let state: PromiseState = unmeasurable ? 'cannot_check' : verdictFor(criterion.execution);
    let why: string | undefined;
    let strength: Strength = prior?.strength ?? 'asserted';

    if (unmeasurable) {
      why = prior?.question?.reason
        ?? 'This happens outside the website, so it cannot be checked in a browser.';
    } else if (state === 'cannot_check') {
      why = 'No test exercised this yet, so there is nothing to show.';
    }

    // The corroboration check can only ever downgrade a pass.
    if (state === 'proven') {
      const check = corroborate(
        criterion,
        pack.observations.filter((o) => coversTest(criterion, o, pack)),
      );
      if (check.contradicted) {
        state = 'not_proven';
        why = check.detail;
        strength = 'observed';
      }
    }

    const quote = criterion.derivedFrom === undefined
      ? prior?.quote
      : (quoteFromAnchor(sourceText, criterion.derivedFrom) ?? prior?.quote);

    return {
      id: criterion.id,
      text: criterion.text,
      risk: criterion.risk,
      kind: criterion.kind,
      useCaseId: criterion.useCaseId,
      useCaseTitle: criterion.useCaseTitle,
      ...(quote === undefined ? {} : { quote }),
      checkability: unmeasurable ? 'unmeasurable' : prior?.checkability ?? 'checkable',
      ...(prior?.question === undefined ? {} : { question: prior.question }),
      testIds: criterion.coveredBy,
      strength,
      state,
      ...(why === undefined ? {} : { why }),
    };
  });
}

/** Restrict observations to the tests that actually cover this criterion. */
function coversTest(
  criterion: PackCriterion,
  observation: Observation,
  pack: EvidencePack,
): boolean {
  if (criterion.coveredBy.length === 0) return false;
  const test = pack.tests.find((t) => t.slug === observation.testSlug);
  if (test?.assuranceId === undefined) return true;
  return criterion.coveredBy.includes(test.assuranceId);
}

/** `scope#L21-L22` -> the quoted lines of the embedded source document. */
function quoteFromAnchor(sourceText: string, derivedFrom: string): string | undefined {
  const match = /#L(\d+)(?:-L(\d+))?$/.exec(derivedFrom);
  if (match?.[1] === undefined || sourceText === '') return undefined;

  const start = Number.parseInt(match[1], 10);
  const end = match[2] === undefined ? start : Number.parseInt(match[2], 10);
  const lines = sourceText.split('\n').slice(start - 1, end);
  const quoted = lines.join(' ').replace(/\s+/g, ' ').trim();
  return quoted === '' ? undefined : quoted;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
