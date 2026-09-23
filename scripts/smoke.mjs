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
let desktopPoseSamples = null;
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
    try { await page.waitForFunction(() => document.querySelector('#loader')?.dataset.hidden === 'true', { timeout: 45000 }); model = true; } catch {}
    const hintHidden = model && await page.locator('#gesture-hint').evaluate((element) => getComputedStyle(element).display === 'none');
    let verticalOrbitChangedImage = false;
    let hintDismissedByGesture = false;
    if (model) {
      // The loader hides after the asset initializes; also demand a real
      // rendered motorcycle, not merely a black canvas with visible UI.
      let initialScreenBytes=0;
      for(let attempt=0;attempt<4;attempt++){
        const initial=await page.screenshot({path:screenshots+'/viewer-initial.png',timeout:10000});
        initialScreenBytes=initial.length;
        if(initialScreenBytes>140000)break;
        await page.waitForTimeout(400);
      }
      if(initialScreenBytes<=140000)throw Error('Desktop motorcycle did not render after load; screenshot bytes='+initialScreenBytes);
      const firstHeading = await page.locator('#view-title').innerText();
      if (firstHeading !== 'KTM 390 DUKE') throw Error('Commercial portada missing: ' + firstHeading);
      const before = await page.locator('#app').screenshot();
      await page.mouse.move(640, 420);
      await page.mouse.down();
      await page.mouse.move(640, 245, { steps: 16 });
      await page.mouse.up();
      await page.waitForTimeout(250);
      const after = await page.locator('#app').screenshot();
      verticalOrbitChangedImage = !before.equals(after);
      hintDismissedByGesture = !(await page.locator('#gesture-hint').evaluate((element) => element.classList.contains('is-visible')));
    }
    const beforeZoom = await page.locator('#app').evaluate((el) => ({
      layout:el.dataset.viewerLayout, fov:Number(el.dataset.cameraFov), scale:Number(el.dataset.modelScale)
    }));
    await page.mouse.move(750,460);
    await page.mouse.wheel(0,-140);
    await page.waitForTimeout(250);
    const afterZoom = await page.locator('#app').evaluate((el) => ({
      fov:Number(el.dataset.cameraFov), scale:Number(el.dataset.modelScale)
    }));
    const desktopNavigation = await page.locator('#view-nav').evaluate((nav) => {
      const rect=nav.getBoundingClientRect();
      const label=nav.querySelector('.view-button small');
      return {
        bottom:rect.bottom,viewportHeight:window.innerHeight,
        labels:[...nav.querySelectorAll('.view-button')].map((b)=>b.textContent?.trim()),
        numberBadges:nav.querySelectorAll('.view-button span').length,
        visible:!!label && getComputedStyle(label).opacity==='1',
        fits: nav.scrollWidth <= nav.clientWidth + 2 &&
          [...nav.querySelectorAll('.view-button')].every((b) =>
            b.getBoundingClientRect().right <= rect.right + 1 &&
            b.getBoundingClientRect().left >= rect.left - 1),
        desktopArHidden: getComputedStyle(document.querySelector('#xr-button')).display === 'none'
      };
    });
    const result = {
      status: response?.status(),
      nav: await page.locator('.view-button').count(),
      desktopNavigation,
      beforeZoom,
      afterZoom,
      model,
      hintHidden,
      hintDismissedByGesture,
      verticalOrbitChangedImage,
      loader: await page.locator('#loader-message').textContent(),
      graphics: await page.evaluate(() => ({ webgpu: !!navigator.gpu, webgl2: !!document.createElement('canvas').getContext('webgl2') })),
      errors: getErrors()
    };
    desktopPoseSamples = [];
    for(let i=0;i<8;i++){
      await page.locator('#view-nav .view-button').nth(i).click();
      await page.waitForFunction((viewIndex) => document.querySelector('#app')?.dataset.poseSettled === String(viewIndex),i,{timeout:15000});
      desktopPoseSamples.push(await page.locator('#app').evaluate(el=>({
        pose:JSON.parse(el.dataset.cameraPose ?? '{}'),
        scale:Number(el.dataset.modelScale)
      })));
    }
    result.desktopPoseCount = desktopPoseSamples.length;
    await page.screenshot({ path: screenshots + '/viewer.png', timeout: 10000 }).catch(() => {});
    await page.close();
    if (!model || !hintHidden || !hintDismissedByGesture || !verticalOrbitChangedImage || result.beforeZoom.layout !== 'desktop' || result.beforeZoom.fov !== 75 || result.beforeZoom.scale !== 1 ||
      result.afterZoom.fov !== 75 || result.afterZoom.scale <= 1 || result.desktopPoseCount!==8 ||
      !result.desktopNavigation.visible || !result.desktopNavigation.fits || !result.desktopNavigation.desktopArHidden || result.desktopNavigation.numberBadges !== 0 || result.desktopNavigation.labels.length !== 8 || result.desktopNavigation.bottom < result.desktopNavigation.viewportHeight - 75 || result.errors.some((v) => v.startsWith('PAGE:'))) throw Error('Viewer/nav/gesture failure: ' + JSON.stringify(result));
    return result;
  });


  await trial('viewer mobile navigation to RA', async () => {
    const context = await browser.newContext({
      viewport: { width: 412, height: 915 },
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
    });
    const page = await context.newPage();
    const getErrors = attach(page, 'viewer mobile');
    const response = await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('#loader')?.dataset.hidden === 'true', { timeout: 50000 });
    const nav = await page.locator('#view-nav .view-button').count();
    const mobilePoseSamples=[];
    for(let i=0;i<8;i++){
      await page.locator('#view-nav .view-button').nth(i).click();
      await page.waitForFunction((viewIndex) => document.querySelector('#app')?.dataset.poseSettled === String(viewIndex),i,{timeout:15000});
      mobilePoseSamples.push(await page.locator('#app').evaluate(el=>({
        pose:JSON.parse(el.dataset.cameraPose ?? '{}'),
        scale:Number(el.dataset.modelScale)
      })));
    }
    if(!desktopPoseSamples || desktopPoseSamples.length!==mobilePoseSamples.length)
      throw Error('Missing desktop camera samples for all 8 views');
    for(let i=0;i<8;i++){
      const d=desktopPoseSamples[i],m=mobilePoseSamples[i];
      if(d.scale!==1||m.scale!==1)throw Error('Preset scale mismatched at view '+i);
      for(const key of ['position','target'])for(let axis=0;axis<3;axis++){
        if(!d.pose[key]||!m.pose[key]||Math.abs(d.pose[key][axis]-m.pose[key][axis])>1e-5)
          throw Error('Actual camera differs at view '+i+': '+JSON.stringify({d,m}));
      }
      if(d.pose.fov!==m.pose.fov)throw Error('FOV differs at view '+i);
    }
    const initialHeading = await page.locator('#view-title').innerText();
    const mobileARVisible = await page.locator('#xr-button').isVisible();
    if (!mobileARVisible || initialHeading !== 'KTM 390 DUKE') throw Error('Mobile controls or commercial copy changed');
    await page.locator('#xr-button').click();
    await page.waitForURL('**/ar.html', { timeout: 10000 });
    await page.waitForSelector('#ar-guide:not([hidden])', { timeout: 25000 });
    const result = {
      status: response?.status(), nav, mobileARVisible, initialHeading,
      poseParity:'8/8 actual mobile and desktop views identical',
      arReached: page.url().endsWith('/ar.html'),
      heading: await page.locator('#ar-guide-heading').innerText(), errors: getErrors()
    };
    await page.screenshot({ path: screenshots + '/mobile-ar.png' }).catch(() => {});
    await context.close();
    if (nav !== 8 || !result.arReached || result.errors.some((v) => v.startsWith('PAGE:'))) throw Error('Mobile navigation failure: ' + JSON.stringify(result));
    return result;
  });

  await trial('phone using desktop-site layout', async () => {
    const context=await browser.newContext({
      viewport:{width:1536,height:700},isMobile:true,hasTouch:true,
      userAgent:'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
    });
    const page=await context.newPage();
    const getErrors=attach(page,'phone desktop layout');
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#loader')?.dataset.hidden==='true',{timeout:50000});
    const result=await page.evaluate(()=>{
      const canvas=document.querySelector('#app'),nav=document.querySelector('#view-nav');
      const r=nav.getBoundingClientRect();
      return {
        layout:canvas.dataset.viewerLayout,fov:Number(canvas.dataset.cameraFov),
        scale:Number(canvas.dataset.modelScale),
        arHidden:getComputedStyle(document.querySelector('#xr-button')).display==='none',
        grid:getComputedStyle(nav).display==='grid',
        eightFit:nav.querySelectorAll('.view-button').length===8 &&
          [...nav.querySelectorAll('.view-button')].every(b=>
            b.getBoundingClientRect().left>=r.left-1&&b.getBoundingClientRect().right<=r.right+1),
        helpHidden:getComputedStyle(document.querySelector('#gesture-hint')).display==='none',
        logoBottom:document.querySelector('.brand').getBoundingClientRect().bottom,
        textTop:document.querySelector('#view-copy').getBoundingClientRect().top,
        touch:matchMedia('(pointer:coarse)').matches
      };
    });
    await page.screenshot({path:screenshots+'/viewer-phone-desktop.png'});
    result.errors=getErrors();
    await context.close();
    if(result.layout!=='desktop'||result.fov!==75||result.scale!==1||!result.arHidden||
       !result.grid||!result.eightFit||!result.helpHidden||result.textTop<result.logoBottom+10||
       !result.touch||result.errors.some(e=>e.startsWith('PAGE:'))){
      throw Error('Desktop layout on phone failed: '+JSON.stringify(result));
    }
    return result;
  });
  await trial('normal mobile landscape retains mobile behavior', async () => {
    const context=await browser.newContext({
      viewport:{width:850,height:390},isMobile:true,hasTouch:true,
      userAgent:'Mozilla/5.0 (Linux; Android 15; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36'
    });
    const page=await context.newPage();
    const getErrors=attach(page,'normal mobile landscape');
    await page.goto(base,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#loader')?.dataset.hidden==='true',{timeout:50000});
    const result=await page.evaluate(()=>{
      const canvas=document.querySelector('#app');
      return {layout:canvas.dataset.viewerLayout,scale:Number(canvas.dataset.modelScale),
        fov:Number(canvas.dataset.cameraFov),
        arVisible:getComputedStyle(document.querySelector('#xr-button')).display!=='none'};
    });
    await page.screenshot({path:screenshots+'/viewer-phone-landscape.png'}).catch(()=>{});
    result.errors=getErrors();
    await context.close();
    if(result.layout!=='mobile'||result.scale!==1||result.fov!==75||!result.arVisible||
       result.errors.some(e=>e.startsWith('PAGE:'))){
      throw Error('Normal mobile landscape changed: '+JSON.stringify(result));
    }
    return result;
  });
  await trial('AR desktop diagnosis', async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
    const getErrors = attach(page, 'AR desktop');
    const response = await page.goto(new URL('ar.html', base).href, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('#ar-guide:not([hidden])', { timeout: 25000 });
    const result = {
      status: response?.status(),
      brand: await page.locator('#ar-brand').innerText(),
      modeLabel: await page.locator('#ar-mode-label').innerText(),
      heading: await page.locator('#ar-guide-heading').innerText(),
      message: await page.locator('#ar-guide-message').innerText(),
      action: await page.locator('#ar-start').innerText(),
      errors: getErrors()
    };
    await page.screenshot({ path: screenshots + '/ar-desktop.png' }).catch(() => {});
    await page.close();
    if (!result.brand.includes('KTM') || result.modeLabel !== 'REALIDAD AUMENTADA' || result.errors.some((v) => v.startsWith('PAGE:'))) throw Error('AR branding or JS failure: ' + JSON.stringify(result));
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
    const result = {
      status: response?.status(),
      heading: await page.locator('#ar-guide-heading').innerText(),
      compactRecovery: await page.locator('#ar-guide').evaluate((el) => el.classList.contains('compact')),
      technicalStepsHidden: await page.locator('#ar-guide-steps').isHidden(),
      duplicateStatusHidden: await page.locator('#ar-status').isHidden(),
      brandVisible: await page.locator('#ar-brand').isVisible(),
      errors: getErrors()
    };
    await page.screenshot({ path: screenshots + '/samsung-guide.png' }).catch(() => {});
    await context.close();
    if (!result.compactRecovery || !result.technicalStepsHidden || !result.duplicateStatusHidden || !result.brandVisible || result.errors.some((v) => v.startsWith('PAGE:'))) throw Error('Samsung diagnostics failed: ' + JSON.stringify(result));
    return result;
  });
} finally {
  await browser.close();
  if (server) server.kill();
}
console.log('KTM browser smoke:', JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
