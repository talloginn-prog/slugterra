/* Real input and projectile impact checks for the three new companion powers. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const root=path.resolve(__dirname,'..'),timeout=120000;
async function main(){
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4186','--strictPort'],{cwd:root,stdio:'ignore'});let browser;
 try{
  for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:4186')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:720,height:520}});page.setDefaultTimeout(timeout);const errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
  await page.goto('http://127.0.0.1:4186',{waitUntil:'load',timeout});await page.waitForFunction(()=>window.__SLUGTERRA__?.importedModels.ready===7);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#setting-quality').selectOption('low');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.locator('#begin-button').click();if(await page.locator('#confirm-restart').isVisible())await page.locator('#confirm-restart').click();
  await page.waitForFunction(()=>window.__SLUGTERRA__.mode==='playing');
  await page.keyboard.press('v');await page.waitForSelector('.campaign-collection');await page.keyboard.press('Escape');
  await page.evaluate(async()=>{
   const g=window.__SLUGTERRA__,physics=await import('/src/physics.js');window.__effectTarget=g.enemies.find(e=>!e.boss);window.__effectTarget.hp=10000;
   for(const e of g.enemies)if(e!==window.__effectTarget){e.dead=true;e.root.visible=false;}
   window.__effectTarget.brain.update=()=>({phase:'recovery',move:{x:0,z:0},speedMultiplier:1,telegraph:0});
   window.__aimEffect=()=>{const e=window.__effectTarget;for(const angle of[0,Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4]){g.teleport(e.root.position.x+Math.sin(angle)*6,e.root.position.z+Math.cos(angle)*6);g.lookAt(e.root.position.x,e.root.position.y,e.root.position.z);g.launcher.updateWorldMatrix(true,false);const start=g.launcher.localToWorld(g.blaster.muzzle.clone());if(g.world.collisionWorld.segmentHit(start,e.root.position)===null&&physics.firstTerrainHit(start,e.root.position,g.world.groundHeight,.12)===null)return;}throw Error('No clear effect lane');};
  });
  for(const [id,element]of[['ember','fire'],['doc','healing'],['rammstone','earth'],['frost','ice'],['tide','water'],['volt','electric']]){
   await page.waitForFunction(()=>window.__SLUGTERRA__.game.state.slugs.every(s=>!s.inFlight&&s.cooldown===0));
   await page.evaluate(id=>{const g=window.__SLUGTERRA__;g.game.discoverSlug(id);if(!g.game.state.equippedSlugs.includes(id))g.game.equipSlug(id,0);g.game.state.health=40;window.__effectTarget.burning=0;window.__effectTarget.frozen=0;window.__effectTarget.rooted=0;window.__aimEffect();window.__hp=window.__effectTarget.hp;},id);
   const slot=await page.evaluate(id=>window.__SLUGTERRA__.game.state.equippedSlugs.indexOf(id),id);await page.keyboard.press(String(slot+1));
   assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.launcher.userData.loadedSlugId),id);
   assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.launcher.getObjectByName('Loaded companion inside cartridge').visible),true);
   await page.keyboard.press('f');await page.waitForFunction(()=>window.__effectTarget.hp<window.__hp);
   assert.equal(await page.evaluate(()=>{const g=window.__SLUGTERRA__;return g.launcher.getObjectByName('Loaded companion inside cartridge').visible===!g.game.state.slugs[g.game.state.selectedSlug].inFlight;}),true);
   if(id==='ember')await page.waitForFunction(()=>window.__effectTarget.burning>0&&window.__effectTarget.elementVisual.flame.visible);
   if(id==='frost')await page.waitForFunction(()=>window.__effectTarget.frozen>0&&window.__effectTarget.elementVisual.ice.visible);
   if(id==='doc')assert.ok(await page.evaluate(()=>window.__SLUGTERRA__.game.state.health>=52));
   if(id==='volt')assert.ok(await page.evaluate(()=>window.__effectTarget.stagger>0));
   console.log('PASS: '+id+' real launch/impact elemental effect; cartridge visibility matches companion flight state');
  }
  await page.waitForFunction(()=>window.__SLUGTERRA__.game.state.slugs.every(s=>!s.inFlight&&s.cooldown===0));
  await page.evaluate(()=>{const g=window.__SLUGTERRA__;g.teleport(8,25);g.lookAt(8,g.player.y,5);});
  require('node:fs').mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/loaded-cartridge.png'),timeout});
  await page.keyboard.press('p');await page.screenshot({path:path.join(root,'test-results/cartridge-third-person.png'),timeout});
  assert.deepEqual(errors,[]);console.log('PASS: V opens arsenal; loaded cartridge and first/third-person rendering have no application errors');
 }finally{await browser?.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
