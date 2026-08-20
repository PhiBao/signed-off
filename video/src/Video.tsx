import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { Callout, Caption, Screen } from './components/Screen';
import { Terminal, type TerminalLine } from './components/Terminal';
import { SCENES, SCENE_ORDER, seconds } from './config';
import { theme } from './theme';

/**
 * The demo video.
 *
 * Every terminal line and every screenshot below came from a real run during the
 * build. The Kane browser frames are lifted straight out of the sealed evidence
 * pack, which is committed to the repository.
 */

const Stage: React.FC<{ readonly children: React.ReactNode; readonly pad?: number }> = ({
  children,
  pad = 96,
}) => (
  <AbsoluteFill style={{ background: theme.paper, padding: pad, fontFamily: theme.fontSans }}>
    {children}
  </AbsoluteFill>
);

/** Soft vignette so the dark background is not flat. */
const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(1100px 620px at 22% 12%, rgba(127,211,168,0.10), transparent 62%), radial-gradient(900px 560px at 84% 88%, rgba(232,115,108,0.07), transparent 60%)',
    }}
  />
);

// ---------------------------------------------------------------------------
// 1. Hook — a green suite on a broken product
// ---------------------------------------------------------------------------

const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const swap = seconds(7.5);

  return (
    <Stage>
      <Backdrop />
      <div style={{ display: 'grid', gap: 46, alignContent: 'center', height: '100%' }}>
        <Caption
          kicker="Signed Off"
          title="The scope said: the customer must not be able to choose a Sunday."
          body="Kane generated the test. The test passed. The storefront was offering three Sundays."
        />

        {frame < swap ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Screen src={staticFile('kane-sunday-selected.jpg')} width={1180} delay={seconds(1.6)} />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 22, justifyItems: 'start' }}>
            <Callout tone="proven" delay={swap} size={33}>
              Kane reported: 5 tests, 4 passed, 0 failed
            </Callout>
            <Callout tone="unproven" delay={swap + 14} size={33}>
              Signed Off reported: not proven
            </Callout>
          </div>
        )}
      </div>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 2. False pass — why the assertion was wrong
// ---------------------------------------------------------------------------

const FalsePass: React.FC = () => (
  <Stage>
    <Backdrop />
    <div style={{ display: 'grid', gap: 34, alignContent: 'center', height: '100%' }}>
      <Caption kicker="Why it passed" title="The assertion checked the wrong thing." />

      <Callout mono delay={seconds(1.4)} size={38}>
        {'/^Sunday\\b/.test( el(21).value )'}
      </Callout>

      <div style={{ display: 'grid', gap: 14, marginTop: 6 }}>
        <Callout mono tone="unproven" delay={seconds(3.4)} size={30}>
          value = &quot;2026-08-23&quot;
        </Callout>
        <Callout mono tone="proven" delay={seconds(4.6)} size={30}>
          what a person sees = &quot;Sunday 23 August&quot;
        </Callout>
      </div>

      <Caption
        title=""
        body="The word Sunday never appears in the value. So the check passed."
        delay={seconds(6.4)}
      />

      <div style={{ marginTop: 8 }}>
        <Caption
          kicker="But Kane had already recorded the truth"
          title=""
          delay={seconds(9.6)}
        />
        <div style={{ marginTop: 18 }}>
          <Callout mono delay={seconds(10.6)} size={26}>
            {'{"selectedText":"Sunday 23 August",'}
            <br />
            {' "sundayOptions":["Sunday 23 August","Sunday 30 August","Sunday 6 September"]}'}
          </Callout>
        </div>
        <div style={{ marginTop: 26 }}>
          <Caption
            title=""
            body="The evidence disproved the verdict it shipped with. So Signed Off cross-checks every passing promise against what the browser actually saw — and only ever downgrades."
            delay={seconds(14.5)}
          />
        </div>
      </div>
    </div>
  </Stage>
);

// ---------------------------------------------------------------------------
// 3. Problem — who this is for
// ---------------------------------------------------------------------------

const Problem: React.FC = () => (
  <Stage>
    <Backdrop />
    <div style={{ display: 'grid', gap: 40, alignContent: 'center', height: '100%' }}>
      <Caption
        kicker="Who needs this"
        title="A freelancer submits a milestone. The client says it doesn't work."
        body="The freelancer says it works for me. Neither has proof, and the money stops moving."
      />
      <div style={{ display: 'grid', gap: 18, marginTop: 10 }}>
        <Callout delay={seconds(4.6)} size={30}>
          Acceptance criteria are already standard in freelance contracts.
        </Callout>
        <Callout delay={seconds(6.4)} size={30}>
          As prose that nobody ever executes.
        </Callout>
      </div>
    </div>
  </Stage>
);

// ---------------------------------------------------------------------------
// 4. init — the promise inventory
// ---------------------------------------------------------------------------

