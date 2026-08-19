import { readFile } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import pc from 'picocolors';
import { buildInventory } from '../domain/promise.ts';
import { type Project, toSlug, writeProject } from '../domain/project.ts';
import { balance, contextApprove, contextIngest, designTests } from '../kane/api.ts';
import { loadGraph } from '../kane/graph.ts';
import { whoami } from '../kane/proc.ts';
import * as ui from '../ui/render.ts';

/**
 * `signedoff init <document>`
 *
 * Reads the scope the client signed and turns it into a promise inventory:
 * what was promised, what can be proven, what cannot, and what the document
 * never actually settled.
 *
 * This is the maker's first-light moment and it must work without a deployed
 * app, without a client, and without any configuration. It costs credits
 * (roughly 15 to extract plus 40 per use-case designed), so the estimate is
 * shown up front and the balance is checked before starting.
 */

export interface InitOptions {
  readonly cwd: string;
  readonly document: string;
  readonly client?: string;
  readonly title?: string;
  /** Cap on scenario+test pairs per use-case. */
  readonly max: number;
  /** Stop after extraction, before designing tests. Cheap dry look. */
  readonly skipDesign: boolean;
  readonly json: boolean;
}

const CREDITS_PER_EXTRACT = 15;
const CREDITS_PER_DESIGN = 45;

export async function init(options: InitOptions): Promise<number> {
  const { cwd, json } = options;
  const documentPath = resolve(cwd, options.document);

  let documentText: string;
  try {
    documentText = await readFile(documentPath, 'utf8');
  } catch {
    ui.fail(`Cannot read ${options.document}`);
    return 2;
  }

  const auth = await whoami(cwd);
  if (!auth.authenticated) {
    ui.fail('Kane is not signed in.');
    ui.info(pc.dim('  Run:  kane-cli login'));
    return 2;
  }

  if (!json) {
    ui.info(ui.heading(`Reading ${basename(documentPath)}`));
    ui.info(pc.dim(`  Signed in as ${auth.user ?? 'unknown'}`));
  }

  // ---- Extract use-cases -------------------------------------------------
  const extract = await contextIngest(relative(cwd, documentPath), {
    cwd,
    onEvent: (e) => {
      if (json) return;
      if (e.kind === 'activity') ui.progress(e.label.replace(/^[→✓]\s*/, ''));
      if (e.kind === 'commit') {
        ui.clearProgress();
        ui.info(pc.dim(`  found ${e.minted.length} use-cases`));
      }
    },
  });
  ui.clearProgress();

  if (extract.exitCode !== 0) {
    ui.fail('Could not read the document into an assurance graph.');
    if (extract.stderr.trim() !== '') ui.info(pc.dim(`  ${extract.stderr.trim().split('\n')[0]}`));
    return 2;
  }

  let graph = await loadGraph(cwd);
  if (graph.useCases.length === 0) {
    ui.fail('No use-cases could be extracted from that document.');
    ui.info(pc.dim('  The document may be too short, or may not describe user-facing behaviour.'));
    return 1;
  }

  // ---- Approve use-cases -------------------------------------------------
  // The maker has read and signed this document; treating its use-cases as
  // trusted is a fair reading of that. Gaps are never auto-resolved.
  const unapproved = graph.useCases.filter((uc) => uc.trust !== 'trusted').map((uc) => uc.id);
  if (unapproved.length > 0) {
    const approve = await contextApprove(unapproved, { cwd });
    if (approve.exitCode !== 0) {
      ui.warn('Could not approve every use-case; continuing with what is trusted.');
    }
    graph = await loadGraph(cwd);
  }

  // ---- Design assurance --------------------------------------------------
  const warnings: string[] = [...extract.warnings];

  if (!options.skipDesign) {
    const toDesign = graph.useCases.filter((uc) => !hasDesign(graph, uc.id));
    const estimate = CREDITS_PER_EXTRACT + toDesign.length * CREDITS_PER_DESIGN;
    const available = await balance(cwd);

    if (available !== undefined && available < estimate) {
      ui.fail(
        `Not enough credits: about ${estimate} needed, ${Math.floor(available)} available.`,
      );
      ui.info(pc.dim('  Top up, or run with --skip-design to see the use-cases only.'));
      return 2;
    }

    if (!json && toDesign.length > 0) {
      ui.info(
        pc.dim(
          `  designing assurance for ${toDesign.length} use-case${toDesign.length === 1 ? '' : 's'} ` +
            `(about ${estimate} credits)`,
        ),
      );
    }

    for (const [i, uc] of toDesign.entries()) {
      const label = `${i + 1}/${toDesign.length} ${uc.title}`;
      const result = await designTests(uc.id, options.max, {
        cwd,
        onEvent: (e) => {
          if (json) return;
          if (e.kind === 'activity') ui.progress(`${label} — ${e.label.replace(/^[→✓]\s*/, '')}`);
        },
      });
      ui.clearProgress();
      warnings.push(...result.warnings);

      if (result.exitCode !== 0) {
        ui.warn(`Could not design assurance for "${uc.title}". Continuing.`);
      }
    }

    graph = await loadGraph(cwd);
  }

  // ---- Build and persist -------------------------------------------------
  const inventory = buildInventory(graph, documentText, warnings);

  const title = options.title ?? deriveTitle(documentText, basename(documentPath));
  const project: Project = {
    version: 1,
    slug: toSlug(title),
    title,
    client: options.client ?? '',
    sourceDocument: relative(cwd, documentPath),
    createdAt: new Date().toISOString(),
    milestones: [],
  };
  await writeProject(cwd, project);

  if (json) {
    process.stdout.write(`${JSON.stringify({ project, inventory }, null, 2)}\n`);
    return 0;
  }

  // With design skipped there are no promises yet — show what the document
  // describes rather than an empty inventory.
  if (inventory.counts.total === 0) {
    process.stdout.write(`${ui.renderUseCases(graph.useCases)}\n`);
    return 0;
  }

  process.stdout.write(`${ui.renderInventory(inventory)}\n`);

  ui.info(ui.heading('Next'));
  if (inventory.openQuestions.length > 0) {
    ui.info(pc.dim('  1. signedoff questions --send      get the open questions answered'));
    ui.info(pc.dim('  2. signedoff verify --url <url>    check the promises against your build'));
  } else {
    ui.info(pc.dim('  signedoff verify --url <url>       check the promises against your build'));
  }

  return 0;
}

/** Has this use-case already been designed? Avoids paying twice on re-run. */
function hasDesign(graph: Awaited<ReturnType<typeof loadGraph>>, useCaseId: string): boolean {
  for (const [acId, ucId] of graph.acToUseCase) {
    if (ucId === useCaseId && graph.acs.some((ac) => ac.id === acId)) return true;
  }
  return false;
}

/** Use the document's first heading as the project title when there is one. */
function deriveTitle(documentText: string, fallback: string): string {
  const match = /^#\s+(.+)$/m.exec(documentText);
  const heading = match?.[1]?.trim();
  if (heading === undefined || heading === '') return fallback.replace(/\.[^.]+$/, '');
  return heading.replace(/^Statement of Work\s*[—-]\s*/i, '').trim();
}
