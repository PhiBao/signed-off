import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import pc from 'picocolors';
import { buildInventory } from '../domain/promise.ts';
import { summarise } from '../domain/promise.ts';
import { readProject, writeProject } from '../domain/project.ts';
import { verdictsFromPack } from '../domain/verdict.ts';
import { evidenceValidate, testrun } from '../kane/api.ts';
import { loadGraph } from '../kane/graph.ts';
import { readPack } from '../kane/pack.ts';
import { isVerdict, KaneExit } from '../kane/proc.ts';
import * as ui from '../ui/render.ts';

/**
 * `signedoff verify --url <url>`
 *
 * Runs the designed suite against a real build and reports every promise the
 * client made in their own words. Produces one sealed evidence pack, which is
 * the artifact the client will later be shown.
 *
 * Runs are cheap to repeat: Kane replays passed steps from cache with no model
 * cost, so re-verifying a milestone after a fix costs close to nothing.
 */

export interface VerifyOptions {
  readonly cwd: string;
  readonly url: string;
  readonly milestone: number;
  readonly headless: boolean;
  readonly json: boolean;
}

/**
 * Kane settings that determine whether proof is trustworthy.
 *
 * Signed Off owns these rather than inheriting whatever the maker's machine has,
 * because a handover page's credibility depends on them. `visual` assertions
 * check what a person can see; `dom` assertions read element properties, which
 * is how a selected "Sunday 23 August" can hide behind the value "2026-08-23".
 */
const REQUIRED_KANE_CONFIG: readonly (readonly [string, string])[] = [
  ['set-assertion-mode', 'visual'],
  ['set-bug-detection', 'continue'],
  ['set-final-validation', 'on'],
];

export async function verify(options: VerifyOptions): Promise<number> {
  const { cwd, json } = options;
  const project = await readProject(cwd);
  const graph = await loadGraph(cwd);

  const testIds = graph.tests.map((t) => t.id);
  if (testIds.length === 0) {
    ui.fail('No tests have been designed yet.');
    ui.info(pc.dim(`  Run:  signedoff init ${project.sourceDocument}`));
    return 2;
  }

  // ---- supply the values the suite needs ---------------------------------
  const missing = await writeVariables(cwd, options.url);
  if (missing.length > 0 && !json) {
    ui.warn(
      `No answer for ${missing.join(', ')} — the run may stall. ` +
        `Add them to .signedoff/answers.json`,
    );
  }

  if (!json) {
    ui.info(ui.heading(`Checking ${testIds.length} tests against ${options.url}`));
    ui.info(pc.dim('  assertions read what a person can see'));
  }

  // ---- run --------------------------------------------------------------
  const run = await testrun(testIds, {
    cwd,
    headless: options.headless,
    onEvent: (event) => {
      if (json) return;
      if (event.kind === 'activity') ui.progress(event.label.replace(/^[→✓]\s*/, ''));
      if (event.kind === 'progress') ui.progress(`step ${event.step}: ${event.remark}`);
    },
    timeoutMs: 60 * 60 * 1000,
  });
  ui.clearProgress();

  // Exit 2 and 3 say nothing about the client's app — never report them as
  // failures of the work.
  if (!isVerdict(run.exitCode)) {
    ui.fail(
      run.exitCode === KaneExit.Timeout
        ? 'The check timed out before it could finish. Nothing about your build has been judged.'
        : 'The check could not run (setup, auth or browser problem). Nothing has been judged.',
    );
    const firstLine = run.stderr.trim().split('\n').find((l) => l.trim() !== '');
    if (firstLine !== undefined) ui.info(pc.dim(`  ${firstLine}`));
    return 2;
  }

  // ---- locate and validate the pack --------------------------------------
  const packPath = await newestPack(cwd);
  if (packPath === undefined) {
    ui.fail('The run finished but produced no evidence pack.');
    return 2;
  }

  const validation = await evidenceValidate(packPath, { cwd });
  const valid = /"valid"\s*:\s*true/.test(validation.stdout);
  if (!valid) {
    ui.fail('The evidence pack did not validate, so it will not be published.');
    ui.info(pc.dim(`  ${validation.stdout.trim().slice(0, 300)}`));
    return 2;
  }

  // ---- turn evidence into promises ---------------------------------------
  const documentText = await readFile(join(cwd, project.sourceDocument), 'utf8').catch(() => '');
  const inventory = buildInventory(graph, documentText, run.warnings);
  const unmeasurable = new Set(
    inventory.promises.filter((p) => p.checkability === 'unmeasurable').map((p) => p.id),
  );

  const pack = readPack(packPath);
  const promises = verdictsFromPack(pack, {
    inventory: inventory.promises,
    unmeasurableIds: unmeasurable,
  });
  const summary = summarise(promises);

  // ---- record ------------------------------------------------------------
  const milestones = [
    ...project.milestones.filter((m) => m.n !== options.milestone),
    {
      n: options.milestone,
      packPath: relative(cwd, packPath),
      verifiedAt: new Date().toISOString(),
      packCid: pack.run.runId,
    },
  ].sort((a, b) => a.n - b.n);
  await writeProject(cwd, { ...project, milestones });

  if (json) {
    process.stdout.write(
      `${JSON.stringify({ summary, promises, pack: { runId: pack.run.runId, path: relative(cwd, packPath) } }, null, 2)}\n`,
    );
    return summary.notProven > 0 ? 1 : 0;
  }

  process.stdout.write(`\n${ui.renderVerdicts(promises)}\n`);
  process.stdout.write(`\n${ui.renderSummary(summary)}\n`);

  if (summary.notProven > 0) {
    ui.info(pc.dim('\n  Fix what is not proven, then run verify again — passed steps replay free.'));
    return 1;
  }

  ui.info(pc.dim(`\n  Ready to hand over:  signedoff publish --milestone ${options.milestone}`));
  return 0;
}

