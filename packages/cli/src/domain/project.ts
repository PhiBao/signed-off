import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Per-project state, at `.signedoff/project.json`.
 *
 * Small and committable on purpose: a teammate cloning the repo gets the same
 * project identity, and the file is readable enough to review in a diff.
 * Nothing secret lives here — publish tokens go to `.signedoff/local.json`,
 * which is gitignored.
 */

export const PROJECT_DIR = '.signedoff';
const PROJECT_FILE = 'project.json';

export interface MilestoneRecord {
  readonly n: number;
  /** Path to the sealed evidence pack, relative to the project root. */
  readonly packPath?: string;
  readonly verifiedAt?: string;
  readonly publishedAt?: string;
  readonly url?: string;
  /** Content id of the published pack, so a sign-off can bind to it. */
  readonly packCid?: string;
}

export interface Project {
  readonly version: 1;
  /** URL-safe project identifier, used in the handover link. */
  readonly slug: string;
  readonly title: string;
  readonly client: string;
  /** Path to the client's source document, relative to the project root. */
  readonly sourceDocument: string;
  readonly createdAt: string;
  readonly milestones: readonly MilestoneRecord[];
}

export class NoProjectError extends Error {
  constructor() {
    super('No Signed Off project here.\nRun:  signedoff init <your-scope-document>');
    this.name = 'NoProjectError';
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export async function readProject(root: string): Promise<Project> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(join(root, PROJECT_DIR, PROJECT_FILE), 'utf8')) as unknown;
  } catch {
    throw new NoProjectError();
  }
  if (!isRecord(raw) || raw['version'] !== 1) throw new NoProjectError();

  const milestones = Array.isArray(raw['milestones'])
    ? raw['milestones'].filter(isRecord).map(
        (m): MilestoneRecord => ({
          n: typeof m['n'] === 'number' ? m['n'] : 1,
          ...pick(m, 'packPath', 'verifiedAt', 'publishedAt', 'url', 'packCid'),
        }),
      )
    : [];

  return {
    version: 1,
    slug: String(raw['slug'] ?? ''),
    title: String(raw['title'] ?? ''),
    client: String(raw['client'] ?? ''),
    sourceDocument: String(raw['sourceDocument'] ?? ''),
    createdAt: String(raw['createdAt'] ?? new Date().toISOString()),
    milestones,
  };
}

export async function writeProject(root: string, project: Project): Promise<void> {
  const dir = join(root, PROJECT_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, PROJECT_FILE), `${JSON.stringify(project, null, 2)}\n`, 'utf8');
}

/** Derive a readable, URL-safe slug. Falsy input yields a stable fallback. */
export function toSlug(input: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug === '' ? 'project' : slug;
}

function pick<T extends Record<string, unknown>, K extends string>(
  source: T,
  ...keys: readonly K[]
): Partial<Record<K, string>> {
  const out: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}
