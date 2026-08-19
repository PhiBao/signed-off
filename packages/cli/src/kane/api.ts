import { type KaneEvent } from './events.ts';
import { type KaneResult, runKane } from './proc.ts';

/**
 * Typed wrappers for the Kane commands Signed Off uses.
 *
 * All of them run headless and non-interactive (`--mode agent` / `--agent`), so
 * the CLI never blocks waiting for a TTY. Kane refuses some flags under
 * `--mode ci`, so `agent` is the mode we standardise on.
 */

export interface KaneCall {
  readonly cwd: string;
  readonly onEvent?: (event: KaneEvent) => void;
  readonly timeoutMs?: number;
}

function call(cwd: string, opts: KaneCall): Parameters<typeof runKane>[1] {
  return {
    cwd,
    ...(opts.onEvent === undefined ? {} : { onEvent: opts.onEvent }),
    ...(opts.timeoutMs === undefined ? {} : { timeoutMs: opts.timeoutMs }),
  };
}

/**
 * Snapshot a requirements document into the local `.context/` store and extract
 * use-cases from it. Every use-case Kane derives cites the lines it came from.
 */
export function contextIngest(document: string, opts: KaneCall): Promise<KaneResult> {
  return runKane(['context', 'ingest', document, '--mode', 'agent'], call(opts.cwd, opts));
}

/**
 * Approve derived nodes so they become trusted facts.
 *
 * Approval is a human judgement in Kane's model, and rightly so. Signed Off
 * auto-approves *use-cases* on the maker's behalf because the maker has already
 * read and signed the source document — but it never auto-approves anything that
 * would suppress a gap, because gaps are the part the client needs to see.
 */
export function contextApprove(refs: readonly string[], opts: KaneCall): Promise<KaneResult> {
  return runKane(
    ['context', 'review', '--approve', ...refs, '--mode', 'agent', '--json'],
    call(opts.cwd, opts),
  );
}

export function contextList(opts: KaneCall): Promise<KaneResult> {
  return runKane(['context', 'list', '--json'], call(opts.cwd, opts));
}

/**
 * Design acceptance criteria, scenarios and one test per scenario for a
 * single use-case. This is where gaps are discovered.
 *
 * `max` caps the scenario+test pairs. Left unset, Kane estimates and asks —
 * which would hang a headless run, so we always pass a ceiling.
 */
export function designTests(
  useCase: string,
  max: number,
  opts: KaneCall,
): Promise<KaneResult> {
  return runKane(
    ['design', 'tests', '--use-case', useCase, '--mode', 'agent', '--max', String(max)],
    call(opts.cwd, opts),
  );
}

/**
 * Run selected tests as ONE execution, producing a single sealed evidence pack.
 * `--from-context` selects by assurance-graph test id, which keeps the run tied
 * to the promises rather than to file paths.
 */
export function testrun(
  testIds: readonly string[],
  opts: KaneCall & { readonly headless?: boolean; readonly parallel?: number },
): Promise<KaneResult> {
  const args = ['testrun', 'run', '--from-context', testIds.join(','), '--on-failure', 'continue'];
  if (opts.headless !== false) args.push('--headless');
  if (opts.parallel !== undefined) args.push('--parallel', String(opts.parallel));
  return runKane(args, call(opts.cwd, opts));
}

/** Two-axis coverage: what an evidence pack proved against what the graph owes. */
export function cover(opts: KaneCall & { readonly pack?: string }): Promise<KaneResult> {
  const args = ['cover', '--json', '--mode', 'agent'];
  if (opts.pack !== undefined) args.push('--from', opts.pack);
  return runKane(args, call(opts.cwd, opts));
}

export function coverGaps(useCase: string | undefined, opts: KaneCall): Promise<KaneResult> {
  const args = ['cover', 'gaps'];
  if (useCase !== undefined) args.push(useCase);
  args.push('--json');
  return runKane(args, call(opts.cwd, opts));
}

/**
 * Validate an evidence pack against the L1 profile.
 *
 * Run before anything is published. L1 checks that every step has a screenshot,
 * that video and logs are present and well-formed, that the failure index is
 * complete, that the definition hash matches, and — critically — that claimed
 * statuses agree with the captured artifacts. Publishing an invalid pack would
 * mean asking a client to trust a document our own tooling rejects.
 */
export function evidenceValidate(
  target: string,
  opts: KaneCall,
): Promise<KaneResult> {
  return runKane(
    ['evidence', 'validate', target, '--profile', 'L1', '--json'],
    call(opts.cwd, opts),
  );
}

/** Read the remaining credit balance. Renders prose, not NDJSON. */
export async function balance(cwd: string): Promise<number | undefined> {
  const result = await runKane(['balance'], { cwd, timeoutMs: 30_000 });
  const match = /Available credits:\s*([\d.]+)/.exec(`${result.stdout}\n${result.stderr}`);
  if (match?.[1] === undefined) return undefined;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : undefined;
}
