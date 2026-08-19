import { appendSignOff, readBundle, type SignOff } from '@/lib/store';

/**
 * Record a client's verdict.
 *
 * Security notes for an endpoint that is unauthenticated by design:
 *
 *  - The `runId` in the request must match the bundle currently published. That
 *    binds the signature to the exact evidence the client saw, and stops a stale
 *    tab from signing off work that has since changed.
 *  - Input is length-capped before it is stored, so a public endpoint cannot be
 *    used to write unbounded data to disk.
 *  - Records are append-only. A later verdict supersedes an earlier one; nothing
 *    is overwritten, because the history is the point.
 *  - Only a coarse user-agent is kept, and it is never rendered publicly.
 */

const MAX_NAME = 120;
const MAX_NOTE = 2000;

function clamp(value: unknown, limit: number): string {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

export async function POST(
  request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await context.params;

  const bundle = await readBundle(slug);
  if (bundle === undefined) {
    return Response.json({ error: 'Not found.' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Malformed request.' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Malformed request.' }, { status: 400 });
  }

  const fields = body as Record<string, unknown>;
  const name = clamp(fields['name'], MAX_NAME);
  const note = clamp(fields['note'], MAX_NOTE);
  const runId = clamp(fields['runId'], 200);
  const verdict = fields['verdict'] === 'disputed' ? 'disputed' : 'accepted';

  if (name === '') {
    return Response.json({ error: 'Please add your name so we know who signed.' }, { status: 400 });
  }

  // The signature must belong to the evidence that was on screen.
  if (runId !== bundle.run.id) {
    return Response.json(
      {
        error:
          'This page has been updated since you opened it. Please refresh and review the current version.',
      },
      { status: 409 },
    );
  }

  const signOff: SignOff = {
    slug,
    runId,
    milestone: bundle.milestone,
    at: new Date().toISOString(),
    name,
    ...(note === '' ? {} : { note }),
    verdict,
    ...(() => {
      const agent = request.headers.get('user-agent');
      return agent === null ? {} : { userAgent: agent.slice(0, 200) };
    })(),
  };

  await appendSignOff(signOff);

  return Response.json({ ok: true, verdict });
}
