// Regenerates chart-element/spec/images/*.png from chart-element/polyfill/demo.html.
//
// Usage:  node tools/chart-screenshots.mjs
//
// Needs Node 22 or later (for the built-in WebSocket) and Chrome. Set CHROME to the browser's path if it isn't
// in a standard location. Each image is the demo's .shot wrapper for one example, at 2x, in the light color scheme.
// The script prints each image's CSS size, which is what the width and height attributes in index.bs should be.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../chart-element/', import.meta.url);
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

const port = 9333;
const profile = mkdtempSync(join(tmpdir(), 'chart-screenshots-'));
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

  // Tall enough that every example is inside the viewport, so mouse events reach it.
  await send('Emulation.setDeviceMetricsOverride', { width: 800, height: 6000, deviceScaleFactor: 2, mobile: false });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }); // Otherwise :focus-visible never matches.
  await send('Page.enable');
  await send('Page.navigate', { url: page });
  await sleep(1500);

  const rectOf = (selector) => evaluate(`(() => {
    const r = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  })()`);
  const moveMouse = (x, y) => send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  const pressKey = async (key, keyCode) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, windowsVirtualKeyCode: keyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: keyCode });
  };

  const sizes = {};
  async function shoot(name, selector, prepare) {
    await moveMouse(790, 5); // Clear any hover from the previous shot.
    if (prepare) {
      await prepare();
      await sleep(400); // Let transitions finish.
    }
    const clip = await rectOf(selector);
    const { data } = await send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    writeFileSync(join(out, `${name}.png`), Buffer.from(data, 'base64'));
    sizes[name] = `${Math.round(clip.width)}x${Math.round(clip.height)}`;
  }

  await shoot('intro-bar', '#shot-intro-bar', async () => {
    const bar = await rectOf('#intro-bar series:last-of-type data:nth-of-type(2)');
    await moveMouse(bar.x + bar.width / 2, bar.y + bar.height / 2);
  });
  await shoot('intro-pie', '#shot-intro-pie');
  await shoot('show-values', '#shot-show-values');
  await shoot('line-gap', '#shot-line-gap');
  await shoot('stacked-area', '#shot-stacked-area');
  await shoot('horizontal', '#shot-horizontal');
  await shoot('hover-wedge', '#shot-hover-wedge', async () => {
    // The Oranges wedge runs from 42% to 72% of the way around, so its middle is at 57%, a third of the way in.
    const pie = await rectOf('#hover-pie data:nth-of-type(2)');
    const angle = 0.57 * 2 * Math.PI;
    await moveMouse(pie.x + pie.width / 2 + (pie.width / 3) * Math.sin(angle), pie.y + pie.height / 2 - (pie.height / 3) * Math.cos(angle));
  });
  await shoot('keyboard', '#shot-show-values', async () => {
    await evaluate(`document.querySelector('#revenue data').focus()`);
    await pressKey('ArrowRight', 39);
    await pressKey('ArrowDown', 40);
  });
  await evaluate('document.activeElement.blur()');
  await shoot('fallback', '#shot-fallback');

  console.log(`Wrote ${Object.keys(sizes).length} images to ${out}`);
  console.table(sizes);
  socket.close();
} finally {
  browser.kill();
  await sleep(500);
  rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
