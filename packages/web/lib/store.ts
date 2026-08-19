import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Storage for published handover bundles and client sign-offs.
 *
 * Deliberately a directory on disk rather than a database. The whole point of a
 * handover is that it is a portable artifact, and keeping the store as plain
 * files means a maker can read, archive, back up or hand over the record without
 * asking us for an export. It also means the judges can run this with one
 * command and no external service.
 *
 * Layout:
 *   data/bundles/<slug>.json     the client-safe projection
 *   data/signoffs/<slug>.json    append-only acceptance records
 *   public/handover/<slug>/*.jpg screenshots
 */

const DATA_DIR = process.env['SIGNEDOFF_DATA_DIR'] ?? join(process.cwd(), 'data');

export interface BundleMedia {
  readonly file: string;
  readonly caption: string;
}

export interface BundleObservation {
  readonly label: string;
  readonly value: string;
}

export interface BundlePromise {
  readonly id: string;
  readonly text: string;
  readonly state: 'proven' | 'not_proven' | 'cannot_check';
  readonly why?: string;
  readonly quote?: string;
  readonly groupTitle: string;
  readonly strength: 'asserted' | 'observed';
  readonly observed: readonly BundleObservation[];
  readonly media: readonly BundleMedia[];
}

export interface HandoverBundle {
  readonly version: number;
  readonly slug: string;
  readonly title: string;
  readonly client: string;
  readonly milestone: number;
  readonly createdAt: string;
  readonly run: {
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
  readonly packOffered: boolean;
  /** Salted hash of the access PIN. The PIN itself is never stored. */
  readonly pinHash?: string;
  readonly pinSalt?: string;
}

/**
 * A client's acceptance, bound to the exact evidence they were shown.
 *
 * `runId` is the content id of the pack on screen at the time. Binding the
 * signature to it is what makes "I approved something different" unarguable.
 */
export interface SignOff {
  readonly slug: string;
  readonly runId: string;
  readonly milestone: number;
  readonly at: string;
  readonly name: string;
  readonly note?: string;
  /** `accepted` or `disputed` — a client can also say something is wrong. */
  readonly verdict: 'accepted' | 'disputed';
  /** Coarse provenance. Never shown publicly. */
  readonly userAgent?: string;
}

export async function readBundle(slug: string): Promise<HandoverBundle | undefined> {
  if (!isSafeSlug(slug)) return undefined;
  try {
    const raw = await readFile(join(DATA_DIR, 'bundles', `${slug}.json`), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    return parsed as HandoverBundle;
  } catch {
    return undefined;
  }
}

export async function listBundleSlugs(): Promise<readonly string[]> {
  try {
    const names = await readdir(join(DATA_DIR, 'bundles'));
    return names.filter((n) => n.endsWith('.json')).map((n) => n.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}

export async function readSignOffs(slug: string): Promise<readonly SignOff[]> {
  if (!isSafeSlug(slug)) return [];
  try {
    const raw = await readFile(join(DATA_DIR, 'signoffs', `${slug}.json`), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SignOff[]) : [];
  } catch {
    return [];
  }
}

/**
 * Append a sign-off. Records are never mutated or removed: a later verdict
 * supersedes an earlier one, and the history stays readable.
 */
export async function appendSignOff(signOff: SignOff): Promise<void> {
  if (!isSafeSlug(signOff.slug)) throw new Error('invalid slug');
  const dir = join(DATA_DIR, 'signoffs');
  await mkdir(dir, { recursive: true });
  const existing = await readSignOffs(signOff.slug);
  await writeFile(
    join(dir, `${signOff.slug}.json`),
    `${JSON.stringify([...existing, signOff], null, 2)}\n`,
    'utf8',
  );
}

/** The latest acceptance, if the client has signed. */
export function latestSignOff(signOffs: readonly SignOff[]): SignOff | undefined {
  return [...signOffs].sort((a, b) => b.at.localeCompare(a.at))[0];
}

// ---------------------------------------------------------------------------
// Access control
// ---------------------------------------------------------------------------

/**
 * Handover pages are unauthenticated by design: a client will not create an
 * account, and requiring one would kill the only moment that matters. The
 * protections are therefore an unguessable slug plus an optional short PIN the
 * maker shares out of band, and `noindex` on every page.
 *
 * This is a deliberate trade of secrecy for reach, and the maker is told so at
 * publish time. It is the right call for the job but it is a real trade.
 */
export function hashPin(pin: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${pin}`).digest('hex');
}

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

export function pinMatches(bundle: HandoverBundle, supplied: string): boolean {
  if (bundle.pinHash === undefined || bundle.pinSalt === undefined) return true;

  const expected = Buffer.from(bundle.pinHash, 'hex');
  const actual = Buffer.from(hashPin(supplied.trim(), bundle.pinSalt), 'hex');
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

/** Slugs are used in filesystem paths, so they are strictly validated. */
export function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,80}$/.test(slug);
}
