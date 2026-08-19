import AdmZip from 'adm-zip';
import { parse as parseYaml } from 'yaml';

/**
 * Reader for a sealed Kane evidence pack (`.evidence`, a zip).
 *
 * The pack is self-contained, which is what makes it usable as a handover
 * artifact: it carries the test definitions, the per-criterion coverage, the
 * client's own source document, per-step screenshots, and the values the run
 * actually observed. Nothing here needs the maker's `.context/` store, so a
 * pack can be read by anyone the maker sends it to.
 *
 * Layout (evidence schema 0.1):
 *
 *   run.yaml                                 run id, title, totals, producer
 *   failure.yaml                             failure roll-up
 *   coverage/usecases.yaml                   use-cases -> scenarios -> criteria
 *   coverage/sources/<id>                    the source document, verbatim
 *   tests/<slug>/result.yaml                 per-test verdict + definition hash
 *   tests/<slug>/test.md                     the test as run
 *   tests/<slug>/steps/<n>-<id>/step.json    per-step kind, status, summary
 *   tests/<slug>/steps/<n>-<id>/screenshot.jpg
 *   tests/<slug>/logs/<n>-actions.ndjson     agent actions + extracted values
 *   tests/<slug>/logs/<n>-console.ndjson     console output
 *   tests/<slug>/logs/<n>-network.har        network trace
 *
 * SECURITY: `result.yaml` carries `external_id.user_email` and a live
 * `sharable_link`, and the HAR files carry request headers. None of that may
 * reach a client-facing page. See `projection.ts`, which allowlists fields
 * rather than filtering them out.
 */

export interface PackRun {
  readonly runId: string;
  readonly title: string;
  readonly status: string;
  readonly started?: string;
  readonly ended?: string;
  readonly producer: string;
  readonly totals: {
    readonly tests: number;
    readonly passed: number;
    readonly failed: number;
    readonly broken: number;
    readonly skipped: number;
  };
}

/** A criterion as recorded inside the pack's coverage projection. */
export interface PackCriterion {
  readonly id: string;
  readonly text: string;
  readonly risk: string;
  /** `passed`, `failed`, `not-run`, ... as recorded by Kane. */
  readonly execution: string;
  readonly coveredBy: readonly string[];
  readonly kind: string;
  readonly operator?: string;
  readonly operand?: string;
  readonly useCaseId: string;
  readonly useCaseTitle: string;
  /** e.g. `scope#L21-L22` — where in the client's document this came from. */
  readonly derivedFrom?: string;
}

export interface PackUseCase {
  readonly id: string;
  readonly title: string;
  readonly value: string;
  readonly risk: string;
  readonly derivedFrom?: string;
}

/** One value the run actually observed and recorded. */
export interface Observation {
  readonly testSlug: string;
  /** Extraction key, e.g. `answer_calendar_state`. */
  readonly key: string;
  /** What the agent said it was reading. */
  readonly intent: string;
  readonly value: string;
  readonly status: string;
}

export interface PackStep {
  readonly testSlug: string;
  readonly id: string;
  readonly ordinal: number;
  readonly kind: string;
  readonly status: string;
  readonly summary: string;
  readonly url?: string;
  /** Path inside the pack, when a screenshot was captured. */
  readonly screenshot?: string;
}

export interface PackTest {
  readonly slug: string;
  readonly assuranceId?: string;
  readonly status: string;
  readonly durationMs: number;
  readonly definitionSha256?: string;
  readonly steps: readonly PackStep[];
}

export interface EvidencePack {
  readonly run: PackRun;
  readonly useCases: readonly PackUseCase[];
  readonly criteria: readonly PackCriterion[];
  readonly tests: readonly PackTest[];
  readonly observations: readonly Observation[];
  /** Source documents embedded in the pack, keyed by source id. */
  readonly sources: ReadonlyMap<string, string>;
  /** Read a binary entry (screenshots), for the publish step. */
  readEntry: (path: string) => Buffer | undefined;
}

export class PackReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackReadError';
  }
}

// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function strList(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

