import type { AssuranceGraph, GapNode } from '../kane/graph.ts';
import { quoteAnchor } from '../kane/graph.ts';

/**
 * A promise is one thing the client asked for, in words the client would recognise.
 *
 * Everything a client sees is a promise. They never see a test name, an id, or a
 * coverage percentage. The model below is deliberately built around what can be
 * *said honestly* about each promise, not around what is convenient to display.
 */

/**
 * Whether a promise can be checked in a browser at all.
 *
 * Established before anything runs, at `signedoff init` time, so a maker learns
 * what is and is not provable *before* quoting the work.
 */
export type Checkability =
  /** A test exists and can be run. */
  | 'checkable'
  /**
   * No observable surface exists, so proving it would require invention.
   * Kane's own word for this is `unmeasurable`. Email delivery is the classic
   * case: it happens outside the browser, so we say so instead of guessing.
   */
  | 'unmeasurable'
  /** Checkable in principle, but a missing input (URL, test card) blocks it. */
  | 'blocked'
  /** No test has been designed for it yet. */
  | 'not_designed';

/**
 * The verdict after a run.
 *
 * Three states, never two. `cannot_check` exists because conflating "your app is
 * broken" with "we could not tell" would be a lie in the client's favour or the
 * maker's, depending on the day — and it is the single fastest way to make a
 * handover page worthless. A timed-out run and a broken checkout are different
 * facts and are always reported as such.
 */
export type PromiseState = 'proven' | 'not_proven' | 'cannot_check';

/** How strongly a passing result actually supports the promise. */
export type Strength =
  /** A machine assertion checked this exact promise. */
  | 'asserted'
  /**
   * The test exercised the flow, but this particular promise rides on the
   * step prose rather than an assertion. Kane warns about this; we pass the
   * warning through rather than rounding it up to proof.
   */
  | 'observed';

export interface BlockingQuestion {
  readonly id: string;
  readonly header: string;
  readonly prompt: string;
  readonly options: readonly { readonly label: string; readonly detail: string }[];
  readonly recommendedIndex?: number;
  readonly reason?: string;
  readonly kind: string;
}

export interface DeliveryPromise {
  readonly id: string;
  /** The client-facing sentence. This is the only text a client reads. */
  readonly text: string;
  readonly risk: string;
  /** Kane's check shape: presence, forbidden-presence, propagation. */
  readonly kind: string;
  readonly useCaseId: string;
  readonly useCaseTitle: string;
  /** The client's own words, quoted from their document. */
  readonly quote?: string;
  readonly checkability: Checkability;
  readonly question?: BlockingQuestion;
  readonly testIds: readonly string[];
  readonly strength: Strength;
  /** Present only once a run has produced evidence. */
  readonly state?: PromiseState;
  /** Plain-language explanation, required whenever state is not `proven`. */
  readonly why?: string;
}

export interface PromiseInventory {
  readonly promises: readonly DeliveryPromise[];
  /** Gaps that are open questions for the client, not tied to one promise. */
  readonly openQuestions: readonly BlockingQuestion[];
  readonly counts: {
    readonly total: number;
    readonly checkable: number;
    readonly unmeasurable: number;
    readonly blocked: number;
    readonly notDesigned: number;
  };
}

// ---------------------------------------------------------------------------

function toQuestion(gap: GapNode): BlockingQuestion {
  return {
    id: gap.id,
    header: gap.header,
    prompt: gap.prompt,
    options: gap.options,
    ...(gap.recommendedIndex === undefined ? {} : { recommendedIndex: gap.recommendedIndex }),
    ...(gap.rationale === undefined ? {} : { reason: gap.rationale }),
    kind: gap.kind,
  };
}

/**
 * Build the promise inventory from the assurance graph.
 *
 * `documentText` is the client's source document, used to quote their own words
 * back at them. Kane records a line anchor on every use-case it derives.
 *
 * `warnings` are Kane's design receipts. We mine them for the machine-assertion
 * warning so that a promise riding only on prose is marked `observed`, never
 * presented with the same confidence as an asserted one.
 */
