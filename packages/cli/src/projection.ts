import type { DeliveryPromise } from './domain/promise.ts';
import type { EvidencePack, Observation } from './kane/pack.ts';

/**
 * The client-safe projection of an evidence pack.
 *
 * This is a SECURITY BOUNDARY. An evidence pack is built for the maker and
 * contains material that must never reach a client-facing page:
 *
 *   result.yaml   external_id.user_email, and a live `sharable_link` granting
 *                 access to the run in TestMuAI's dashboard
 *   logs/*.har    full network traces, including request headers and therefore
 *                 any bearer tokens or session cookies the run carried
 *   logs/*.ndjson console output, which routinely leaks internals
 *
 * Everything below is built by ALLOWLIST: fields are copied in one at a time and
 * named explicitly. A denylist would be one Kane release away from leaking, and
 * the failure mode is publishing a client's session token to an unauthenticated
 * URL. If a new field is wanted on the page, it has to be added here on purpose.
 */

export const BUNDLE_VERSION = 1;

export interface BundleMedia {
  /** Path relative to the bundle's media directory. */
  readonly file: string;
  /** Plain-language description of what the screenshot shows. */
  readonly caption: string;
}

export interface BundleObservation {
  /** What was being read, in plain words. */
  readonly label: string;
  /** What it read. */
  readonly value: string;
}

export interface BundlePromise {
  readonly id: string;
  /** The promise, in the client's own words. */
  readonly text: string;
  readonly state: 'proven' | 'not_proven' | 'cannot_check';
  /** Required whenever state is not `proven`. */
  readonly why?: string;
  /** Quoted from the client's own document. */
  readonly quote?: string;
  readonly groupTitle: string;
  /** `asserted` was machine-checked; `observed` rode on the step prose. */
  readonly strength: 'asserted' | 'observed';
  /** What the run actually read off the page, for a client to see. */
  readonly observed: readonly BundleObservation[];
  readonly media: readonly BundleMedia[];
}

export interface HandoverBundle {
  readonly version: typeof BUNDLE_VERSION;
  readonly slug: string;
  readonly title: string;
  readonly client: string;
  readonly milestone: number;
  readonly createdAt: string;
  readonly run: {
    /** Content id of the pack this page describes. A sign-off binds to it. */
    readonly id: string;
    readonly startedAt?: string;
    readonly endedAt?: string;
    readonly browser: string;
    readonly producer: string;
  };
  readonly summary: {
    readonly proven: number;
    readonly notProven: number;
    readonly cannotCheck: number;
    readonly total: number;
  };
  readonly promises: readonly BundlePromise[];
  /** Whether the sealed pack is offered for download. Opt-in only. */
  readonly packOffered: boolean;
}

/**
 * Values that must never appear in an observation shown to a client, even
 * though the maker legitimately sees them.
 */
const SECRET_SHAPED = [
  /\bBearer\s+\S+/i,
  /\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/, // JWT
  /\bsk-[A-Za-z0-9]{16,}\b/,
  /\b(?:api[-_]?key|access[-_]?token|password|secret)\b\s*[:=]/i,
  /\b\d{13,19}\b/, // card-shaped number
];

/** Redact anything secret-shaped, and keep observations short. */
export function sanitiseObservation(value: string): string | undefined {
  const collapsed = value.replace(/\s+/g, ' ').trim();
  if (collapsed === '') return undefined;
  for (const pattern of SECRET_SHAPED) {
    if (pattern.test(collapsed)) return undefined;
  }
  return collapsed.length > 220 ? `${collapsed.slice(0, 217)}…` : collapsed;
}

/**
 * Render an observation as something a non-technical reader gains from.
 *
 * Most of what a run records is not worth showing. A bare `true`, a lone `0`, or
 * a 200-character dump of the whole confirmation page tells a client nothing and
 * crowds out the one line that matters. So this is a filter as much as a
 * formatter: it keeps short, specific, factual readings and drops the rest.
 */
export function describeObservation(observation: Observation): BundleObservation | undefined {
  const label = observationLabel(observation);
  if (label === undefined) return undefined;

  const value = renderValue(observation.value);
  if (value === undefined) return undefined;

  return { label, value };
}

/** Values that carry no meaning for a client on their own. */
function isUninformative(value: string): boolean {
  if (/^(true|false|yes|no|none|null|undefined|0|1|-)$/i.test(value)) return true;
  // A wall of prose is a page dump, not a reading.
  if (value.length > 150 && value.split(/\s+/).length > 20) return true;
  return false;
}

function renderValue(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;

  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch {
      return isUninformative(trimmed) ? undefined : sanitiseObservation(trimmed);
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const parts: string[] = [];
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (value === null || value === '' || value === undefined) continue;
        const rendered = Array.isArray(value) ? value.join(', ') : String(value);
        if (rendered === '' || isUninformative(rendered)) continue;
        parts.push(`${humanise(key)}: ${rendered}`);
      }
      return parts.length === 0 ? undefined : sanitiseObservation(parts.join(' · '));
    }
  }

  if (isUninformative(trimmed)) return undefined;
  return sanitiseObservation(trimmed);
}

/**
 * A readable label for what was being read, from the agent's stated intent.
 * Intents that are only internal variable names are rejected outright.
 */
function observationLabel(observation: Observation): string | undefined {
  const source = observation.intent !== '' ? observation.intent : observation.key;
  const cleaned = source
    .replace(/\{\{[^}]+\}\}/g, '')
    .replace(/\bsaved? as\b.*$/i, '')
    .replace(/^(reading|read|get|getting|checking|check)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned === '') return undefined;
  // Internal identifiers leaking through as a label help nobody.
  if (/_[a-z]+_/.test(cleaned) && !cleaned.includes(' ')) return undefined;

  const sentence = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  return sentence.length > 90 ? `${sentence.slice(0, 87)}…` : sentence;
}

