import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Reader for Kane's local assurance graph (`.context/`).
 *
 * The graph is content-addressed. `derived/index.json` holds the maps we need:
 *
 *   names      logical id ("ac-1") -> cid
 *   nodeLabel  cid -> "source" | "usecase" | "ac" | "gap" | "scenario" | "test"
 *   trust      cid -> "trusted" | "derived"      (derived = not yet reviewed)
 *   forward    cid -> outbound edges
 *   media      source cid -> { format, anchors_supported }
 *   srcOwner   source cid -> source id
 *
 * Node bodies live at `derived/nodes/<first2>/<rest>.json` as `{ label, content }`.
 *
 * Edge types observed in practice:
 *   DERIVES     source -> usecase, carrying `props.anchor` ("L21-L22") — the exact
 *               lines of the client's document a use-case came from. This is what
 *               lets a handover page quote the contract back.
 *   scoped_to   ac -> usecase
 *   belongs_to  scenario -> usecase
 *   automates   test -> scenario
 *   verifies    test -> ac
 *
 * This module only reads. Nothing here mutates Kane's store: the graph is Kane's
 * to own, and treating it as read-only keeps `context fsck` meaningful.
 */

export type NodeLabel = 'source' | 'usecase' | 'ac' | 'gap' | 'scenario' | 'test';
export type Trust = 'trusted' | 'derived';
export type EdgeType = 'DERIVES' | 'scoped_to' | 'belongs_to' | 'automates' | 'verifies';

export interface Edge {
  readonly type: string;
  readonly src: string;
  readonly dst: string;
  /** Line range in the source document, when the edge carries one. */
  readonly anchor?: string;
  readonly sourceId?: string;
}

/** An acceptance criterion: one checkable promise made by the document. */
export interface AcNode {
  readonly id: string;
  readonly cid: string;
  readonly text: string;
  /** How Kane intends to check it. `propagation` means an out-of-band effect. */
  readonly kind: 'presence' | 'forbidden-presence' | 'propagation' | string;
  readonly risk: 'high' | 'med' | 'low' | string;
  readonly trust: Trust;
  readonly expected?: { readonly operator: string; readonly operand: string };
}

/**
 * A gap: something the document does not settle.
 *
 * `incomplete`  — missing input (a URL, test data). Answerable by a human.
 * `unmeasurable` — no observable surface exists, so proving it would require
 *                  invention. Kane refuses to fake it, and so do we.
 */
export interface GapNode {
  readonly id: string;
  readonly cid: string;
  readonly kind: 'incomplete' | 'unmeasurable' | string;
  readonly header: string;
  readonly prompt: string;
  readonly options: readonly { readonly label: string; readonly detail: string }[];
  readonly recommendedIndex?: number;
  readonly risk: string;
  readonly rationale?: string;
  /** The AC this gap blocks, when it blocks one. */
  readonly blocks?: string;
  readonly useCaseCid?: string;
}

export interface UseCaseNode {
  readonly id: string;
  readonly cid: string;
  readonly title: string;
  readonly description: string;
  readonly summary: string;
  readonly value: string;
  readonly risk: string;
  readonly trust: Trust;
  readonly criteria: readonly string[];
  readonly actors: readonly string[];
  /** Line range in the client's document this use-case was derived from. */
  readonly anchor?: string;
  readonly sourceId?: string;
}

export interface TestNode {
  readonly id: string;
  readonly cid: string;
  readonly title: string;
  /** AC ids this test claims to verify. */
  readonly verifies: readonly string[];
}

export interface SourceNode {
  readonly id: string;
  readonly cid: string;
  readonly format: string;
}

export interface AssuranceGraph {
  readonly sources: readonly SourceNode[];
  readonly useCases: readonly UseCaseNode[];
  readonly acs: readonly AcNode[];
  readonly gaps: readonly GapNode[];
  readonly tests: readonly TestNode[];
  /** ac id -> use-case id */
  readonly acToUseCase: ReadonlyMap<string, string>;
  /** ac id -> test ids verifying it */
  readonly acToTests: ReadonlyMap<string, readonly string[]>;
}

