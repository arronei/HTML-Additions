// Regenerates relation-attribute/spec/images/*.png from relation-attribute/polyfill/demo.html.
//
// Usage:  node tools/relation-screenshots.mjs
//
// Needs Node 22 or later (for the built-in WebSocket) and Chrome. Set CHROME to the browser's path if it isn't
// in a standard location. Each image is the demo's .shot wrapper for one example, at 2x, in the light color scheme.
// The script prints each image's CSS size, which is what the width and height attributes in index.bs should be.
// ponytail: the DevTools client is copied from chart-screenshots.mjs; share a module if a third script needs it.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../relation-attribute/', import.meta.url);
const page = new URL('polyfill/demo.html', root).href;
const out = fileURLToPath(new URL('spec/images/', root));

const chrome = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((path) => path && existsSync(path));
if (!chrome) throw new Error('Chrome not found. Set CHROME to its path.');

const port = 9334;
const profile = mkdtempSync(join(tmpdir(), 'relation-screenshots-'));
const browser = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--hide-scrollbars', 'about:blank']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try {
      target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page');
    } catch {
      await sleep(200);
    }
  }
  if (!target) throw new Error('Chrome did not start.');

  // A minimal DevTools protocol client.
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener('open', resolve));
  let lastId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    pending.get(message.id)?.(message);
    pending.delete(message.id);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++lastId;
    pending.set(id, (message) => (message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result)));
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 2000, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Page.enable');
  await send('Page.navigate', { url: page });
  await sleep(1500);

  const sizes = {};
  await evaluate(`document.querySelector('#shot-linked input').click()`); // The polyfill checks the second one.
  for (const name of ['parent-states', 'linked']) {
    const clip = await evaluate(`(() => {
      const r = document.querySelector('#shot-${name}').getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    })()`);
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
    sizes[name] = `${Math.round(clip.width)}x${Math.round(clip.height)}`;
  }

  console.log(`Wrote ${Object.keys(sizes).length} images to ${out}`);
  console.table(sizes);
  socket.close();
} finally {
  browser.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
