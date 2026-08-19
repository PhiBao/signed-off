import React from 'react';
import { interpolate, useCurrentFrame } from 'remotion';
import { theme } from '../theme';

/** A scene label and one line of plain explanation. */
export const Caption: React.FC<{
  readonly kicker?: string;
  readonly title: string;
  readonly body?: string;
  readonly delay?: number;
  readonly align?: 'left' | 'center';
  readonly maxWidth?: number;
}> = ({ kicker, title, body, delay = 0, align = 'left', maxWidth = 1180 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const shift = interpolate(frame, [delay, delay + 14], [14, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${shift}px)`,
        maxWidth,
        textAlign: align,
        margin: align === 'center' ? '0 auto' : undefined,
      }}
    >
      {kicker !== undefined && (
        <p
          style={{
            margin: 0,
            font: `600 19px ${theme.fontSans}`,
            letterSpacing: 2.4,
            textTransform: 'uppercase',
            color: theme.accent,
          }}
        >
          {kicker}
        </p>
      )}
      <h2
        style={{
          margin: kicker === undefined ? 0 : '14px 0 0',
          font: `600 54px/1.15 ${theme.fontSans}`,
          color: theme.ink,
          letterSpacing: -0.8,
        }}
      >
        {title}
      </h2>
      {body !== undefined && (
        <p
          style={{
            margin: '18px 0 0',
            font: `400 27px/1.5 ${theme.fontSans}`,
            color: theme.muted,
          }}
        >
          {body}
        </p>
      )}
    </div>
  );
};

/** A framed screenshot that drifts slowly, so stills do not feel dead. */
export const Screen: React.FC<{
  readonly src: string;
  readonly alt?: string;
  readonly width: number;
  /** Total vertical distance to travel, in pixels, over `panFrames`. */
  readonly pan?: number;
  /** How long the pan takes. Defaults to a slow drift. */
  readonly panFrames?: number;
  readonly height?: number;
  readonly delay?: number;
  readonly radius?: number;
}> = ({ src, width, pan = 0, panFrames = 600, height, delay = 0, radius = 12 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const scale = interpolate(frame, [delay, delay + 40], [1.03, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const offset = interpolate(frame, [delay, delay + panFrames], [0, -pan], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width,
        height,
        overflow: 'hidden',
        borderRadius: radius,
        border: `1px solid ${theme.line}`,
        boxShadow: '0 26px 80px rgba(0,0,0,0.5)',
        opacity,
        background: '#fff',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        style={{
          width: '100%',
          display: 'block',
          transform: `translateY(${offset}px) scale(${scale})`,
          transformOrigin: 'top center',
        }}
      />
    </div>
  );
};

/** A single quoted fact, used where one line has to land hard. */
export const Callout: React.FC<{
  readonly children: React.ReactNode;
  readonly tone?: 'proven' | 'unproven' | 'accent';
  readonly delay?: number;
  readonly mono?: boolean;
  readonly size?: number;
}> = ({ children, tone = 'accent', delay = 0, mono = false, size = 30 }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [delay, delay + 9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const colour = tone === 'proven' ? theme.proven : tone === 'unproven' ? theme.unproven : theme.accent;

  return (
    <div
      style={{
        opacity,
        borderLeft: `3px solid ${colour}`,
        paddingLeft: 22,
        font: `${mono ? '400' : '500'} ${size}px/1.45 ${mono ? theme.fontMono : theme.fontSans}`,
        color: mono ? theme.ink : colour,
      }}
    >
      {children}
    </div>
  );
};
