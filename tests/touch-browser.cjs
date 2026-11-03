/* Real multi-touch through Chromium's touch device, with WebGL simulation. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), timeout = 120000;
async function main() {
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4185','--strictPort'],{cwd:root,stdio:'ignore'});let browser;
 try {
  for(let n=0;n<100;n++){try{if((await fetch('http://127.0.0.1:4185')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});page.setDefaultTimeout(timeout);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
  await page.goto('http://127.0.0.1:4185',{waitUntil:'load',timeout});await page.waitForFunction(()=>window.__SLUGTERRA__?.importedModels.ready===7);
  assert.equal(await page.locator('.touch-controls').isVisible(),false);
  await page.getByRole('button',{name:'Settings',exact:true}).tap();await page.locator('#setting-quality').selectOption('low');await page.locator('#setting-sound').uncheck();await page.getByRole('button',{name:'Close dialog',exact:true}).tap();
  await page.locator('#begin-button').tap();if(await page.locator('#confirm-restart').isVisible())await page.locator('#confirm-restart').tap();
  await page.waitForFunction(()=>window.__SLUGTERRA__.mode==='playing');
  await page.evaluate(()=>{for(const e of window.__SLUGTERRA__.enemies){e.dead=true;e.root.visible=false;}});
  fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
  await page.screenshot({path:path.join(root,'test-results/touch-landscape.png'),timeout});
  const cdp=await page.context().newCDPSession(page),points=new Map();
  const center=async selector=>{const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  async function down(id,p){points.set(id,{id,...p,radiusX:5,radiusY:5});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[...points.values()]});}
  async function move(id,p){points.set(id,{...points.get(id),...p});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[...points.values()]});}
  async function up(id){const released=points.get(id);points.delete(id);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[released]});}
  async function cancel(){points.clear();await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});}
  const stick=await center('#touch-stick'),aim=await center('[data-touch-hold=aim]'),fire=await center('#touch-fire');
  const initial=await page.evaluate(()=>({z:window.__SLUGTERRA__.player.z,yaw:window.__SLUGTERRA__.yaw,shots:window.__SLUGTERRA__.combatStats.shots}));
  await down(1,stick);await move(1,{x:stick.x,y:stick.y-36});await down(2,{x:400,y:205});await down(3,aim);await down(4,fire);await move(2,{x:420,y:196});
  await page.waitForFunction(v=>{const g=window.__SLUGTERRA__;return g.player.z>v.z+.65&&g.combatStats.shots>v.shots&&g.aiming&&Math.abs(g.yaw-v.yaw)>.02;},initial);
  assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.touchInput.firing),true);
  await up(4);await page.waitForFunction(()=>!window.__SLUGTERRA__.touchInput.firing);assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.aiming),true);
  const yaw=await page.evaluate(()=>window.__SLUGTERRA__.yaw);await move(2,{x:435,y:196});await page.waitForFunction(y=>window.__SLUGTERRA__.yaw!==y,yaw);
  assert.ok(await page.evaluate(()=>window.__SLUGTERRA__.touchInput.z>.8));await up(3);await page.waitForFunction(()=>!window.__SLUGTERRA__.aiming);
  await cancel();assert.deepEqual(await page.evaluate(()=>window.__SLUGTERRA__.touchInput),{x:0,z:0,firing:false,aiming:false,sprinting:false});
  console.log('PASS: four real touch fingers move, look, aim and fire together; independent releases and touchcancel preserve the other fingers and clear held input');
  const fireYaw=await page.evaluate(()=>window.__SLUGTERRA__.yaw);await down(1,fire);await move(1,{x:fire.x+20,y:fire.y-8});await page.waitForFunction(y=>window.__SLUGTERRA__.yaw!==y,fireYaw);await cancel();
  console.log('PASS: dragging the held FIRE button also looks around, supporting two-thumb combat');
  await page.evaluate(()=>{const g=window.__SLUGTERRA__;g.teleport(8,25);g.lookAt(8,g.player.y,5);});
  const floor=await page.evaluate(()=>window.__SLUGTERRA__.player.y);await page.getByRole('button',{name:'Jump',exact:true}).tap();await page.waitForFunction(y=>window.__SLUGTERRA__.player.y>y+.2,floor);
  await page.evaluate(()=>window.__SLUGTERRA__.teleport(0,32));await page.getByRole('button',{name:'Interact',exact:true}).tap();await page.waitForFunction(()=>window.__SLUGTERRA__.game.state.quest.stage==='shards');
  await page.locator('[data-touch-action=view]').tap();assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.viewMode),'third-person');await page.locator('[data-touch-action=view]').tap();
  await page.locator('#loadout .slug-slot').nth(1).tap();assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.game.state.selectedSlug),1);
  await down(1,stick);await move(1,{x:stick.x,y:stick.y-36});await down(2,await center('[data-touch-hold=sprint]'));assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.touchInput.sprinting),true);
  await down(3,fire);await down(4,await center('[data-touch-action=pause]'));await page.waitForFunction(()=>window.__SLUGTERRA__.mode==='paused');
  assert.deepEqual(await page.evaluate(()=>window.__SLUGTERRA__.touchInput),{x:0,z:0,firing:false,aiming:false,sprinting:false});points.clear();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.locator('#resume-game').tap();assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.touchInput.firing),false);
  console.log('PASS: touchscreen jumping, interaction, view switching, companion selection and sprint work; pausing while holding controls releases everything');
  await down(1,stick);await move(1,{x:stick.x,y:stick.y-36});await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>window.__SLUGTERRA__.display.width===390);assert.equal(await page.evaluate(()=>window.__SLUGTERRA__.touchInput.z),0);await cancel();
  await page.screenshot({path:path.join(root,'test-results/touch-portrait.png'),timeout});
  for(const size of [{width:390,height:844},{width:1024,height:768},{width:844,height:390}]){
   await page.setViewportSize(size);await page.waitForFunction(w=>window.__SLUGTERRA__.display.width===w,size.width);
   const boxes=await page.evaluate(()=>{const bounds=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};};return{stick:bounds('#touch-stick'),fire:bounds('#touch-fire'),dock:bounds('.loadout-wrap'),buttons:[...document.querySelectorAll('.touch-button')].map(b=>{const r=b.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};})};});
   const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
   assert.equal(overlap(boxes.stick,boxes.dock),false,JSON.stringify({size,boxes}));assert.equal(overlap(boxes.fire,boxes.dock),false);
   for(const r of boxes.buttons){assert.ok(r.w>=44&&r.h>=44);assert.ok(r.x>=0&&r.y>=0&&r.x+r.w<=size.width+1&&r.y+r.h<=size.height+1,JSON.stringify({size,r}));}
  }
  console.log('PASS: phone portrait/landscape and tablet controls stay within the viewport, retain 44px targets and do not cover the companion dock; rotation releases the thumbstick');
  assert.deepEqual(errors,[]);await page.close();
  const hybrid=await browser.newPage({viewport:{width:1024,height:768},hasTouch:true});hybrid.setDefaultTimeout(timeout);
  await hybrid.addInitScript(()=>{const original=window.matchMedia.bind(window);window.matchMedia=query=>query.includes('pointer: coarse')?{matches:false,media:query,addEventListener(){},removeEventListener(){}}:original(query);window.__touchLockRequests=0;HTMLCanvasElement.prototype.requestPointerLock=()=>{window.__touchLockRequests++;return Promise.resolve();};});
  await hybrid.goto('http://127.0.0.1:4185',{waitUntil:'load',timeout});await hybrid.waitForFunction(()=>!!window.__SLUGTERRA__);await hybrid.locator('#begin-button').tap();await hybrid.waitForFunction(()=>window.__SLUGTERRA__.mode==='playing');
  assert.equal(await hybrid.locator('#touch-stick').isVisible(),true);assert.equal(await hybrid.evaluate(()=>window.__touchLockRequests),0);await hybrid.close();
  console.log('PASS: a touch-capable device with a fine primary pointer still exposes touch controls and does not capture the mouse on touch start');
 }finally{await browser?.close();server.kill();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
