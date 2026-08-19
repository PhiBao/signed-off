import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { type KaneEvent, parseKaneLine } from './events.ts';

/**
 * Kane exit codes, from the CLI's documented contract.
 *
 * The distinction between 1 and 2/3 is load-bearing for Signed Off: exit 1 means
 * the app under test genuinely failed a promise, while 2 and 3 mean *we could not
 * tell*. Collapsing those into a single "failed" would let a flaky run or an
 * expired token masquerade as broken client work — the one mistake that would
 * destroy the credibility of a handover page.
 */
export const KaneExit = {
  Passed: 0,
  Failed: 1,
  /** Auth, setup or infrastructure problem. Not evidence about the app. */
  Error: 2,
  /** Timed out or cancelled. Not evidence about the app. */
  Timeout: 3,
} as const;

export type KaneExitCode = (typeof KaneExit)[keyof typeof KaneExit];

/** Did this exit code tell us something trustworthy about the app itself? */
export function isVerdict(code: number): boolean {
  return code === KaneExit.Passed || code === KaneExit.Failed;
}

export interface KaneResult {
  readonly exitCode: number;
  readonly events: readonly KaneEvent[];
  /** Credits consumed, taken from the highest `total_credits` seen. */
  readonly creditsUsed: number;
  /** Warnings gathered from every receipt, in order. */
  readonly warnings: readonly string[];
  /** stderr, kept for diagnostics only. Never shown to a client. */
  readonly stderr: string;
  /**
   * Raw stdout text, bounded. Needed for the handful of commands that render
   * prose rather than NDJSON (`whoami`, `balance`). Diagnostics only.
   */
  readonly stdout: string;
}

export interface KaneOptions {
  readonly cwd: string;
  /** Called for each parsed event, for live narration. */
  readonly onEvent?: (event: KaneEvent) => void;
  /** Hard ceiling in milliseconds. Defaults to 20 minutes. */
  readonly timeoutMs?: number;
  readonly env?: Readonly<Record<string, string>>;
}

/** Thrown when kane-cli cannot be started at all (not when it merely fails). */
export class KaneUnavailableError extends Error {
  constructor(cause: string) {
    super(
      `kane-cli could not be started: ${cause}\n` +
        `Install it with:  npm install -g @testmuai/kane-cli\n` +
        `Then sign in with:  kane-cli login`,
    );
    this.name = 'KaneUnavailableError';
  }
}

/**
 * Run kane-cli and collect its NDJSON output.
 *
 * Arguments are passed as an array and never interpolated into a shell string,
 * so scope-document content and URLs cannot inject commands.
 */
export async function runKane(args: readonly string[], options: KaneOptions): Promise<KaneResult> {
  const { cwd, onEvent, timeoutMs = 20 * 60 * 1000 } = options;

  return new Promise<KaneResult>((resolve, reject) => {
    const child = spawn('kane-cli', [...args], {
      cwd,
      // No shell: argv is passed through verbatim.
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...options.env },
    });

    const events: KaneEvent[] = [];
    const warnings: string[] = [];
    let creditsUsed = 0;
    let stderr = '';
    let stdoutText = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) child.kill('SIGTERM');
    }, timeoutMs);

    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        err.code === 'ENOENT'
          ? new KaneUnavailableError('command not found on PATH')
          : new KaneUnavailableError(err.message),
      );
    });

    const stdout = child.stdout;
    const stderrStream = child.stderr;

    if (stdout !== null) {
      const lines = createInterface({ input: stdout, crlfDelay: Infinity });
      lines.on('line', (line) => {
        if (stdoutText.length < 64 * 1024) stdoutText += `${line}\n`;

        const event = parseKaneLine(line);
        if (event === undefined) return;

        events.push(event);
        if (event.kind === 'usage') creditsUsed = Math.max(creditsUsed, event.totalCredits);
        if (event.kind === 'receipt') warnings.push(...event.warnings);
        onEvent?.(event);
      });
    }

    if (stderrStream !== null) {
      stderrStream.setEncoding('utf8');
      stderrStream.on('data', (chunk: string) => {
        // Bounded, so a chatty run cannot exhaust memory.
        if (stderr.length < 64 * 1024) stderr += chunk;
      });
    }

    child.on('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        // A killed process reports as a timeout, matching Kane's own semantics.
        exitCode: signal !== null ? KaneExit.Timeout : (code ?? KaneExit.Error),
        events,
        creditsUsed,
        warnings,
        stderr,
        stdout: stdoutText,
      });
    });
  });
}

/** Read Kane's authentication state. Returns the username when signed in. */
export async function whoami(cwd: string): Promise<{ authenticated: boolean; user?: string }> {
  const result = await runKane(['whoami'], { cwd, timeoutMs: 30_000 });
  // `whoami` renders a box rather than NDJSON, so match on its rendered text.
  const text = `${result.stdout}\n${result.stderr}`;
  if (result.exitCode !== 0 || /Not logged in/i.test(text)) return { authenticated: false };
  const match = /User\s+(\S+)/.exec(text);
  return match?.[1] === undefined ? { authenticated: true } : { authenticated: true, user: match[1] };
}
