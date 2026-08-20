#!/usr/bin/env node
/** Probe the handover page's DOM so the recorder targets real selectors. */
import { spawn } from 'node:child_process';

const url = process.argv[2];
const CHROME = `${process.env['HOME']}/.local/bin/google-chrome`;
const PORT = 9344;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--window-size=1440,900',
    '--no-first-run',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=/tmp/chrome-probe-profile',
    'about:blank',
  ],
  { stdio: 'ignore', detached: true },
);
chrome.unref();

let wsUrl;
for (let i = 0; i < 40; i += 1) {
  await sleep(500);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = targets.find((t) => t.type === 'page');
    if (page?.webSocketDebuggerUrl) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {}
}

const ws = new WebSocket(wsUrl);
await new Promise((res) => ws.addEventListener('open', res, { once: true }));

let id = 1;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) =>
  new Promise((res) => {
    const n = id++;
    pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url });
await sleep(4000);

const probe = await send('Runtime.evaluate', {
  expression: `JSON.stringify({
    details: document.querySelectorAll('details').length,
    summaries: document.querySelectorAll('summary').length,
    listItems: document.querySelectorAll('li').length,
    notProvenText: document.body.innerText.includes('Not proven'),
    liWithNotProven: [...document.querySelectorAll('li')].filter(li => /Not proven/i.test(li.innerText||'')).length,
    liWithDetails: [...document.querySelectorAll('li')].filter(li => li.querySelector('details')).length,
    firstNotProvenHasDetails: (() => {
      const li = [...document.querySelectorAll('li')].find(l => /Not proven/i.test(l.innerText||''));
      return li ? !!li.querySelector('details') : 'no-li';
    })(),
    summaryTexts: [...document.querySelectorAll('summary')].slice(0,3).map(s => s.innerText.trim())
  }, null, 1)`,
  returnByValue: true,
});
process.stdout.write(`${probe.result?.value}\n`);

ws.close();
try {
  process.kill(-chrome.pid, 'SIGTERM');
} catch {}
process.exit(0);
