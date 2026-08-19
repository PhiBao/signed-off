/**
 * Kane CLI NDJSON event model.
 *
 * Kane emits one JSON object per line on stdout under `--agent` / `--mode agent`.
 * Progress UI goes to stderr and is ignored.
 *
 * Two event families, and telling them apart matters:
 *
 *   1. TYPED events carry a `type` field (`run_end`, `commit`, `usage`, `done`, ...).
 *   2. UNTYPED progress events have NO `type` — they carry `step` / `status` / `remark`.
 *
 * Kane's own guidance: build automation on the terminal events only, because they
 * are the only ones with a schema stable across versions. Progress events are for
 * live display. We follow that rule strictly — see `isTerminal`.
 *
 * Everything here is parsed defensively. Kane output is treated as untrusted
 * input: unknown shapes degrade to `UnknownEvent` rather than throwing, so a
 * Kane upgrade cannot crash a maker mid-milestone.
 */

/** Verbs Kane reports against. */
export type KaneVerb = 'extract' | 'design' | 'testrun' | 'cover' | 'review' | 'run';

/** A single agent step, from the untyped progress family. */
export interface ProgressEvent {
  readonly kind: 'progress';
  readonly step: number;
  readonly status: 'passed' | 'failed';
  readonly remark: string;
}

/** Terminal event for `kane-cli run` / `testmd run`. */
export interface RunEndEvent {
  readonly kind: 'run_end';
  readonly status: 'passed' | 'failed';
  readonly summary?: string;
  readonly oneLiner?: string;
  readonly reason?: string;
  readonly duration?: number;
  readonly credits?: number;
  readonly finalState: Readonly<Record<string, unknown>>;
  readonly sessionDir?: string;
  readonly runDir?: string;
  readonly testUrl?: string;
}

/** Terminal event for the assurance verbs (`extract`, `design`, ...). */
export interface DoneEvent {
  readonly kind: 'done';
  readonly verb: string;
  readonly status: string;
  readonly exitCode: number;
}

/** A commit landed in the assurance graph. */
export interface CommitEvent {
  readonly kind: 'commit';
  readonly verb: string;
  readonly acs: number;
  readonly scenarios: number;
  readonly tests: number;
  readonly gaps: number;
  readonly minted: readonly { readonly logicalId: string; readonly cid: string }[];
}

/**
 * A design/extract receipt. Carries the warnings we care most about — notably
 * "verifies N ACs but machine-asserts only 1", which is how Kane admits a test
 * only narratively covers a promise. We surface these rather than swallow them.
 */
export interface ReceiptEvent {
  readonly kind: 'receipt';
  readonly verb: string;
  readonly phase: string;
  readonly warnings: readonly string[];
  readonly next?: string;
}

/** Credit consumption, accumulated across a session. */
export interface UsageEvent {
  readonly kind: 'usage';
  readonly verb: string;
  readonly credits: number;
  readonly totalCredits: number;
}

/** Human-facing activity label, for live narration only. */
export interface ActivityEvent {
  readonly kind: 'activity';
  readonly verb: string;
  readonly label: string;
}

export interface ErrorEvent {
  readonly kind: 'error';
  readonly message: string;
}

/** Anything we do not recognise. Retained so callers can log it, never thrown. */
export interface UnknownEvent {
  readonly kind: 'unknown';
  readonly raw: Readonly<Record<string, unknown>>;
}

export type KaneEvent =
  | ProgressEvent
  | RunEndEvent
  | DoneEvent
  | CommitEvent
  | ReceiptEvent
  | UsageEvent
  | ActivityEvent
  | ErrorEvent
  | UnknownEvent;

/** Terminal events are the only safe basis for automation decisions. */
export function isTerminal(e: KaneEvent): e is RunEndEvent | DoneEvent {
  return e.kind === 'run_end' || e.kind === 'done';
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function strArray(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function mintedArray(v: unknown): readonly { logicalId: string; cid: string }[] {
  if (!Array.isArray(v)) return [];
  const out: { logicalId: string; cid: string }[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    const logicalId = str(item['logical_id']);
    const cid = str(item['cid']);
    if (logicalId !== undefined && cid !== undefined) out.push({ logicalId, cid });
  }
  return out;
}

/**
 * Parse one NDJSON line into a `KaneEvent`.
 *
 * Returns `undefined` for blank lines and for lines that are not JSON at all —
 * Kane occasionally interleaves plain notices such as the skill-update banner.
 */
export function parseKaneLine(line: string): KaneEvent | undefined {
  const trimmed = line.trim();
  if (trimmed === '' || !trimmed.startsWith('{')) return undefined;

  let raw: unknown;
  try {
    raw = JSON.parse(trimmed);
  } catch {
    return undefined;
  }
  if (!isRecord(raw)) return undefined;

  const type = str(raw['type']);

  // Untyped progress family: no `type`, but has `step`.
  if (type === undefined) {
    const step = num(raw['step']);
    if (step === undefined) return { kind: 'unknown', raw };
    const status = raw['status'] === 'failed' ? 'failed' : 'passed';
    return { kind: 'progress', step, status, remark: str(raw['remark']) ?? '' };
  }

  switch (type) {
    case 'run_end': {
      const finalState = isRecord(raw['final_state']) ? raw['final_state'] : {};
      return {
        kind: 'run_end',
        status: raw['status'] === 'failed' ? 'failed' : 'passed',
        ...optional('summary', str(raw['summary'])),
        ...optional('oneLiner', str(raw['one_liner'])),
        ...optional('reason', str(raw['reason'])),
        ...optional('duration', num(raw['duration'])),
        ...optional('credits', num(raw['credits'])),
        finalState,
        ...optional('sessionDir', str(raw['session_dir'])),
        ...optional('runDir', str(raw['run_dir'])),
        ...optional('testUrl', str(raw['test_url'])),
      };
    }

    case 'done':
      return {
        kind: 'done',
        verb: str(raw['verb']) ?? '',
        status: str(raw['status']) ?? '',
        exitCode: num(raw['exit_code']) ?? 0,
      };

    case 'commit':
      return {
        kind: 'commit',
        verb: str(raw['verb']) ?? '',
        acs: num(raw['acs']) ?? 0,
        scenarios: num(raw['scenarios']) ?? 0,
        tests: num(raw['tests']) ?? 0,
        gaps: num(raw['gaps']) ?? 0,
        minted: mintedArray(raw['minted']),
      };

    case 'receipt':
      return {
        kind: 'receipt',
        verb: str(raw['verb']) ?? '',
        phase: str(raw['phase']) ?? '',
        warnings: strArray(raw['warnings']),
        ...optional('next', str(raw['next'])),
      };

    case 'usage':
      return {
        kind: 'usage',
        verb: str(raw['verb']) ?? '',
        credits: num(raw['credits']) ?? 0,
        totalCredits: num(raw['total_credits']) ?? 0,
      };

    case 'agent_activity':
      return {
        kind: 'activity',
        verb: str(raw['verb']) ?? '',
        label: str(raw['label']) ?? '',
      };

    case 'error':
      return { kind: 'error', message: str(raw['message']) ?? 'unknown error' };

    default:
      return { kind: 'unknown', raw };
  }
}

/**
 * Build a single-key object only when the value is defined.
 * Needed because `exactOptionalPropertyTypes` forbids assigning `undefined`
 * to an optional property.
 */
function optional<K extends string, V>(key: K, value: V | undefined): Record<K, V> | Record<string, never> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}
