/* Real input and projectile impact checks for the three new companion powers. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const path = require('node:path');
const root=path.resolve(__dirname,'..'),timeout=120000;
async function main(){
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4183','--strictPort'],{cwd:root,stdio:'ignore'});let browser;
 try{
  for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:4183')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:720,height:520}});page.setDefaultTimeout(timeout);const errors=[];
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
  await page.goto('http://127.0.0.1:4183',{waitUntil:'load',timeout});await page.waitForFunction(()=>window.__SLUGTERRA__?.importedModels.ready===7);
  await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#setting-quality').selectOption('low');await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  await page.locator('#begin-button').click();if(await page.locator('#confirm-restart').isVisible())await page.locator('#confirm-restart').click();
  await page.waitForFunction(()=>window.__SLUGTERRA__.mode==='playing');
  await page.evaluate(async()=>{
   const g=window.__SLUGTERRA__,physics=await import('/src/physics.js');
   for(const [slot,id]of ['fandango','arachnet','rammstone'].entries()){g.game.discoverSlug(id);g.game.equipSlug(id,slot);}
   window.__powerEnemy=g.enemies.find(e=>!e.boss);window.__powerEnemy.hp=10000;
   for(const enemy of g.enemies){if(enemy!==window.__powerEnemy){enemy.dead=true;enemy.root.visible=false;}}
   // A stationary target isolates companion powers; roaming is checked separately.
   window.__powerEnemy.brain.update=()=>({phase:'recovery',move:{x:0,z:0},speedMultiplier:1,telegraph:0});
   let clear=false;for(const angle of [0,Math.PI/2,-Math.PI/2,Math.PI,Math.PI/4,-Math.PI/4]){
    const enemy=window.__powerEnemy;g.teleport(enemy.root.position.x+Math.sin(angle)*6,enemy.root.position.z+Math.cos(angle)*6);g.lookAt(enemy.root.position.x,enemy.root.position.y,enemy.root.position.z);g.launcher.updateWorldMatrix(true,false);
    const start=g.launcher.localToWorld(g.blaster.muzzle.clone()),end=enemy.root.position.clone();
    if(g.world.collisionWorld.segmentHit(start,end)===null&&physics.firstTerrainHit(start,end,g.world.groundHeight,.12)===null){clear=true;break;}
   }if(!clear)throw Error('Power fixture needs a visible target');g.game.state.shield=0;
  });
  await page.keyboard.press('1');await page.keyboard.press('f');await page.waitForFunction(()=>window.__SLUGTERRA__.game.state.energyBoost>0);
  assert.ok(await page.evaluate(()=>window.__SLUGTERRA__.game.state.shield>=14));
  await page.keyboard.press('2');await page.keyboard.press('f');await page.waitForFunction(()=>window.__powerEnemy.rooted>0);
  assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.game.state.energyBoost),0);
  assert.ok(await page.evaluate(()=>window.__powerEnemy.webEffect?.visible));
  const bound=await page.evaluate(()=>{window.__powerBound=window.__powerEnemy.root.position.clone();return window.__powerEnemy.rooted;});
  await page.waitForFunction(t=>window.__powerEnemy.rooted<t-.15,bound);
  assert.ok(await page.evaluate(()=>window.__powerEnemy.root.position.distanceTo(window.__powerBound)<.01));
  console.log('PASS: actual Fandango shot restores shield and boosts the next shot once; Arachnet impacts visibly bind and stop the target');
  await page.waitForFunction(()=>window.__powerEnemy.rooted===0);
  await page.evaluate(()=>{const g=window.__SLUGTERRA__,e=window.__powerEnemy;g.lookAt(e.root.position.x,e.root.position.y,e.root.position.z);window.__beforeRam=e.root.position.clone();});
  await page.keyboard.press('3');await page.keyboard.press('f');await page.waitForFunction(()=>window.__powerEnemy.stagger>.8);
  assert.ok(await page.evaluate(()=>window.__powerEnemy.root.position.distanceTo(window.__beforeRam)>.2));
  assert.deepEqual(errors,[]);console.log('PASS: a real Rammstone impact staggers and displaces a grounded target through solid-world collision');
 }finally{await browser?.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