function humanise(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim();
}

/**
 * Describe a step for a caption a client can read.
 *
 * Kane prefixes summaries with the action kind ("select: Selecting …") and
 * assertion steps restate the machine phrasing ("'X' does NOT appear
 * (forbidden-presence)"). Neither belongs in front of a client, and a caption
 * that leaks internal variable names is worse than no caption at all.
 */
export function captionForStep(summary: string): string | undefined {
  let text = summary.replace(/^[a-z_]+:\s*/i, '');

  // Machine assertion phrasing, rewritten or dropped. Kane truncates step
  // summaries, so the closing quote and the "(forbidden-presence)" suffix are
  // often missing and cannot be relied on.
  const forbidden = /^'(.+?)'\s+does NOT? ?a?p?p?e?a?r?/i.exec(text);
  if (forbidden?.[1] !== undefined) {
    text = `Checking that ${forbidden[1]} is absent`;
  } else if (/^'[^']*$/.test(text) || /\bdoes NO$/i.test(text)) {
    // A truncated assertion summary with nothing recoverable.
    return undefined;
  }
  text = text.replace(/\s*\(forbidden[-\s]presence\)?.*$/i, '');
  text = text.replace(/\s*—\s*the stated promise:.*$/i, '');

  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed === '') return undefined;

  // Internal variable names must never reach a client-facing caption.
  if (/\b[a-z]+_[a-z]+(_[a-z]+)*\b/.test(collapsed)) return undefined;

  const sentence = collapsed.charAt(0).toUpperCase() + collapsed.slice(1);
  return sentence.length > 110 ? `${sentence.slice(0, 107)}…` : sentence;
}

export interface ProjectOptions {
  readonly slug: string;
  readonly title: string;
  readonly client: string;
  readonly milestone: number;
  readonly offerPack: boolean;
}

/**
 * Build the bundle, plus the list of pack entries that must be copied as media.
 */
export function project(
  pack: EvidencePack,
  promises: readonly DeliveryPromise[],
  options: ProjectOptions,
): { bundle: HandoverBundle; media: readonly { packPath: string; file: string }[] } {
  const media: { packPath: string; file: string }[] = [];
  const seen = new Set<string>();

  /**
   * Which test slugs carry evidence for a promise.
   *
   * Packs do not always record `assurance_id` on every test — observed in a real
   * run where one of five tests had none. When the link cannot be resolved, tests
   * without an id are included rather than excluded: hiding the evidence for the
   * one promise that failed would be the worst possible failure mode, and it is
   * exactly what happened before this fallback existed.
   */
  const slugsFor = (testIds: readonly string[]): ReadonlySet<string> => {
    const matched = pack.tests.filter(
      (t) => t.assuranceId !== undefined && testIds.includes(t.assuranceId),
    );
    if (matched.length > 0) return new Set(matched.map((t) => t.slug));
    return new Set(pack.tests.filter((t) => t.assuranceId === undefined).map((t) => t.slug));
  };

  const bundlePromises: BundlePromise[] = promises.map((promise) => {
    const slugs = slugsFor(promise.testIds);

    const observed: BundleObservation[] = [];
    for (const observation of pack.observations) {
      if (!slugs.has(observation.testSlug)) continue;
      const described = describeObservation(observation);
      if (described === undefined) continue;
      if (observed.some((o) => o.value === described.value)) continue;
      observed.push(described);
    }

    // Screenshots: the decisive ones only. A failing promise shows where it
    // went wrong; a proven one shows that it happened.
    const shots: BundleMedia[] = [];
    for (const test of pack.tests) {
      if (!slugs.has(test.slug)) continue;
      const interesting = test.steps.filter(
        (step) =>
          step.screenshot !== undefined &&
          (step.status === 'failed' || step.kind === 'assert' || step.kind === 'select'),
      );
      for (const step of interesting.slice(0, 3)) {
        if (step.screenshot === undefined) continue;
        const caption = captionForStep(step.summary);
        if (caption === undefined) continue;

        const file = `${test.slug}-${step.id}.jpg`.replace(/[^A-Za-z0-9._-]/g, '-');
        if (!seen.has(file)) {
          seen.add(file);
          media.push({ packPath: step.screenshot, file });
        }
        shots.push({ file, caption });
      }
    }

    return {
      id: promise.id,
      text: promise.text,
      state: promise.state ?? 'cannot_check',
      ...(promise.why === undefined ? {} : { why: promise.why }),
      ...(promise.quote === undefined ? {} : { quote: promise.quote }),
      groupTitle: promise.useCaseTitle,
      strength: promise.strength,
      observed: observed.slice(0, 6),
      media: shots,
    };
  });

  const summary = {
    proven: bundlePromises.filter((p) => p.state === 'proven').length,
    notProven: bundlePromises.filter((p) => p.state === 'not_proven').length,
    cannotCheck: bundlePromises.filter((p) => p.state === 'cannot_check').length,
    total: bundlePromises.length,
  };

  return {
    bundle: {
      version: BUNDLE_VERSION,
      slug: options.slug,
      title: options.title,
      client: options.client,
      milestone: options.milestone,
      createdAt: new Date().toISOString(),
      run: {
        id: pack.run.runId,
        ...(pack.run.started === undefined ? {} : { startedAt: pack.run.started }),
        ...(pack.run.ended === undefined ? {} : { endedAt: pack.run.ended }),
        browser: 'Chrome',
        producer: pack.run.producer,
      },
      summary,
      promises: bundlePromises,
      packOffered: options.offerPack,
    },
    media,
  };
}
