/* Expansion integration: real WebGL, input, recording timing, roaming and gates. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), timeout = 120000;
async function main() {
 const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4182', '--strictPort'], {cwd:root,stdio:'ignore'});
 let browser;
 try {
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4182')).ok)break;}catch{} await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:900,height:600}});page.setDefaultTimeout(timeout);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
  await page.goto('http://127.0.0.1:4182',{waitUntil:'load',timeout});
  await page.waitForFunction(()=>window.__SLUGTERRA__?.importedModels.ready===7,undefined,{timeout});
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.locator('#setting-quality').selectOption('low');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.screenshot({path:path.join(root,'test-results/expansion-menu.png'),timeout});
  await page.locator('#begin-button').click();if(await page.locator('#confirm-restart').isVisible())await page.locator('#confirm-restart').click();
  await page.waitForFunction(()=>window.__SLUGTERRA__.mode==='playing'&&window.__SLUGTERRA__.audio.getStatus().readyBundledClips.length===3,undefined,{timeout});
  await page.evaluate(()=>{const g=window.__SLUGTERRA__;g.teleport(8,25);g.lookAt(8,g.player.y+40,5);window.__patrol=g.enemies.map(e=>({x:e.root.position.x,z:e.root.position.z}));});
  await page.keyboard.press('f');
  await page.waitForFunction(()=>window.__SLUGTERRA__.projectiles.some(p=>!p.hostile&&p.audioShot?.sequenceStarted),undefined,{timeout});
  await page.evaluate(()=>{window.__shot=window.__SLUGTERRA__.projectiles.find(p=>!p.hostile);});
  await page.waitForFunction(()=>window.__shot.morphed,undefined,{timeout});
  const timing=await page.evaluate(()=>({time:window.__shot.morphFlightTime,receipt:window.__shot.audioShot}));
  assert.ok(timing.receipt.sequenceStarted);assert.ok(timing.receipt.shotTime!==null);assert.ok(timing.receipt.morphTime>=timing.receipt.shotTime);
  assert.ok(timing.time>=(44.7-18)/105&&timing.time<(44.7-18)/105+1/120+.0001,JSON.stringify(timing));
  console.log('PASS: supplied recording starts on firing, per-shot receipt reaches morph once at the fixed-step 100mph threshold');
  await page.waitForFunction(()=>window.__SLUGTERRA__.enemies.some((e,i)=>Math.hypot(e.root.position.x-window.__patrol[i].x,e.root.position.z-window.__patrol[i].z)>.7),undefined,{timeout});
  assert.ok(await page.evaluate(()=>window.__SLUGTERRA__.enemies.filter(e=>!e.boss).every(e=>e.root.userData.enemyType==='slinger')));
  await page.evaluate(()=>{const g=window.__SLUGTERRA__;g.teleport(0,28);g.lookAt(0,g.player.y,14);});
  await page.screenshot({path:path.join(root,'test-results/expansion-first-person.png'),timeout});
  await page.keyboard.press('p');
  await page.waitForFunction(()=>window.__SLUGTERRA__.viewMode==='third-person');
  await page.screenshot({path:path.join(root,'test-results/expansion-third-person.png'),timeout});
  console.log('PASS: grounded slingers actually patrol the scene; first/third-person weapons render with the retained P toggle');
  await page.waitForFunction(()=>window.__SLUGTERRA__.game.state.slugs.every(s=>!s.inFlight),undefined,{timeout});
  async function gate(target){
   await page.evaluate(target=>{const g=window.__SLUGTERRA__,p=g.world.interactables.find(i=>i.type==='portal'&&i.target===target);if(!p)throw Error('Missing route '+target);g.teleport(p.position.x,p.position.z+2.6);g.lookAt(p.position.x,p.position.y+1.5,p.position.z);},target);
   await page.keyboard.press('e');await page.waitForFunction(id=>window.__SLUGTERRA__.world.id===id,target,{timeout});
  }
  async function discover(id){
   await page.evaluate(id=>{const g=window.__SLUGTERRA__;for(const e of g.enemies){e.dead=true;e.root.visible=false;}const p=g.world.interactables.find(i=>i.type==='discovery'&&i.slugId===id);if(!p)throw Error('Missing discovery '+id);g.teleport(p.position.x,p.position.z+2.6);},id);
   await page.keyboard.press('e');await page.waitForFunction(id=>window.__SLUGTERRA__.game.state.ownedSlugs.includes(id),id,{timeout});
  }
  await gate('dark-spores');await gate('quiet-lawn');
  await page.screenshot({path:path.join(root,'test-results/quiet-lawn.png'),timeout});
  await discover('arachnet');await discover('fandango');await gate('snowdance');
  await page.screenshot({path:path.join(root,'test-results/snowdance.png'),timeout});
  await discover('rammstone');await gate('pyrite');await gate('luminous');
  console.log('PASS: actual E gates traverse the five-cavern loop; all three new companions are discovered through real interactions');
  await page.keyboard.press('i');assert.equal(await page.locator('.collection-card').count(),9);
  await page.locator('[data-form-toggle="velocimorph"]').click();
  await page.waitForFunction(()=>[...document.querySelectorAll('.collection-art img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:path.join(root,'test-results/expansion-collection.png'),timeout});
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  await page.locator('#setting-aspect-ratio').selectOption('21:9');
  const framed=await page.evaluate(()=>{const g=window.__SLUGTERRA__,r=document.querySelector('#game-canvas').getBoundingClientRect(),a=document.querySelector('#app').getBoundingClientRect();return{aspect:g.camera.aspect,w:r.width,h:r.height,left:r.left,appW:a.width,appH:a.height};});
  assert.ok(Math.abs(framed.aspect-3440/1440)<1e-8);assert.ok(Math.abs(framed.w-framed.h*framed.aspect)<.05);assert.equal(framed.w,framed.appW);assert.equal(framed.h,framed.appH);
  await page.locator('#setting-resolution').selectOption('1920x1080');
  await page.setViewportSize({width:3840,height:1600});
  await page.waitForFunction(()=>window.__SLUGTERRA__.display.width===3440);
  const cap=await page.evaluate(()=>({display:window.__SLUGTERRA__.display,width:document.querySelector('#game-canvas').width,height:document.querySelector('#game-canvas').height}));
  assert.equal(cap.display.height,1440);assert.ok(cap.width<=1920&&cap.height<=1080);assert.ok(cap.width<=3440&&cap.height<=1440);
  await page.setViewportSize({width:390,height:844});await page.locator('#setting-aspect-ratio').selectOption('auto');
  await page.getByRole('button',{name:'Close dialog',exact:true}).click();await page.keyboard.press('i');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:path.join(root,'test-results/expansion-mobile.png'),timeout});
  assert.deepEqual(errors,[]);console.log('PASS: nine-species UI and centered adjustable ultrawide framing fit; actual render resolution is capped and mobile layout has no horizontal overflow');
 } finally {await browser?.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