export class NoContextError extends Error {
  constructor(dir: string) {
    super(
      `No assurance graph found in ${dir}.\n` + `Run:  signedoff init <your-scope-document>`,
    );
    this.name = 'NoContextError';
  }
}

// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function strList(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function nodePath(contextDir: string, cid: string): string {
  // cid looks like "sha256:8ccaf5ad...". The store shards on the first two hex chars.
  const hex = cid.includes(':') ? cid.slice(cid.indexOf(':') + 1) : cid;
  return join(contextDir, 'derived', 'nodes', hex.slice(0, 2), `${hex.slice(2)}.json`);
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}

function parseEdges(forward: unknown): readonly Edge[] {
  if (!isRecord(forward)) return [];
  const edges: Edge[] = [];
  for (const list of Object.values(forward)) {
    if (!Array.isArray(list)) continue;
    for (const raw of list) {
      if (!isRecord(raw)) continue;
      const props = isRecord(raw['props']) ? raw['props'] : {};
      const anchor = props['anchor'];
      const sourceId = props['source_id'];
      edges.push({
        type: str(raw['type']),
        src: str(raw['src']),
        dst: str(raw['dst']),
        ...(typeof anchor === 'string' ? { anchor } : {}),
        ...(typeof sourceId === 'string' ? { sourceId } : {}),
      });
    }
  }
  return edges;
}

/**
 * Load the assurance graph for a project directory.
 *
 * `contextDir` defaults to `<projectDir>/.context`.
 */
