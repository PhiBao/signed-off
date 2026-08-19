import type { BundlePromise } from '@/lib/store';

/**
 * One promise, as the client reads it.
 *
 * Three states, each carrying a word as well as a colour and a mark, because a
 * client may be colour-blind, printing this, or reading it on a phone in
 * sunlight — and because "not proven" and "couldn't check" mean genuinely
 * different things that must never blur together.
 */

const STATE = {
  proven: {
    word: 'Proven',
    mark: '✓',
    text: 'text-proven',
    bg: 'bg-proven-soft',
    border: 'border-proven/25',
  },
  not_proven: {
    word: 'Not proven',
    mark: '✕',
    text: 'text-unproven',
    bg: 'bg-unproven-soft',
    border: 'border-unproven/25',
  },
  cannot_check: {
    word: "Couldn't check",
    mark: '○',
    text: 'text-unknown',
    bg: 'bg-unknown-soft',
    border: 'border-unknown/25',
  },
} as const;

export function PromiseRow({ promise }: { promise: BundlePromise }) {
  const style = STATE[promise.state];
  const hasEvidence = promise.media.length > 0 || promise.observed.length > 0;

  return (
    <li className="border-t border-line first:border-t-0 py-5">
      <div className="flex gap-3 sm:gap-4">
        <span
          aria-hidden
          className={`shrink-0 mt-0.5 h-7 w-7 rounded-full grid place-items-center text-sm ${style.bg} ${style.text} border ${style.border}`}
        >
          {style.mark}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[0.95rem] leading-relaxed">{promise.text}</p>

          <p className={`mt-1.5 text-sm font-medium ${style.text}`}>
            {style.word}
            {promise.state === 'proven' && promise.strength === 'observed' && (
              <span className="font-normal text-muted"> — by review, not a direct check</span>
            )}
          </p>

          {promise.why !== undefined && promise.state !== 'proven' && (
            <p className="mt-2 text-sm text-muted leading-relaxed">{promise.why}</p>
          )}

          {promise.quote !== undefined && (
            <p className="mt-3 text-sm text-muted border-l-2 border-line pl-3 italic">
              From what you asked for: &ldquo;{promise.quote}&rdquo;
            </p>
          )}

          {hasEvidence && (
            <details className="mt-3 group">
              <summary className="text-sm underline decoration-line hover:decoration-ink inline-flex items-center gap-1.5">
                <span aria-hidden className="transition-transform group-open:rotate-90">
                  ▸
                </span>
                Show me
              </summary>

              <div className="mt-3 grid gap-4">
                {promise.observed.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wide text-muted mb-1.5">
                      What the browser saw
                    </h3>
                    <ul className="grid gap-1">
                      {promise.observed.map((line) => (
                        <li
                          key={line}
                          className="text-sm font-mono bg-paper border border-line rounded-md px-2.5 py-1.5 break-words"
                        >
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {promise.media.length > 0 && (
                  <div>
                    <h3 className="text-xs uppercase tracking-wide text-muted mb-1.5">
                      What it looked like
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {promise.media.map((shot) => (
                        <figure key={shot.file} className="grid gap-1.5">
                          {/* Screenshots are pre-sized artifacts from the run; a
                              plain img keeps the page dependency-free. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/handover/${promise.id}/${shot.file}`}
                            alt={shot.caption}
                            loading="lazy"
                            className="rounded-lg border border-line w-full"
                          />
                          <figcaption className="text-xs text-muted">{shot.caption}</figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