/**
 * Write the values the designed tests reference into Kane's project-local
 * variables directory, where Kane picks them up automatically.
 *
 * Anything the maker marks secret in `.signedoff/answers.json` is passed through
 * with `secret: true`, which masks it in logs and routes it to TestMuAI's
 * secrets store instead of being synced as a plain variable.
 */
async function writeVariables(cwd: string, url: string): Promise<readonly string[]> {
  const answers = await readAnswers(cwd);
  const referenced = await referencedVariables(cwd);

  const variables: Record<string, { value: string; secret?: boolean }> = {
    start_url: { value: url },
  };
  for (const [key, answer] of Object.entries(answers)) {
    variables[key] = answer.secret === true
      ? { value: answer.value, secret: true }
      : { value: answer.value };
  }

  const dir = join(cwd, '.testmuai', 'variables');
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, 'signedoff.json'),
    `${JSON.stringify(variables, null, 2)}\n`,
    'utf8',
  );

  return referenced.filter((name) => variables[name] === undefined);
}

interface Answer {
  readonly value: string;
  readonly secret?: boolean;
}

async function readAnswers(cwd: string): Promise<Record<string, Answer>> {
  try {
    const raw: unknown = JSON.parse(
      await readFile(join(cwd, '.signedoff', 'answers.json'), 'utf8'),
    );
    if (typeof raw !== 'object' || raw === null) return {};

    const out: Record<string, Answer> = {};
    for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof entry === 'string') out[key] = { value: entry };
      else if (typeof entry === 'object' && entry !== null) {
        const value = (entry as Record<string, unknown>)['value'];
        const secret = (entry as Record<string, unknown>)['secret'];
        if (typeof value === 'string') {
          out[key] = secret === true ? { value, secret: true } : { value };
        }
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Every `{{variable}}` the designed tests reference. */
async function referencedVariables(cwd: string): Promise<readonly string[]> {
  const dir = join(cwd, '.testmuai', 'tests');
  const found = new Set<string>();
  try {
    for (const name of await readdir(dir)) {
      if (!name.endsWith('_test.md')) continue;
      const body = await readFile(join(dir, name), 'utf8');
      for (const match of body.matchAll(/\{\{([a-z0-9_]+)\}\}/gi)) {
        if (match[1] !== undefined) found.add(match[1]);
      }
    }
  } catch {
    return [];
  }
  return [...found].sort();
}

/** The most recently written evidence pack in the project. */
async function newestPack(cwd: string): Promise<string | undefined> {
  const dir = join(cwd, '.testmuai', 'evidence');
  try {
    const names = (await readdir(dir)).filter((n) => n.endsWith('.evidence'));
    if (names.length === 0) return undefined;

    const stats = await Promise.all(
      names.map(async (name) => {
        const path = join(dir, name);
        const { stat } = await import('node:fs/promises');
        return { path, mtime: (await stat(path)).mtimeMs };
      }),
    );
    stats.sort((a, b) => b.mtime - a.mtime);
    return stats[0]?.path;
  } catch {
    return undefined;
  }
}