export async function loadGraph(projectDir: string): Promise<AssuranceGraph> {
  const contextDir = join(projectDir, '.context');
  let index: unknown;
  try {
    index = await readJson(join(contextDir, 'derived', 'index.json'));
  } catch {
    throw new NoContextError(projectDir);
  }
  if (!isRecord(index)) throw new NoContextError(projectDir);

  const names = isRecord(index['names']) ? index['names'] : {};
  const nodeLabel = isRecord(index['nodeLabel']) ? index['nodeLabel'] : {};
  const trustMap = isRecord(index['trust']) ? index['trust'] : {};
  const mediaMap = isRecord(index['media']) ? index['media'] : {};
  const edges = parseEdges(index['forward']);

  // cid -> logical id, so edges (which speak in cids) can be reported in ids.
  const idByCid = new Map<string, string>();
  for (const [id, cid] of Object.entries(names)) {
    if (typeof cid === 'string') idByCid.set(cid, id);
  }

  const trustOf = (cid: string): Trust => (trustMap[cid] === 'trusted' ? 'trusted' : 'derived');

  // Provenance: source -> usecase edges carry the document line anchor.
  const anchorByUseCase = new Map<string, { anchor?: string; sourceId?: string }>();
  for (const e of edges) {
    if (e.type !== 'DERIVES') continue;
    anchorByUseCase.set(e.dst, {
      ...(e.anchor === undefined ? {} : { anchor: e.anchor }),
      ...(e.sourceId === undefined ? {} : { sourceId: e.sourceId }),
    });
  }

  const sources: SourceNode[] = [];
  const useCases: UseCaseNode[] = [];
  const acs: AcNode[] = [];
  const gaps: GapNode[] = [];
  const tests: TestNode[] = [];

  const acToUseCase = new Map<string, string>();
  const acToTests = new Map<string, string[]>();

  for (const [cid, label] of Object.entries(nodeLabel)) {
    const id = idByCid.get(cid);

    if (label === 'source') {
      const media = isRecord(mediaMap[cid]) ? mediaMap[cid] : {};
      const owner = isRecord(index['srcOwner']) ? index['srcOwner'] : {};
      sources.push({ id: str(owner[cid], id ?? cid), cid, format: str(media['format'], 'unknown') });
      continue;
    }

    if (id === undefined) continue;

    let body: unknown;
    try {
      body = await readJson(nodePath(contextDir, cid));
    } catch {
      continue; // A node referenced by the index but absent on disk is skipped.
    }
    if (!isRecord(body)) continue;
    const content = isRecord(body['content']) ? body['content'] : {};

    switch (label) {
      case 'usecase': {
        const prov = anchorByUseCase.get(cid) ?? {};
        useCases.push({
          id,
          cid,
          title: str(content['title']),
          description: str(content['description']),
          summary: str(content['summary']),
          value: str(content['value']),
          risk: str(content['risk'], 'med'),
          trust: trustOf(cid),
          criteria: strList(content['criteria']),
          actors: strList(content['actors']),
          ...(prov.anchor === undefined ? {} : { anchor: prov.anchor }),
          ...(prov.sourceId === undefined ? {} : { sourceId: prov.sourceId }),
        });
        break;
      }

      case 'ac': {
        const expected = isRecord(content['expected_answer']) ? content['expected_answer'] : undefined;
        acs.push({
          id,
          cid,
          text: str(content['text']),
          kind: str(content['kind'], 'presence'),
          risk: str(content['risk'], 'med'),
          trust: trustOf(cid),
          ...(expected === undefined
            ? {}
            : {
                expected: {
                  operator: str(expected['operator']),
                  operand: str(expected['operand']),
                },
              }),
        });
        break;
      }

      case 'gap': {
        const q = isRecord(content['question']) ? content['question'] : {};
        const rawOptions = Array.isArray(q['options']) ? q['options'] : [];
        const options = rawOptions.filter(isRecord).map((o) => ({
          label: str(o['label']),
          detail: str(o['detail']),
        }));
        const recommended = q['recommended_index'];
        const blocks = content['ref'];
        const ucCid = content['uc'];
        gaps.push({
          id,
          cid,
          kind: str(content['kind'], 'incomplete'),
          header: str(q['header']),
          prompt: str(q['prompt']),
          options,
          ...(typeof recommended === 'number' ? { recommendedIndex: recommended } : {}),
          risk: str(content['risk'], 'med'),
          ...(typeof content['risk_rationale'] === 'string'
            ? { rationale: content['risk_rationale'] }
            : {}),
          ...(typeof blocks === 'string' ? { blocks } : {}),
          ...(typeof ucCid === 'string' ? { useCaseCid: ucCid } : {}),
        });
        break;
      }

      case 'test': {
        tests.push({ id, cid, title: str(content['title']), verifies: [] });
        break;
      }

      default:
        break;
    }
  }

  // Wire the relationships, translating cids back into logical ids.
  const testVerifies = new Map<string, string[]>();
  for (const e of edges) {
    const srcId = idByCid.get(e.src);
    const dstId = idByCid.get(e.dst);
    if (srcId === undefined || dstId === undefined) continue;

    if (e.type === 'scoped_to') acToUseCase.set(srcId, dstId);

    if (e.type === 'verifies') {
      const forAc = acToTests.get(dstId) ?? [];
      forAc.push(srcId);
      acToTests.set(dstId, forAc);

      const byTest = testVerifies.get(srcId) ?? [];
      byTest.push(dstId);
      testVerifies.set(srcId, byTest);
    }
  }

  const testsWithVerifies = tests.map((t) => ({ ...t, verifies: testVerifies.get(t.id) ?? [] }));

  return {
    sources,
    useCases,
    acs: acs.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })),
    gaps: gaps.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true })),
    tests: testsWithVerifies,
    acToUseCase,
    acToTests,
  };
}

/**
 * Quote the lines of the source document an anchor points at.
 * Anchors are `"L21-L22"` (1-based, inclusive) for markdown sources.
 */
export function quoteAnchor(documentText: string, anchor: string): string | undefined {
  const match = /^L(\d+)(?:-L(\d+))?$/.exec(anchor);
  if (match?.[1] === undefined) return undefined;

  const start = Number.parseInt(match[1], 10);
  const end = match[2] === undefined ? start : Number.parseInt(match[2], 10);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1) return undefined;

  const lines = documentText.split('\n').slice(start - 1, end);
  const quoted = lines.join(' ').replace(/\s+/g, ' ').trim();
  return quoted === '' ? undefined : quoted;
}
