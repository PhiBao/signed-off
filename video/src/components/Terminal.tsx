import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

/**
 * A terminal panel that reveals real output line by line.
 *
 * Every string passed to this component is verbatim output from a real run
 * during the build — nothing here is mocked up for the camera.
 */

export interface TerminalLine {
  readonly text: string;
  readonly tone?: 'command' | 'plain' | 'muted' | 'proven' | 'unproven' | 'unknown' | 'accent';
  /** Render at a smaller size, for wrapped continuation lines. */
  readonly small?: boolean;
}

const TONE: Record<NonNullable<TerminalLine['tone']>, string> = {
  command: theme.ink,
  plain: theme.ink,
  muted: theme.muted,
  proven: theme.proven,
  unproven: theme.unproven,
  unknown: theme.unknown,
  accent: theme.accent,
};

interface Props {
  readonly title?: string;
  readonly lines: readonly TerminalLine[];
  /** Frames between each line appearing. */
  readonly stagger?: number;
  /** Frame at which the first line appears. */
  readonly delay?: number;
  readonly fontSize?: number;
}

export const Terminal: React.FC<Props> = ({
  title = 'signedoff',
  lines,
  stagger = 6,
  delay = 0,
  fontSize = 25,
}) => {
  const frame = useCurrentFrame();

  return (
    <div
      style={{
        background: theme.card,
        border: `1px solid ${theme.line}`,
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 24px 70px rgba(0,0,0,0.45)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '13px 18px',
          borderBottom: `1px solid ${theme.line}`,
        }}
      >
        {['#e8736c', '#e0b25a', '#5fbf8c'].map((c) => (
          <span
            key={c}
            style={{ width: 11, height: 11, borderRadius: 99, background: c, opacity: 0.85 }}
          />
        ))}
        <span
          style={{
            marginLeft: 8,
            color: theme.muted,
            font: `500 15px ${theme.fontSans}`,
            letterSpacing: 0.3,
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ padding: '20px 24px 24px', display: 'grid', gap: 3 }}>
        {lines.map((line, index) => {
          const appearAt = delay + index * stagger;
          const opacity = interpolate(frame, [appearAt, appearAt + 4], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const shift = interpolate(frame, [appearAt, appearAt + 6], [6, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });

          const isCommand = line.tone === 'command';

          return (
            <div
              key={`${index}-${line.text}`}
              style={{
                opacity,
                transform: `translateY(${shift}px)`,
                font: `${isCommand ? 600 : 400} ${line.small ? fontSize - 4 : fontSize}px ${theme.fontMono}`,
                color: TONE[line.tone ?? 'plain'],
                whiteSpace: 'pre-wrap',
                lineHeight: 1.5,
                // A blank line in real terminal output is a deliberate pause in
                // the reading; collapsing it to zero height loses the rhythm.
                minHeight: line.text === '' ? fontSize * 0.7 : undefined,
              }}
            >
              {isCommand ? (
                <>
                  <span style={{ color: theme.accent }}>$ </span>
                  {line.text}
                </>
              ) : (
                line.text
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
