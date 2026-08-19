'use client';

import { useState } from 'react';

/**
 * The one action on the page.
 *
 * A client can accept, or say something is wrong. Both are recorded and bound
 * to the exact evidence on screen (`runId`), which is what makes "I approved
 * something different" unarguable later.
 *
 * The form asks for a name and nothing else. Anything more — an account, a
 * password, a verification email — would lose the only moment that matters.
 */

interface Props {
  readonly slug: string;
  readonly runId: string;
  readonly milestone: number;
  readonly alreadySigned: boolean;
  readonly outstanding: number;
}

type Mode = 'idle' | 'accepting' | 'disputing';

export function SignOffForm({ slug, runId, milestone, alreadySigned, outstanding }: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [done, setDone] = useState(false);

  if (alreadySigned && !done) {
    return (
      <section className="mt-10 no-print">
        <p className="text-sm text-muted">
          This milestone has been accepted. Nothing further is needed.
        </p>
      </section>
    );
  }

  if (done) {
    return (
      <section className="mt-10 rounded-2xl border border-proven/30 bg-proven-soft p-5 no-print">
        <p className="font-display text-lg text-proven">Thank you — that has been recorded.</p>
        <p className="mt-1.5 text-sm text-proven/80">
          Your developer has been notified. You can close this page.
        </p>
      </section>
    );
  }

  async function submit(verdict: 'accepted' | 'disputed') {
    if (name.trim() === '') {
      setError('Please add your name so we know who signed.');
      return;
    }
    setSubmitting(true);
    setError(undefined);

    try {
      const response = await fetch(`/p/${slug}/signoff`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, milestone, name: name.trim(), note: note.trim(), verdict }),
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => ({}));
        const message =
          typeof body === 'object' && body !== null && 'error' in body
            ? String((body as { error: unknown }).error)
            : 'Something went wrong. Please try again.';
        setError(message);
        return;
      }
      setDone(true);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const field = 'w-full rounded-lg border border-line bg-card px-3 py-2.5 text-base';

  return (
    <section className="mt-11 rounded-2xl border border-line bg-card p-5 sm:p-6 no-print">
      <h2 className="font-display text-lg">
        {outstanding > 0 ? 'Ready to accept this?' : 'Is this what you asked for?'}
      </h2>

      {outstanding > 0 && (
        <p className="mt-1.5 text-sm text-unproven">
          {outstanding} {outstanding === 1 ? 'thing is' : 'things are'} not proven yet. You can still
          accept, or tell your developer what needs fixing.
        </p>
      )}

      {mode === 'idle' ? (
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => setMode('accepting')}
            className="rounded-lg bg-ink text-white px-5 py-3 text-sm font-medium"
          >
            Yes, this is what I asked for
          </button>
          <button
            type="button"
            onClick={() => setMode('disputing')}
            className="rounded-lg border border-line px-5 py-3 text-sm hover:border-ink transition-colors"
          >
            Something&rsquo;s wrong
          </button>
        </div>
      ) : (
        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit(mode === 'accepting' ? 'accepted' : 'disputed');
          }}
        >
          <div>
            <label htmlFor="signoff-name" className="block text-sm font-medium mb-1.5">
              Your name
            </label>
            <input
              id="signoff-name"
              className={field}
              value={name}
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              aria-invalid={error !== undefined}
            />
          </div>

          <div>
            <label htmlFor="signoff-note" className="block text-sm font-medium mb-1.5">
              {mode === 'accepting' ? (
                <>
                  Anything to add <span className="text-muted font-normal">(optional)</span>
                </>
              ) : (
                "What's wrong?"
              )}
            </label>
            <textarea
              id="signoff-note"
              rows={3}
              className={field}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>

          {error !== undefined && <p className="text-sm text-unproven">{error}</p>}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-ink text-white px-5 py-3 text-sm font-medium disabled:opacity-60"
            >
              {submitting
                ? 'Recording…'
                : mode === 'accepting'
                  ? 'Accept this milestone'
                  : 'Send this back'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('idle');
                setError(undefined);
              }}
              className="rounded-lg border border-line px-5 py-3 text-sm"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-muted">
            Your name, the date and a reference to the exact evidence above are recorded together.
          </p>
        </form>
      )}
    </section>
  );
}