const initLines: readonly TerminalLine[] = [
  { text: 'signedoff init ./scope.md --client "Sarah Whitmore"', tone: 'command' },
  { text: '' },
  { text: '16 promises found in your scope', tone: 'accent' },
  { text: '' },
  { text: '  Place a bouquet order as a guest', tone: 'muted' },
  { text: '    · Sunday is not selectable as a delivery date.' },
  { text: '      provable', tone: 'proven', small: true },
  { text: '    · After a successful checkout, the order is sent to Sarah by email.' },
  { text: '      not provable in a browser', tone: 'unknown', small: true },
  {
    text: "      why: Sarah's inbox is an out-of-band channel with no named",
    tone: 'muted',
    small: true,
  },
  { text: '           observable substitute.', tone: 'muted', small: true },
  { text: '' },
  { text: "7 things your scope doesn't say", tone: 'accent' },
  { text: '  Send these to your client before you build.', tone: 'muted', small: true },
  { text: '  1. email surface — what should prove Sarah received the order?', small: true },
  { text: '  2. phone oracle  — "works on a phone" has no pass condition.', small: true },
];

const Init: React.FC = () => (
  <Stage pad={72}>
    <Backdrop />
    <div style={{ display: 'grid', gap: 30, alignContent: 'center', height: '100%' }}>
      <Caption
        kicker="Step one"
        title="Read the scope the client signed."
        body="Not the code. The document."
      />
      <Terminal lines={initLines} delay={seconds(2.4)} stagger={5} fontSize={24} />
      <Caption
        title=""
        body="It says what can be proven, what cannot, and what the contract never settled."
        delay={seconds(19)}
      />
    </div>
  </Stage>
);

// ---------------------------------------------------------------------------
// 5. verify — red
// ---------------------------------------------------------------------------

const verifyLines: readonly TerminalLine[] = [
  { text: 'signedoff verify --url http://localhost:4311/', tone: 'command' },
  { text: '' },
  { text: '  ✓ proven        A visitor can see the price of every bouquet' },
  { text: '  ✓ proven        Basket total updates when a bouquet is added' },
  { text: '  ✗ not proven    Sunday is not selectable as a delivery date.', tone: 'unproven' },
  {
    text: '      → The run recorded the calendar state as "Sunday 23 August",',
    tone: 'muted',
    small: true,
  },
  { text: '        but this was promised not to happen.', tone: 'muted', small: true },
  { text: "  ○ can't check   A successful order is sent to Sarah by email", tone: 'unknown' },
  { text: '' },
  { text: '  9 of 16 promises proven', tone: 'accent' },
  { text: '  2 not proven', tone: 'unproven' },
  { text: "  5 couldn't be checked", tone: 'unknown' },
];

const Verify: React.FC = () => (
  <Stage pad={72}>
    <Backdrop />
    <div style={{ display: 'grid', gap: 30, alignContent: 'center', height: '100%' }}>
      <Caption
        kicker="Step two"
        title="Check it against the real build."
        body="Real Chrome. Real checkout. One sealed evidence pack."
      />
      <Terminal lines={verifyLines} delay={seconds(2.2)} stagger={6} fontSize={25} />
      <Caption
        title=""
        body="Three verdicts, never two. A timed-out run and a broken checkout are different facts."
        delay={seconds(15.5)}
      />
    </div>
  </Stage>
);

// ---------------------------------------------------------------------------
// 6. Handover — what Sarah sees
// ---------------------------------------------------------------------------

const Handover: React.FC = () => (
  <Stage pad={64}>
    <Backdrop />
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 470px',
        gap: 64,
        alignItems: 'center',
        height: '100%',
      }}
    >
      <div style={{ display: 'grid', gap: 30 }}>
        <Caption
          kicker="Step three"
          title="Sarah opens one link."
          body="No account. No install. No test names, no ids, no coverage percentages."
          maxWidth={720}
        />
        <div style={{ display: 'grid', gap: 16 }}>
          <Callout tone="unproven" delay={seconds(5)} size={27}>
            9 of 16 things you asked for are proven
          </Callout>
          <Callout delay={seconds(7)} size={25}>
            Expand &ldquo;Show me&rdquo; and she sees the browser&rsquo;s own reading:
            <br />
            <span style={{ fontFamily: theme.fontMono, fontSize: 22, color: theme.ink }}>
              selected text: Sunday 23 August
            </span>
          </Callout>
          <Callout delay={seconds(11.5)} size={25}>
            next to the page&rsquo;s own words:
            <br />
            <span style={{ fontFamily: theme.fontMono, fontSize: 22, color: theme.ink }}>
              &ldquo;Sundays are not available.&rdquo;
            </span>
          </Callout>
        </div>
        <Caption
          title=""
          body="She sends it back. Nobody argues about whether it works."
          delay={seconds(17.5)}
          maxWidth={720}
        />
      </div>

      <Screen
        src={staticFile('handover-red-phone.png')}
        width={430}
        height={880}
        pan={900}
        panFrames={seconds(21)}
        delay={seconds(1.2)}
        radius={26}
      />
    </div>
  </Stage>
);

