import { randomBytes, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import pc from 'picocolors';
import { buildInventory } from '../domain/promise.ts';
import { readProject, writeProject } from '../domain/project.ts';
import { verdictsFromPack } from '../domain/verdict.ts';
import { evidenceValidate } from '../kane/api.ts';
import { loadGraph } from '../kane/graph.ts';
import { readPack } from '../kane/pack.ts';
import { redactPack } from '../kane/redact.ts';
import { project as buildProjection } from '../projection.ts';
import * as ui from '../ui/render.ts';

/**
 * `signedoff publish --milestone <n>`
 *
 * Turns a verified milestone into a page the client can open, and returns the
 * link plus a PIN to share separately.
 *
 * Two rules are enforced here rather than left to the maker:
 *
 *  - The pack must validate against the L1 profile first. Asking a client to
 *    trust a document our own tooling rejects would be indefensible.
 *  - Only the allowlisted projection is written out. The pack itself carries the
 *    maker's email, a live dashboard link and full network traces, none of which
 *    may reach an unauthenticated page.
 */

export interface PublishOptions {
  readonly cwd: string;
  readonly milestone: number;
  /** Where the web app reads bundles from. */
  readonly webRoot: string;
  /** Offer the sealed pack for download alongside the page. */
  readonly includePack: boolean;
  readonly json: boolean;
  readonly baseUrl: string;
}

export async function publish(options: PublishOptions): Promise<number> {
  const { cwd, json } = options;
  const projectRecord = await readProject(cwd);

  const milestone = projectRecord.milestones.find((m) => m.n === options.milestone);
  if (milestone?.packPath === undefined) {
    ui.fail(`Milestone ${options.milestone} has not been verified yet.`);
    ui.info(pc.dim('  Run:  signedoff verify --url <url>'));
    return 2;
  }

  const packPath = resolve(cwd, milestone.packPath);

  // Never publish a pack that does not validate.
  const validation = await evidenceValidate(packPath, { cwd });
  if (!/"valid"\s*:\s*true/.test(validation.stdout)) {
    ui.fail('That evidence pack does not validate, so it will not be published.');
    ui.info(pc.dim(`  ${validation.stdout.trim().slice(0, 300)}`));
    return 2;
  }

  const pack = readPack(packPath);
  const graph = await loadGraph(cwd);
  const documentText = await readFile(join(cwd, projectRecord.sourceDocument), 'utf8').catch(() => '');
  const inventory = buildInventory(graph, documentText);
  const unmeasurable = new Set(
    inventory.promises.filter((p) => p.checkability === 'unmeasurable').map((p) => p.id),
  );

  const promises = verdictsFromPack(pack, {
    inventory: inventory.promises,
    unmeasurableIds: unmeasurable,
  });

  // An unguessable suffix, because the page is unauthenticated by design.
  const slug = `${projectRecord.slug}-m${options.milestone}-${randomBytes(6).toString('hex')}`;

  const { bundle, media } = buildProjection(pack, promises, {
    slug,
    title: projectRecord.title,
    client: projectRecord.client,
    milestone: options.milestone,
    offerPack: options.includePack,
  });

  // A short PIN, shared out of band. Only its hash is stored.
  const pin = String(randomBytes(2).readUInt16BE(0) % 10000).padStart(4, '0');
  const salt = randomBytes(16).toString('hex');
  const withPin = {
    ...bundle,
    pinHash: createHash('sha256').update(`${salt}:${pin}`).digest('hex'),
    pinSalt: salt,
  };

  // ---- write the bundle and its media ------------------------------------
  const bundleDir = join(options.webRoot, 'data', 'bundles');
  await mkdir(bundleDir, { recursive: true });
  await writeFile(join(bundleDir, `${slug}.json`), `${JSON.stringify(withPin, null, 2)}\n`, 'utf8');

  // One directory per bundle, one copy of each screenshot. Writing them per
  // criterion duplicated the same images sixteen times.
  const mediaDir = join(options.webRoot, 'public', 'handover', slug);
  await mkdir(mediaDir, { recursive: true });

  let written = 0;
  for (const source of media) {
    const data = pack.readEntry(source.packPath);
    if (data === undefined) continue;
    await writeFile(join(mediaDir, source.file), data);
    written += 1;
  }

  if (options.includePack) {
    // Redacted, not raw: the pack's result.yaml carries the maker's account
    // email and a dashboard share token, and offering it for download would
    // walk straight around the projection allowlist. The redacted copy still
    // validates at L1, so the client loses nothing they can check.
    redactPack(packPath, join(mediaDir, 'evidence.evidence'));
  }

  const url = `${options.baseUrl.replace(/\/$/, '')}/p/${slug}`;
  await writeProject(cwd, {
    ...projectRecord,
    milestones: projectRecord.milestones.map((m) =>
      m.n === options.milestone ? { ...m, publishedAt: new Date().toISOString(), url } : m,
    ),
  });

  if (json) {
    process.stdout.write(`${JSON.stringify({ url, pin, slug, summary: bundle.summary }, null, 2)}\n`);
    return 0;
  }

  ui.info(ui.heading('Ready to send'));
  process.stdout.write(`  ${url}\n`);
  ui.info(`  ${pc.dim('PIN')} ${pc.bold(pin)}  ${pc.dim('— share this separately, not in the same message')}`);

  ui.info('');
  ui.info(pc.dim(`  ${bundle.summary.proven} of ${bundle.summary.total} promises proven`));
  if (bundle.summary.notProven > 0) {
    ui.info(pc.dim(`  ${bundle.summary.notProven} shown to your client as not proven`));
  }
  if (bundle.summary.cannotCheck > 0) {
    ui.info(pc.dim(`  ${bundle.summary.cannotCheck} shown as not checkable, with the reason`));
  }
  ui.info(pc.dim(`  ${written} screenshots included`));

  // The maker is told plainly what this link exposes.
  ui.info('');
  ui.warn('This link needs no password. Anyone who has it can read the page.');
  if (options.includePack) {
    ui.warn(
      'The sealed evidence file is downloadable from it. That file contains network logs — ' +
        'do not publish it if the run carried real credentials.',
    );
  }

  return 0;
}
