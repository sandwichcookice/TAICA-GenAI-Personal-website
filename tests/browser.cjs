// Run against a local server or the published Pages URL with an installed Chromium.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {mkdirSync}=require('node:fs');
const {join}=require('node:path');
const url=process.env.SITE_URL||'http://127.0.0.1:8000/';
const screenshots=process.env.SCREENSHOT_DIR;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],...(process.env.HTTPS_PROXY?{proxy:{server:process.env.HTTPS_PROXY,bypass:'127.0.0.1,localhost'}}:{})});
 try {
  for(const {width,height} of [{width:320,height:900},{width:390,height:844},{width:768,height:900},{width:1280,height:720},{width:1280,height:900}]){
   const context=await browser.newContext({viewport:{width,height},timezoneId:'America/Los_Angeles'});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url,{waitUntil:'domcontentloaded'});
   const hero=await page.locator('.playground').boundingBox(),settings=await page.locator('#settings').boundingBox();
   assert.ok(settings.y>=hero.y+hero.height,`settings below main interaction at ${width}`);
   assert.equal(await page.locator('.restaurant-card').count(),53);
   const shell=await page.locator('.wheel-shell').boundingBox(),stage=await page.locator('.wheel-stage').boundingBox();
   assert.ok(shell.y>=stage.y&&shell.y+shell.height<=stage.y+stage.height+1,`wheel must not be clipped at ${width}`);
   if(width>=768){const wheel=await page.locator('.roulette').boundingBox(),map=await page.locator('.map-panel').boundingBox(),button=await page.locator('#spin').boundingBox();assert.ok(wheel.x+wheel.width<=map.x);assert.ok(button.y+button.height<=height);assert.ok(map.y+map.height<=height);}
   await page.selectOption('#timeMode','at');await page.fill('#atTime','2026-10-19T18:00');await page.locator('#atTime').dispatchEvent('change');
   assert.equal(await page.evaluate(()=>state.pool.length),15);
   await page.locator('#spin').focus();await page.keyboard.press('Enter');
   assert.equal(await page.locator('#budget').isDisabled(),true);
   await page.waitForFunction(()=>!state.spinning);
   const first=await page.evaluate(()=>state.lastId);
   const drawnShell=await page.locator('.wheel-shell').boundingBox(),drawnStage=await page.locator('.wheel-stage').boundingBox();
   assert.ok(drawnShell.y>=drawnStage.y&&drawnShell.y+drawnShell.height<=drawnStage.y+drawnStage.height+1,`drawn wheel clipped at ${width}`);
   assert.match(await page.locator('#wheelTitle').textContent(),/今天就吃/);
   assert.match(await page.locator('#liveStatus').textContent(),/本次抽中/);
   assert.ok((await page.locator('#map').getAttribute('src')).includes(encodeURIComponent(await page.evaluate(()=>state.result.r.name))));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow at ${width}`);
   const result=await page.locator('#result').boundingBox(),map=await page.locator('.map-frame').boundingBox();
   assert.ok(result.y>=map.y+map.height,`result details below main map at ${width}`);
   await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#spin').click();
   assert.notEqual(await page.evaluate(()=>state.lastId),first);
   await page.selectOption('#listMode','all');assert.equal(await page.locator('.restaurant-card').count(),66);
   const pool=await page.evaluate(()=>state.pool.map(r=>r.id).join());await page.fill('#search','大頭');
   assert.equal(await page.locator('.restaurant-card').count(),1);assert.equal(await page.evaluate(()=>state.pool.map(r=>r.id).join()),pool);
   await page.fill('#search','');
   if(screenshots){await page.evaluate(()=>scrollTo(0,0));mkdirSync(screenshots,{recursive:true});await page.screenshot({path:join(screenshots,`width-${width}-${height}.png`),fullPage:true});}
   await page.fill('#atTime','2026-10-20T00:01');await page.locator('#atTime').dispatchEvent('change');
   assert.equal(await page.locator('#spin').isDisabled(),true);assert.equal(await page.evaluate(()=>state.filters.range),'near');
   await page.selectOption('#timeMode','any');
   // External map failures must not prevent a local draw.
   await context.setOffline(true);await page.locator('#spin').click();assert.equal(await page.evaluate(()=>state.spinning),false);
   assert.deepEqual(errors,[]);console.log(`PASS ${width}×${height}: keyboard, animation, no-repeat, filters, layout and offline draw`);
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