// ---------------------------------------------------------------------------
// 7. brief — hand the failure to the agent
// ---------------------------------------------------------------------------

const briefLines: readonly TerminalLine[] = [
  { text: 'signedoff brief | claude -p', tone: 'command' },
  { text: '' },
  { text: '2 promises in the signed scope are not proven by the current build.', tone: 'accent' },
  { text: '' },
  { text: 'Sarah Whitmore is waiting to accept or reject this milestone.', tone: 'muted' },
  { text: '' },
  { text: 'Fix the product code so each promise below holds. Do not change', small: true },
  { text: 'the tests, and do not change the scope document.', small: true },
  { text: '' },
  { text: '## 1. Sunday is not selectable as a delivery date.', tone: 'unproven' },
  { text: '' },
  { text: 'What the browser observed:', tone: 'muted', small: true },
  { text: '  - selectedText: "Sunday 23 August"', small: true },
  { text: '  - sundayOptions: 3 Sundays offered', small: true },
];

const Brief: React.FC = () => {
  const frame = useCurrentFrame();
  const patchAt = seconds(12);
  const opacity = interpolate(frame, [patchAt, patchAt + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Stage pad={72}>
      <Backdrop />
      <div style={{ display: 'grid', gap: 28, alignContent: 'center', height: '100%' }}>
        <Caption
          kicker="Step four"
          title="Hand what failed to the coding agent."
          body="Not a stack trace — the promise, the contract, and what the browser saw."
        />
        <Terminal
          title="signedoff brief"
          lines={briefLines}
          delay={seconds(2)}
          stagger={5}
          fontSize={23}
        />
        <div style={{ opacity, display: 'grid', gap: 12 }}>
          <p
            style={{
              margin: 0,
              font: `600 22px ${theme.fontSans}`,
              color: theme.accent,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
            }}
          >
            The agent&rsquo;s one-line fix
          </p>
          <div
            style={{
              background: theme.card,
              border: `1px solid ${theme.line}`,
              borderRadius: 10,
              padding: '16px 22px',
              font: `400 25px/1.6 ${theme.fontMono}`,
            }}
          >
            <span style={{ color: theme.unproven }}>
              - const NON_DELIVERY_WEEKDAYS = new Set([7]);
            </span>
            <br />
            <span style={{ color: theme.proven }}>
              + const NON_DELIVERY_WEEKDAYS = new Set([0]);
            </span>
            <br />
            <span style={{ color: theme.muted, fontSize: 21 }}>
              {'  // getDay() returns 0 for Sunday, never 7'}
            </span>
          </div>
        </div>
      </div>
    </Stage>
  );
};

// ---------------------------------------------------------------------------
// 4. Start from the document
// ---------------------------------------------------------------------------

const DocumentScene: React.FC = () => (
  <Stage>
    <Backdrop />
    <div style={{ display: 'grid', gap: 34, alignContent: 'center', height: '100%' }}>
      <Caption
        kicker="What it does"
        title="It starts from the document the client signed."
        body="Not from the code. Kane turns the scope into acceptance criteria, one test per scenario, every claim cited back to the line it came from."
      />
      <div style={{ display: 'grid', gap: 16, marginTop: 6 }}>
        <Callout tone="proven" delay={seconds(3.6)} size={29}>
          16 promises found in the scope
        </Callout>
        <Callout tone="unproven" delay={seconds(5.2)} size={29}>
          1 of them cannot be proven in a browser — and it says so
        </Callout>
        <Callout delay={seconds(6.8)} size={29}>
          7 things the contract never settled
        </Callout>
      </div>
    </div>
  </Stage>
);

// ---------------------------------------------------------------------------
// 5 & 6. The real recordings
// ---------------------------------------------------------------------------

/** A full-frame screen recording with a small persistent label. */
const Recording: React.FC<{
  readonly src: string;
  readonly label: string;
  readonly note?: string;
}> = ({ src, label, note }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ background: theme.paper, opacity }}>
      {/* Inset so the label and caption sit in a margin rather than on top of
          the recording, which was covering the first lines of output. */}
      <div style={{ position: 'absolute', inset: 0, paddingTop: 78, paddingBottom: 124 }}>
        <OffthreadVideo
          src={src}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 46,
          top: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(15,19,17,0.86)',
          border: `1px solid ${theme.line}`,
          borderRadius: 999,
          padding: '10px 20px',
        }}
      >
        <span
          style={{ width: 9, height: 9, borderRadius: 999, background: theme.unproven }}
          aria-hidden
        />
        <span style={{ font: `600 20px ${theme.fontSans}`, color: theme.ink, letterSpacing: 0.4 }}>
          {label}
        </span>
      </div>

      {note !== undefined && (
        <div
          style={{
            position: 'absolute',
            left: 46,
            right: 46,
            bottom: 24,
            background: 'rgba(15,19,17,0.88)',
            border: `1px solid ${theme.line}`,
            borderRadius: 12,
            padding: '14px 22px',
            font: `400 23px/1.4 ${theme.fontSans}`,
            color: theme.muted,
          }}
        >
          {note}
        </div>
      )}
    </AbsoluteFill>
  );
};

