const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const timeout=120000;
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4179','--strictPort'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:4179')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await browser.newPage({viewport:{width:640,height:480}});p.setDefaultTimeout(timeout);const errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await p.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
  await p.goto('http://127.0.0.1:4179',{waitUntil:'load',timeout});await p.waitForFunction(()=>!!window.__SLUGTERRA__);
  await p.waitForFunction(()=>window.__SLUGTERRA__.importedModels.ready===7,undefined,{timeout});
  await p.getByRole('button',{name:'Settings',exact:true}).click();await p.locator('#setting-quality').selectOption('low');await p.locator('#setting-sound').uncheck();await p.getByRole('button',{name:'Close dialog',exact:true}).click();
  await p.locator('#begin-button').click();if(await p.locator('#confirm-restart').isVisible())await p.locator('#confirm-restart').click();
  await p.waitForFunction(()=>window.__SLUGTERRA__.mode==='playing');
  assert.equal(await p.evaluate(()=>window.__SLUGTERRA__.world.collisionReady),true);
  assert.equal(await p.evaluate(()=>window.__SLUGTERRA__.blaster.group.userData.importedWeapon),true);
  assert.equal(await p.evaluate(()=>!!window.__SLUGTERRA__.world.importedGuide),true);
  assert.equal(await p.evaluate(()=>window.__SLUGTERRA__.blaster.muzzle.z),-.553);
  console.log('PASS: all seven uploaded runtime assets load; authored weapon, companions and Eli integrate without changing the muzzle');
  await p.evaluate(()=>{const g=window.__SLUGTERRA__;g.teleport(11,31.5);g.lookAt(11,g.player.y,42);window.__walkTime=0;const tick=g.character.step;g.character.step=(dt,input)=>{window.__walkTime+=dt;return tick(dt,input);};});
  await p.keyboard.down('w');await p.waitForFunction(()=>window.__walkTime>2);await p.keyboard.up('w');
  const stopped=await p.evaluate(()=>({x:window.__SLUGTERRA__.player.x,z:window.__SLUGTERRA__.player.z}));
  assert.ok(stopped.z>32 && stopped.z<33.6,JSON.stringify(stopped));
  await p.keyboard.down('w');await p.keyboard.down('d');await p.evaluate(()=>window.__walkTime=0);await p.waitForFunction(()=>window.__walkTime>1.3);await p.keyboard.up('w');await p.keyboard.up('d');
  assert.ok(await p.evaluate(x=>Math.abs(window.__SLUGTERRA__.player.x-x)>2,stopped.x),'diagonal input slides around the solid counter');
  console.log('PASS: real keyboard movement cannot pass through the merchant counter and slides around its edge');
  const rock=await p.evaluate(()=>{
   const g=window.__SLUGTERRA__;let mesh;g.world.group.traverse(o=>{if(o.isInstancedMesh&&o.geometry.type==='DodecahedronGeometry'&&o.count>200)mesh=o;});if(!mesh)throw Error('Stepping stones missing');
   const matrix=g.camera.matrixWorld.clone().identity();mesh.getMatrixAt(233,matrix);const v=g.player.clone().setFromMatrixPosition(matrix);mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
   g.player.set(v.x,box.max.y+3.85,v.z);g.character.reset();return {ground:g.world.groundHeight(v.x,v.z)};
  });
  await p.waitForFunction(()=>window.__SLUGTERRA__.character.grounded,undefined,{timeout});
  assert.ok(await p.evaluate(ground=>window.__SLUGTERRA__.player.y-1.85>ground+.5,rock.ground),'the player lands on the visible rock instead of falling through to terrain');
  await p.keyboard.press('Space');await p.waitForFunction(()=>!window.__SLUGTERRA__.character.grounded);await p.waitForFunction(()=>window.__SLUGTERRA__.character.grounded);
  console.log('PASS: falling lands on an actual instanced stepping stone; jumping and stable support still work');
  await p.evaluate(()=>{const g=window.__SLUGTERRA__;g.teleport(20,28);});await p.keyboard.press('e');await p.waitForFunction(()=>window.__SLUGTERRA__.world.id==='dark-spores');
  assert.ok(await p.evaluate(()=>window.__SLUGTERRA__.world.collisionWorld.triangleCount>10000));
  await p.evaluate(()=>{const g=window.__SLUGTERRA__;g.teleport(0,36);});await p.keyboard.press('e');await p.waitForFunction(()=>window.__SLUGTERRA__.world.id==='luminous');
  console.log('PASS: solid portal frames retain traversable openings and real E travel works both directions');
  await p.evaluate(()=>{const g=window.__SLUGTERRA__;g.teleport(8,41);g.lookAt(8,g.world.groundHeight(8,44)+1.2,44);});
  fs.mkdirSync('test-results',{recursive:true});await p.screenshot({path:'test-results/uploaded-models-in-game.png',timeout});
  assert.deepEqual(errors,[]);console.log('PASS: geometry collision and uploaded models render with no application errors');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