export function buildInventory(
  graph: AssuranceGraph,
  documentText: string,
  warnings: readonly string[] = [],
): PromiseInventory {
  const useCaseById = new Map(graph.useCases.map((uc) => [uc.id, uc]));
  const assertedByTest = parseAssertedWarnings(warnings);

  /**
   * A promise rides on prose when its test admitted to machine-asserting
   * something else. The warning names only the asserted criterion, so the
   * prose-only set is everything else that test claims to verify.
   */
  const ridesProse = (acId: string, testIds: readonly string[]): boolean =>
    testIds.some((testId) => {
      const asserted = assertedByTest.get(testId);
      return asserted !== undefined && !asserted.has(acId);
    });

  // Gaps that name an AC block that promise. The rest are project-level questions.
  const gapByBlockedAc = new Map<string, GapNode>();
  const projectGaps: GapNode[] = [];
  for (const gap of graph.gaps) {
    if (gap.blocks === undefined) projectGaps.push(gap);
    else gapByBlockedAc.set(gap.blocks, gap);
  }

  const promises: DeliveryPromise[] = graph.acs.map((ac) => {
    const useCaseId = graph.acToUseCase.get(ac.id) ?? '';
    const useCase = useCaseById.get(useCaseId);
    const testIds = graph.acToTests.get(ac.id) ?? [];
    const gap = gapByBlockedAc.get(ac.id);

    const quote =
      useCase?.anchor === undefined ? undefined : quoteAnchor(documentText, useCase.anchor);

    // Order matters. An unmeasurable promise stays unmeasurable even if a test
    // happens to exist, because the thing it claims is not browser-observable.
    let checkability: Checkability;
    if (gap?.kind === 'unmeasurable') checkability = 'unmeasurable';
    else if (gap !== undefined) checkability = 'blocked';
    else if (testIds.length === 0) checkability = 'not_designed';
    else checkability = 'checkable';

    const strength: Strength = ridesProse(ac.id, testIds) ? 'observed' : 'asserted';

    return {
      id: ac.id,
      text: ac.text,
      risk: ac.risk,
      kind: ac.kind,
      useCaseId,
      useCaseTitle: useCase?.title ?? '',
      ...(quote === undefined ? {} : { quote }),
      checkability,
      ...(gap === undefined ? {} : { question: toQuestion(gap) }),
      testIds,
      strength,
    };
  });

  return {
    promises,
    openQuestions: projectGaps.map(toQuestion),
    counts: {
      total: promises.length,
      checkable: promises.filter((p) => p.checkability === 'checkable').length,
      unmeasurable: promises.filter((p) => p.checkability === 'unmeasurable').length,
      blocked: promises.filter((p) => p.checkability === 'blocked').length,
      notDesigned: promises.filter((p) => p.checkability === 'not_designed').length,
    },
  };
}

/**
 * Parse Kane's machine-assertion warnings.
 *
 * Shape observed in practice:
 *   "t1: verifies 4 ACs but machine-asserts only 1 (check.verified_against=ac-3)
 *    — the rest ride prose only"
 *
 * The warning names the criteria that ARE machine-asserted. Everything else the
 * test claims to verify is therefore riding on the step prose. Returns
 * test id -> set of genuinely asserted AC ids.
 *
 * Test ids appear as `t1` in warnings but `t-1` in the graph, so both spellings
 * are recorded.
 */
function parseAssertedWarnings(warnings: readonly string[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();

  for (const warning of warnings) {
    if (!warning.includes('ride prose only')) continue;

    const testMatch = /^(t-?\d+)\s*:/.exec(warning);
    if (testMatch?.[1] === undefined) continue;

    const asserted = new Set<string>();
    for (const m of warning.matchAll(/verified_against=([a-z]+-\d+(?:\s*,\s*[a-z]+-\d+)*)/g)) {
      const list = m[1];
      if (list === undefined) continue;
      for (const id of list.split(',')) asserted.add(id.trim());
    }
    if (asserted.size === 0) continue;

    for (const id of normaliseTestId(testMatch[1])) {
      const existing = result.get(id) ?? new Set<string>();
      for (const ac of asserted) existing.add(ac);
      result.set(id, existing);
    }
  }

  return result;
}

/** `t1` and `t-1` refer to the same test in different Kane surfaces. */
function normaliseTestId(id: string): readonly string[] {
  const digits = id.replace(/^t-?/, '');
  return [`t-${digits}`, `t${digits}`];
}

/**
 * The client-facing headline.
 * Deliberately counts unmeasurable promises separately — never as failures,
 * and never quietly folded into the proven total.
 */
export function summarise(promises: readonly DeliveryPromise[]): {
  proven: number;
  notProven: number;
  cannotCheck: number;
  total: number;
} {
  let proven = 0;
  let notProven = 0;
  let cannotCheck = 0;

  for (const p of promises) {
    switch (p.state) {
      case 'proven':
        proven += 1;
        break;
      case 'not_proven':
        notProven += 1;
        break;
      default:
        cannotCheck += 1;
        break;
    }
  }

  return { proven, notProven, cannotCheck, total: promises.length };
}
