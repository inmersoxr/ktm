import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const base = process.env.KTM_SMOKE_URL || 'http://127.0.0.1:4173/';
const screenshots = 'smoke-results';
await mkdir(screenshots, { recursive: true });
let server;
if (!process.env.KTM_SMOKE_URL) {
  server = spawn('npm', ['run', 'preview', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
  for (let retry = 0; retry < 60; retry++) {
    try {
      const r = await fetch(base);
      if (r.ok) break;
    } catch {}
    if (retry === 59) throw Error('Vite preview never became available');
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
}
const results = [];
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
});
const attach = (page, name) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push('PAGE: ' + error.stack));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text());
  });
  page.on('requestfailed', (request) => errors.push('REQUEST: ' + request.url() + ' ' + request.failure()?.errorText));
  return () => { if (errors.length) console.log(name + ' browser diagnostics:\n' + errors.slice(0, 12).join('\n')); return errors; };
};
async function trial(name, fn) {
  try {
    const details = await fn();
    results.push({ name, ok: true, ...details });
  } catch (e) {
    results.push({ name, ok: false, error: String(e) });
  }
}

try {
  await trial('viewer desktop and model', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
    const getErrors = attach(page, 'viewer');
    const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#view-nav .view-button', { timeout: 20000 });
    let model = false;
    try { await page.waitForSelector('#loader[data-hidden="true"]', { timeout: 45000 }); model = true; } catch {}
    const result = {
      status: response?.status(),
      nav: await page.locator('.view-button').count(),
      model,
      loader: await page.locator('#loader-message').textContent(),
      graphics: await page.evaluate(() => ({ webgpu: !!navigator.gpu, webgl2: !!document.createElement('canvas').getContext('webgl2') })),
      errors: getErrors()
    };
    await page.screenshot({ path: screenshots + '/viewer.png', timeout: 10000 }).catch(() => {});
    await page.close();
    if (!model) throw Error('Model loader did not complete: ' + JSON.stringify(result));
    return result;
  });

  await trial('AR desktop diagnosis', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
    const getErrors = attach(page, 'AR desktop');
    const response = await page.goto(new URL('ar.html', base).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#ar-guide:not([hidden])', { timeout: 25000 });
    const result = {
      status: response?.status(),
      heading: await page.locator('#ar-guide-heading').innerText(),
      message: await page.locator('#ar-guide-message').innerText(),
      action: await page.locator('#ar-start').innerText(),
      errors: getErrors()
    };
    await page.screenshot({ path: screenshots + '/ar-desktop.png' }).catch(() => {});
    await page.close();
    if (result.errors.some((v) => v.startsWith('PAGE:'))) throw Error('AR JS crash: ' + JSON.stringify(result));
    return result;
  });

  await trial('AR Samsung Chrome settings guide', async () => {
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
    });
    const page = await context.newPage();
    const getErrors = attach(page, 'AR Samsung');
    const response = await page.goto(new URL('ar.html', base).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#ar-guide:not([hidden])', { timeout: 25000 });
    await page.locator('#ar-guide-settings').click({ timeout: 10000 });
    const result = {
      status: response?.status(),
      heading: await page.locator('#ar-guide-heading').innerText(),
      chromeInstructionsVisible: await page.locator('#ar-chrome-steps').isVisible(),
      errors: getErrors()
    };
    await page.screenshot({ path: screenshots + '/samsung-guide.png' }).catch(() => {});
    await context.close();
    if (!result.chromeInstructionsVisible || result.errors.some((v) => v.startsWith('PAGE:'))) throw Error('Samsung diagnostics failed: ' + JSON.stringify(result));
    return result;
  });
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log('KTM browser smoke:', JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