const TerminalScene: React.FC = () => (
  <Recording
    src={staticFile('terminal.mp4')}
    label="Real session · recorded terminal"
    note="Signed Off reads the pack that caught the bug, briefs the agent, and Kane replays the fixed build from cache."
  />
);

const BrowserScene: React.FC = () => (
  <Recording
    src={staticFile('browser.mp4')}
    label="Real browser · what the client opens"
    note="“selected text: Sunday 23 August” — directly above the page's own “Sundays are not available.”"
  />
);

// ---------------------------------------------------------------------------
// 8. green — replay
// ---------------------------------------------------------------------------

const greenLines: readonly TerminalLine[] = [
  { text: 'signedoff verify --url http://localhost:4311/', tone: 'command' },
  { text: '' },
  { text: '  ✓ proven        Sunday is not selectable as a delivery date.', tone: 'proven' },
  { text: '' },
  { text: '  11 of 16 promises proven', tone: 'proven' },
  { text: '  0 not proven', tone: 'proven' },
  { text: '' },
  { text: '  3m09s · 10.9 credits', tone: 'muted' },
];

const Green: React.FC = () => (
  <Stage pad={72}>
    <Backdrop />
    <div style={{ display: 'grid', gap: 34, alignContent: 'center', height: '100%' }}>
      <Caption kicker="Step five" title="Re-check it. Passed steps replay from cache." />
      <Terminal lines={greenLines} delay={seconds(1.8)} stagger={7} fontSize={27} />
      <Callout tone="proven" delay={seconds(10.5)} size={31}>
        10.9 credits to re-prove a milestone, against roughly 180 to author the suite.
      </Callout>
      <Caption
        title=""
        body="That is what makes proving it again after every fix affordable, instead of something you do once."
        delay={seconds(13.5)}
      />
    </div>
  </Stage>
);

// ---------------------------------------------------------------------------
// 9. accept
// ---------------------------------------------------------------------------

const Accept: React.FC = () => (
  <Stage>
    <Backdrop />
    <div
      style={{
        display: 'grid',
        gap: 40,
        alignContent: 'center',
        justifyItems: 'center',
        height: '100%',
        textAlign: 'center',
      }}
    >
      <Caption
        kicker="Signed off"
        title="&ldquo;Sunday is fixed. Happy to release payment.&rdquo;"
        body="Sarah Whitmore · accepted, bound to the exact evidence she was shown"
        align="center"
        maxWidth={1240}
      />
      <div style={{ display: 'grid', gap: 16, justifyItems: 'center', marginTop: 14 }}>
        <p style={{ margin: 0, font: `500 27px ${theme.fontSans}`, color: theme.muted }}>
          Anyone can check the record without trusting us:
        </p>
        <p
          style={{
            margin: 0,
            font: `400 25px ${theme.fontMono}`,
            color: theme.accent,
          }}
        >
          kane-cli evidence validate &lt;pack&gt; --profile L1
        </p>
      </div>
      <p
        style={{
          margin: '18px 0 0',
          font: `500 25px ${theme.fontMono}`,
          color: theme.ink,
        }}
      >
        github.com/PhiBao/signed-off
      </p>
    </div>
  </Stage>
);

// ---------------------------------------------------------------------------

const COMPONENTS = {
  hook: Hook,
  falsePass: FalsePass,
  problem: Problem,
  document: DocumentScene,
  terminal: TerminalScene,
  browser: BrowserScene,
  green: Green,
  accept: Accept,
} as const;

export const SignedOffVideo: React.FC = () => {
  let cursor = 0;

  return (
    <AbsoluteFill style={{ background: theme.paper }}>
      {SCENE_ORDER.map((name) => {
        const from = cursor;
        const duration = seconds(SCENES[name]);
        cursor += duration;
        const Component = COMPONENTS[name];
        return (
          <Sequence key={name} from={from} durationInFrames={duration} name={name}>
            <Component />
            {/* One narration clip per scene, each measured to fit inside its
                own cut by scripts/narrate.sh. */}
            <Audio src={staticFile(`narration/${name}.mp3`)} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
