/* Local hosted Worker + real D1. Encrypted fixture cookies are used only on loopback. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
  const root = path.resolve(__dirname, '..'), base = process.env.GAME_URL || 'http://127.0.0.1:4192';
  if (new URL(base).hostname !== '127.0.0.1') throw Error('Account fixtures are restricted to loopback.');
  const fixtureSecret = 'public-loopback-account-qa-fixture-not-a-production-secret';
  const configPath=path.join(root,'dist/server/wrangler.account-qa.json');
  if(!process.env.GAME_URL){const config=JSON.parse(fs.readFileSync(path.join(root,'dist/server/wrangler.json'),'utf8'));config.vars={AUTH_SECRET:fixtureSecret,GOOGLE_CLIENT_ID:'public-test-google-client',GOOGLE_CLIENT_SECRET:'public-test-google-fixture',MICROSOFT_CLIENT_ID:'public-test-ms-client',MICROSOFT_CLIENT_SECRET:'public-test-ms-fixture'};fs.writeFileSync(configPath,JSON.stringify(config));}
  const server = process.env.GAME_URL ? null : spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js','dev','--config',configPath,'--local','--persist-to','.wrangler/state','--ip','127.0.0.1','--port','4192','--inspector-port','0'], {cwd:root,stdio:'ignore',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  let browser;
  try {
    for (let n=0;n<100;n++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
    const { createGameState, CAMPAIGN_SAVE_KEY } = await import('../src/game-state.js');
    const memory = new Map(), game = createGameState({ getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v) });
    game.state.level=5;game.state.kills=12;game.setSetting('quality','low');game.save();
    const seed=JSON.parse(memory.get(CAMPAIGN_SAVE_KEY)), user=`google:browser-${Date.now()}`;
    const {encode}=await import('@auth/core/jwt');const token=await encode({secret:fixtureSecret,salt:'authjs.session-token',token:{sub:user,provider:'google',name:'Fixture Slugslinger'}});
    const headers={cookie:`authjs.session-token=${token}`};
    const sessionCookie={name:'authjs.session-token',value:token,domain:'127.0.0.1',path:'/',httpOnly:true,sameSite:'Lax'};
    const api=async(method='GET',body)=>{const r=await fetch(base+'/api/progress',{method,headers:{...headers,Origin:base,'Content-Type':'application/json','X-Slugterra-Save':'1','X-Slugterra-Account':user},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};};
    assert.equal((await api('PUT',{revision:0,progress:seed})).status,200);
    browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-webgl','--disable-dev-shm-usage']});
    const context=await browser.newContext({viewport:{width:1280,height:800}});await context.addCookies([sessionCookie]);
    await context.addInitScript(()=>{HTMLCanvasElement.prototype.requestPointerLock=()=>Promise.resolve();});
    const page=await context.newPage(), errors=[];page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base);await page.waitForSelector('#continue-button:not([hidden])');await page.waitForFunction(()=>document.querySelector('#account-access')?.dataset.status==='saved');
    await page.locator('#account-access').click();assert.match(await page.locator('#dialog-content').innerText(),/Fixture Slugslinger/);
    assert.equal(await page.locator('.account-signout-form').getAttribute('target'),'_top');assert.equal(await page.locator('.account-signout-form').getAttribute('method'),'post');await page.locator('#dialog-close').click();
    await page.locator('#continue-button').click();await page.waitForSelector('body[data-mode="playing"]');
    await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');await page.keyboard.press('v');
    await page.waitForFunction(()=>document.querySelector('#account-access')?.dataset.status==='saved');
    let cloud=await api();assert.equal(cloud.progress.level,5);assert.equal(cloud.progress.kills,12);assert.ok(cloud.revision>=2);
    console.log('PASS: signed-in cloud journey loads before the menu; real movement/arsenal pause automatically saves through the Worker to D1');
    await page.locator('#dialog-close').click();
    const newer={...cloud.progress,level:8};assert.equal((await api('PUT',{revision:cloud.revision,progress:newer})).status,200);
    await page.locator('#account-access').click();await page.waitForSelector('#use-cloud-save');
    assert.match(await page.locator('.save-comparison').innerText(),/Level 8/);
    await page.locator('#use-cloud-save').click();await page.waitForSelector('body[data-mode="playing"]');assert.equal(await page.locator('#level-label').innerText(),'08');
    console.log('PASS: another device creates a revision conflict; choosing the account journey restores it through the real game controller');
    await context.close();
    const device2=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await device2.addCookies([sessionCookie]);
    const p2=await device2.newPage();p2.setDefaultTimeout(60000);p2.on('pageerror',e=>errors.push(e.message));await p2.goto(base);await p2.waitForSelector('#continue-button:not([hidden])');await p2.locator('#account-access').click();
    assert.match(await p2.locator('#dialog-content').innerText(),/saved to your account/);
    const bounds=await p2.locator('#account-access').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.height>=44);
    fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await p2.screenshot({path:path.join(root,'test-results/account-mobile.png')});
    await device2.close();
    const guest=await browser.newContext({viewport:{width:900,height:650}}), pg=await guest.newPage();pg.setDefaultTimeout(60000);await pg.goto(base);await pg.locator('#account-access').click();
    assert.equal(await pg.locator('a[href="/login/google"]').getAttribute('target'),'_top');assert.equal(await pg.locator('a[href="/login/microsoft"]').getAttribute('target'),'_top');assert.equal(await pg.locator('#continue-button').isVisible(),false);
    assert.match(await pg.locator('#dialog-content').innerText(),/Sign in directly with Google or Microsoft/);
    assert.deepEqual(errors,[]);console.log('PASS: fresh mobile device resumes the same encrypted account session; anonymous visitors see direct Google/Microsoft links and no account progress');
  } finally {await browser?.close();server?.kill('SIGTERM');if(!process.env.GAME_URL)fs.rmSync(configPath,{force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
