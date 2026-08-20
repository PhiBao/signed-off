#!/usr/bin/env node
/**
 * Record the handover page as a real browser session.
 *
 * There is no compositor on this machine, so a visible window never reaches the
 * X root and ffmpeg's x11grab captures only black. Chrome's DevTools screencast
 * solves it properly: frames come straight out of the real renderer while the
 * page is driven with real input events, so what lands on disk is genuinely the
 * browser doing the thing rather than a re-staging of it.
 *
 * Frames arrive only when the page changes, each with a timestamp, so an ffmpeg
 * concat list is written with real per-frame durations to preserve the pacing.
 *
 * Usage: node record-browser.mjs <url> <out-dir>
 */
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const url = process.argv[2];
const outDir = process.argv[3];
if (url === undefined || outDir === undefined) {
  process.stderr.write('usage: record-browser.mjs <url> <out-dir>\n');
  process.exit(2);
}

const CHROME = `${process.env['HOME']}/.local/bin/google-chrome`;
const PORT = 9333;
const WIDTH = 1440;
const HEIGHT = 900;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

// ---- launch ---------------------------------------------------------------
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=/tmp/chrome-screencast-profile',
    'about:blank',
  ],
  { stdio: 'ignore', detached: true },
);
chrome.unref();

let wsUrl;
for (let attempt = 0; attempt < 40; attempt += 1) {
  await sleep(500);
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const targets = await res.json();
    const page = targets.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl !== undefined) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {
    // Chrome not up yet.
  }
}
if (wsUrl === undefined) {
  process.stderr.write('could not reach Chrome DevTools\n');
  process.exit(1);
}

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const frames = [];

ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);

  if (msg.method === 'Page.screencastFrame') {
    frames.push({ data: msg.params.data, at: Date.now() });
    // Acknowledge, or Chrome stops sending.
    send('Page.screencastFrameAck', { sessionId: msg.params.sessionId }).catch(() => {});
    return;
  }
  if (msg.id !== undefined && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  }
});

function send(method, params = {}) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const evaluate = (expression) =>
  send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

// ---- set up the page ------------------------------------------------------
await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
});

await send('Page.navigate', { url });
await sleep(3500);

await send('Page.startScreencast', {
  format: 'jpeg',
  quality: 85,
  maxWidth: WIDTH,
  maxHeight: HEIGHT,
  everyNthFrame: 1,
});

/** Smoothly scroll to an absolute offset, so the capture has motion to record. */
async function scrollTo(target, ms) {
  await evaluate(`
    (() => new Promise((done) => {
      const start = window.scrollY;
      const delta = ${target} - start;
      const began = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - began) / ${ms});
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        window.scrollTo(0, start + delta * eased);
        if (t < 1) requestAnimationFrame(step); else done(true);
      };
      requestAnimationFrame(step);
    }))()
  `);
}

/**
 * Open the "Show me" disclosure on the first not-proven promise.
 *
 * Two steps on purpose: scroll first, let it settle, and only then read the
 * element's rectangle. Reading it in the same evaluate as the scroll returns
 * pre-scroll coordinates, so the click lands on empty space — which is exactly
 * what happened on the first take.
 */
async function openFailingEvidence() {
  await evaluate(`
    (() => {
      // Must contain a disclosure: the headline card also has a bullet reading
      // "2 are not proven yet", which matched before and has no <details>.
      const rows = [...document.querySelectorAll('li')];
      const row = rows.find(
        (li) => li.querySelector('details') && /Not proven/i.test(li.innerText ?? ''),
      );
      row?.querySelector('summary')?.scrollIntoView({ block: 'center' });
      return true;
    })()
  `);
  await sleep(1200);

  const box = await evaluate(`
    (() => {
      const rows = [...document.querySelectorAll('li')];
      const row = rows.find(
        (li) => li.querySelector('details') && /Not proven/i.test(li.innerText ?? ''),
      );
      const summary = row?.querySelector('summary');
      if (!summary) return null;
      const r = summary.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()
  `);
  const point = box.result?.value;
  if (point === null || point === undefined) return false;

  const x = Math.round(point.x);
  const y = Math.round(point.y);

  // A real pointer sequence: move, press, release. Headless Chrome ignores a
  // bare press/release pair without `buttons` set.
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await sleep(120);
  await send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x,
    y,
    button: 'left',
    buttons: 1,
    clickCount: 1,
  });
  await sleep(80);
  await send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x,
    y,
    button: 'left',
    buttons: 0,
    clickCount: 1,
  });

  await sleep(600);
  let opened = await evaluate(`[...document.querySelectorAll('details')].some((d) => d.open)`);

  if (opened.result?.value !== true) {
    // Fall back to toggling the disclosure directly. The revealed content is
    // still the real page rendering real evidence; only the toggle differs.
    process.stderr.write('click did not register; opening the disclosure directly\n');
    await evaluate(`
      (() => {
        const rows = [...document.querySelectorAll('li')];
        const row = rows.find(
          (li) => li.querySelector('details') && /Not proven/i.test(li.innerText ?? ''),
        );
        const details = row?.querySelector('details');
        if (details) details.open = true;
        return details?.open === true;
      })()
    `);
    await sleep(500);
    opened = await evaluate(`[...document.querySelectorAll('details')].some((d) => d.open)`);
  }

  return opened.result?.value === true;
}

// ---- the take -------------------------------------------------------------
await sleep(1400);
await scrollTo(200, 1500);
await sleep(1000);
await scrollTo(560, 1600);
await sleep(900);

const opened = await openFailingEvidence();
process.stderr.write(opened ? 'evidence panel opened\n' : 'WARNING: panel did not open\n');
await sleep(1200);

if (opened) {
  // Let the reveal land, then walk down through what the browser actually saw.
  await scrollTo(760, 1300);
  await sleep(2800);
  await scrollTo(1040, 1400);
  await sleep(2600);
}
await scrollTo(1560, 1700);
await sleep(1800);

await send('Page.stopScreencast');
await sleep(300);

// ---- write frames + a concat list preserving real pacing ------------------
const list = [];
for (const [index, frame] of frames.entries()) {
  const name = `f${String(index).padStart(5, '0')}.jpg`;
  await writeFile(join(outDir, name), Buffer.from(frame.data, 'base64'));
  const next = frames[index + 1];
  const seconds = next === undefined ? 0.2 : Math.max(0.016, (next.at - frame.at) / 1000);
  list.push(`file '${name}'`, `duration ${seconds.toFixed(3)}`);
}
const last = frames.at(-1);
if (last !== undefined) list.push(`file 'f${String(frames.length - 1).padStart(5, '0')}.jpg'`);
await writeFile(join(outDir, 'frames.txt'), `${list.join('\n')}\n`);

const span = frames.length > 1 ? (frames.at(-1).at - frames[0].at) / 1000 : 0;
process.stdout.write(`${frames.length} frames over ${span.toFixed(1)}s -> ${outDir}\n`);

ws.close();
try {
  process.kill(-chrome.pid, 'SIGTERM');
} catch {
  // Already gone.
}
process.exit(0);
