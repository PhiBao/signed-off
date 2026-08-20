import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pc from 'picocolors';
import { buildInventory } from '../domain/promise.ts';
import { readProject } from '../domain/project.ts';
import { verdictsFromPack } from '../domain/verdict.ts';
import { loadGraph } from '../kane/graph.ts';
import { readPack } from '../kane/pack.ts';
import type { DeliveryPromise } from '../domain/promise.ts';
import * as ui from '../ui/render.ts';

/**
 * `signedoff brief`
 *
 * Turns the promises that are not proven into a repair brief a coding agent can
 * act on, and prints nothing else.
 *
 * This is the half of the loop that usually goes missing. An agent that runs a
 * test suite gets back "3 failed" and a stack trace, which tells it what broke
 * but not what was *supposed* to happen or why anyone cares. A brief here
 * carries four things the agent actually needs:
 *
 *   1. the promise, in the client's words — the intent, not the assertion
 *   2. the sentence in the signed document it came from
 *   3. what the browser actually observed, which is the disproof
 *   4. the fact that a human is waiting to accept or reject this
 *
 * Piping this straight into an agent is the intended use:
 *
 *   signedoff brief | claude -p
 *   signedoff brief --json | your-own-harness
 */

export interface BriefOptions {
  readonly cwd: string;
  readonly milestone: number;
  readonly json: boolean;
  /**
   * Read a specific evidence pack instead of the milestone's current one.
   * Useful for looking back at what a previous run found — the record is
   * immutable, so an earlier pack stays readable after the fix has landed.
   */
  readonly pack?: string;
}

export async function brief(options: BriefOptions): Promise<number> {
  const { cwd, json } = options;
  const project = await readProject(cwd);

  let packPath: string;
  if (options.pack !== undefined) {
    packPath = resolve(cwd, options.pack);
  } else {
    const milestone = project.milestones.find((m) => m.n === options.milestone);
    if (milestone?.packPath === undefined) {
      ui.fail(`Milestone ${options.milestone} has not been verified yet.`);
      ui.info(pc.dim('  Run:  signedoff verify --url <url>'));
      return 2;
    }
    packPath = resolve(cwd, milestone.packPath);
  }

  const pack = readPack(packPath);
  const graph = await loadGraph(cwd);
  const documentText = await readFile(join(cwd, project.sourceDocument), 'utf8').catch(() => '');
  const inventory = buildInventory(graph, documentText);
  const unmeasurable = new Set(
    inventory.promises.filter((p) => p.checkability === 'unmeasurable').map((p) => p.id),
  );

  const promises = verdictsFromPack(pack, {
    inventory: inventory.promises,
    unmeasurableIds: unmeasurable,
  });
  const broken = promises.filter((p) => p.state === 'not_proven');

  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          milestone: options.milestone,
          runId: pack.run.runId,
          notProven: broken.map((p) => briefFor(p, pack)),
        },
        null,
        2,
      )}\n`,
    );
    return broken.length > 0 ? 1 : 0;
  }

  if (broken.length === 0) {
    process.stdout.write('Every promise that can be checked is proven. Nothing to repair.\n');
    return 0;
  }

  process.stdout.write(renderBrief(broken, pack, project.client));
  return 1;
}

interface PromiseBrief {
  readonly id: string;
  readonly promise: string;
  readonly agreedInWriting?: string;
  readonly whyNotProven?: string;
  readonly observed: readonly string[];
}

function briefFor(promise: DeliveryPromise, pack: ReturnType<typeof readPack>): PromiseBrief {
  // Only the observations from the tests that cover this promise, so the agent
  // is not handed the whole run to sift through.
  const relevant = pack.tests.filter(
    (t) => t.assuranceId === undefined || promise.testIds.includes(t.assuranceId),
  );
  const slugs = new Set(relevant.map((t) => t.slug));

  const observed = pack.observations
    .filter((o) => slugs.has(o.testSlug) && o.value.trim() !== '')
    .map((o) => `${o.intent === '' ? o.key : o.intent}: ${o.value}`)
    .slice(0, 8);

  return {
    id: promise.id,
    promise: promise.text,
    ...(promise.quote === undefined ? {} : { agreedInWriting: promise.quote }),
    ...(promise.why === undefined ? {} : { whyNotProven: promise.why }),
    observed,
  };
}

/**
 * The brief as prose, because that is what a coding agent reads best.
 * Deliberately states the stakes: this is not a failing test, it is a promise
 * to a person who is deciding whether to pay.
 */
function renderBrief(
  broken: readonly DeliveryPromise[],
  pack: ReturnType<typeof readPack>,
  client: string,
): string {
  const lines: string[] = [];

  lines.push(
    `${broken.length} promise${broken.length === 1 ? '' : 's'} in the signed scope ` +
      `${broken.length === 1 ? 'is' : 'are'} not proven by the current build.`,
  );
  lines.push('');
  lines.push(
    client === ''
      ? 'The client is waiting to accept or reject this milestone.'
      : `${client} is waiting to accept or reject this milestone.`,
  );
  lines.push('');
  lines.push('Fix the product code so each promise below holds. Do not change the tests, and do');
  lines.push('not change the scope document — both are the record of what was agreed.');
  lines.push('');

  for (const [index, promise] of broken.entries()) {
    const detail = briefFor(promise, pack);
    lines.push(`## ${index + 1}. ${detail.promise}`);
    lines.push('');

    if (detail.agreedInWriting !== undefined) {
      // Kane anchors a whole use-case to a line range, so this is the section
      // of the document the promise was derived from, not necessarily the exact
      // sentence. Label it accurately rather than overclaiming.
      lines.push(`From this part of the signed scope: "${detail.agreedInWriting}"`);
      lines.push('');
    }
    if (detail.whyNotProven !== undefined) {
      lines.push(`Why it is not proven: ${detail.whyNotProven}`);
      lines.push('');
    }
    if (detail.observed.length > 0) {
      lines.push('What the browser observed:');
      for (const observation of detail.observed) lines.push(`  - ${observation}`);
      lines.push('');
    }
  }

  lines.push('When you have made the change, re-run:');
  lines.push('');
  lines.push('    signedoff verify --url <url>');
  lines.push('');
  lines.push('Steps that already passed replay from cache, so re-checking is fast and free.');
  lines.push('');

  return lines.join('\n');
}