export function readPack(packPath: string): EvidencePack {
  let zip: AdmZip;
  try {
    zip = new AdmZip(packPath);
  } catch (error) {
    throw new PackReadError(
      `Could not open evidence pack ${packPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  const entries = new Map<string, AdmZip.IZipEntry>();
  for (const entry of zip.getEntries()) entries.set(entry.entryName, entry);

  const text = (path: string): string | undefined => {
    const entry = entries.get(path);
    return entry === undefined ? undefined : entry.getData().toString('utf8');
  };

  const yaml = (path: string): unknown => {
    const raw = text(path);
    if (raw === undefined) return undefined;
    try {
      return parseYaml(raw) as unknown;
    } catch {
      return undefined;
    }
  };

  // ---- run.yaml ----------------------------------------------------------
  const runRaw = yaml('run.yaml');
  if (!isRecord(runRaw)) throw new PackReadError('evidence pack has no readable run.yaml');
  const env = isRecord(runRaw['environment']) ? runRaw['environment'] : {};
  const producer = isRecord(env['producer']) ? env['producer'] : {};
  const totals = isRecord(runRaw['totals']) ? runRaw['totals'] : {};

  const run: PackRun = {
    runId: str(runRaw['run_id']),
    title: str(runRaw['title']),
    status: str(runRaw['status']),
    ...(typeof runRaw['started'] === 'string' ? { started: runRaw['started'] } : {}),
    ...(typeof runRaw['ended'] === 'string' ? { ended: runRaw['ended'] } : {}),
    producer: `${str(producer['name'], 'kane-cli')} ${str(producer['version'])}`.trim(),
    totals: {
      tests: num(totals['tests']),
      passed: num(totals['passed']),
      failed: num(totals['failed']),
      broken: num(totals['broken']),
      skipped: num(totals['skipped']),
    },
  };

  // ---- coverage/usecases.yaml --------------------------------------------
  const useCases: PackUseCase[] = [];
  const criteria: PackCriterion[] = [];
  const coverage = yaml('coverage/usecases.yaml');

  if (isRecord(coverage) && Array.isArray(coverage['usecases'])) {
    for (const raw of coverage['usecases']) {
      if (!isRecord(raw)) continue;
      const ucId = str(raw['id']);
      const ucTitle = str(raw['title']);
      const provenance = isRecord(raw['provenance']) ? raw['provenance'] : {};
      const derivedFrom = typeof provenance['derived_from'] === 'string'
        ? provenance['derived_from']
        : undefined;

      useCases.push({
        id: ucId,
        title: ucTitle,
        value: str(raw['value']),
        risk: str(raw['risk'], 'med'),
        ...(derivedFrom === undefined ? {} : { derivedFrom }),
      });

      const acs = Array.isArray(raw['acceptance_criteria']) ? raw['acceptance_criteria'] : [];
      for (const acRaw of acs) {
        if (!isRecord(acRaw)) continue;
        const expected = isRecord(acRaw['expected_answer']) ? acRaw['expected_answer'] : {};
        criteria.push({
          id: str(acRaw['id']),
          text: str(acRaw['text']),
          risk: str(acRaw['risk'], 'med'),
          execution: str(acRaw['execution'], 'not-run'),
          coveredBy: strList(acRaw['covered_by']),
          kind: str(expected['kind'], 'presence'),
          ...(typeof expected['operator'] === 'string' ? { operator: expected['operator'] } : {}),
          ...(typeof expected['operand'] === 'string' ? { operand: expected['operand'] } : {}),
          useCaseId: ucId,
          useCaseTitle: ucTitle,
          ...(derivedFrom === undefined ? {} : { derivedFrom }),
        });
      }
    }
  }

  // ---- embedded source documents ----------------------------------------
  const sources = new Map<string, string>();
  for (const name of entries.keys()) {
    if (!name.startsWith('coverage/sources/') || name.endsWith('/')) continue;
    const id = name.slice('coverage/sources/'.length);
    const body = text(name);
    if (id !== '' && body !== undefined) sources.set(id, body);
  }

  // ---- per-test results, steps and observations --------------------------
  const testSlugs = new Set<string>();
  for (const name of entries.keys()) {
    const match = /^tests\/([^/]+)\//.exec(name);
    if (match?.[1] !== undefined) testSlugs.add(match[1]);
  }

  const tests: PackTest[] = [];
  const observations: Observation[] = [];

  for (const slug of [...testSlugs].sort()) {
    const resultRaw = yaml(`tests/${slug}/result.yaml`);
    const result = isRecord(resultRaw) ? resultRaw : {};
    const definition = isRecord(result['definition']) ? result['definition'] : {};

    // Steps: read step.json bodies and attach any screenshot beside them.
    const steps: PackStep[] = [];
    for (const name of entries.keys()) {
      const match = new RegExp(`^tests/${escapeRegExp(slug)}/steps/([^/]+)/step\\.json$`).exec(name);
      if (match?.[1] === undefined) continue;

      const body = text(name);
      if (body === undefined) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(body) as unknown;
      } catch {
        continue;
      }
      if (!isRecord(parsed)) continue;

      const dir = `tests/${slug}/steps/${match[1]}`;
      const shot = ['screenshot.jpg', 'screenshot.png', 'screenshot.jpeg']
        .map((f) => `${dir}/${f}`)
        .find((p) => entries.has(p));

      steps.push({
        testSlug: slug,
        id: str(parsed['id'], match[1]),
        ordinal: num(parsed['ordinal']),
        kind: str(parsed['kind']),
        status: str(parsed['status']),
        summary: str(parsed['summary']),
        ...(typeof parsed['url'] === 'string' ? { url: parsed['url'] } : {}),
        ...(shot === undefined ? {} : { screenshot: shot }),
      });
    }
    steps.sort((a, b) => a.ordinal - b.ordinal);

    tests.push({
      slug,
      ...(typeof result['assurance_id'] === 'string' ? { assuranceId: result['assurance_id'] } : {}),
      status: str(result['status'], 'unknown'),
      durationMs: num(result['duration_ms']),
      ...(typeof definition['sha256'] === 'string'
        ? { definitionSha256: definition['sha256'] }
        : {}),
      steps,
    });

    // Observations: what the run actually read off the page.
    for (const name of entries.keys()) {
      if (!new RegExp(`^tests/${escapeRegExp(slug)}/logs/\\d+-actions\\.ndjson$`).test(name)) continue;
      const body = text(name);
      if (body === undefined) continue;

      for (const line of body.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '' || !trimmed.startsWith('{')) continue;
        let action: unknown;
        try {
          action = JSON.parse(trimmed) as unknown;
        } catch {
          continue;
        }
        if (!isRecord(action)) continue;

        const value = action['output_value'];
        if (typeof value !== 'string' || value === '') continue;

        const params = isRecord(action['action_params']) ? action['action_params'] : {};
        observations.push({
          testSlug: slug,
          key: str(action['output_variable']) || str(params['key']),
          intent: str(action['intent']) || str(action['action_instruction']),
          value,
          status: str(action['status']),
        });
      }
    }
  }

  return {
    run,
    useCases,
    criteria,
    tests,
    observations,
    sources,
    readEntry: (path: string) => entries.get(path)?.getData(),
  };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
