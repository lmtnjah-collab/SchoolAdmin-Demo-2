/* Dependency-free Chrome regression test. Temporary static server only; no app backend. */
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const {once}=require('node:events');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const prefix='/SchoolAdmin-Demo-2';
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(!pathname.startsWith(prefix+'/')) return res.writeHead(404).end();
  const file=path.resolve(root,'.'+pathname.slice(prefix.length));
  if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}${prefix}`;
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'schooladmin-test-'));
 const chrome=process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
 const proc=spawn(chrome,['--headless=new','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
 let ws;
 try {
  const endpoint=await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>reject(new Error('Chrome startup timed out')),20000);proc.on('error',reject);proc.stderr.on('data',chunk=>{output+=chunk;const match=output.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});});
  const port=new URL(endpoint).port;
  const tabs=await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await once(ws,'open');
  let seq=0;const pending=new Map();const errors=[];const badLinks=[];
  ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(new Error(msg.error.message)):p.resolve(msg.result);}if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.text+': '+msg.params.exceptionDetails.exception?.description);if(msg.method==='Network.responseReceived'&&msg.params.response.status>=400&&msg.params.response.url.startsWith(base)&&!msg.params.response.url.endsWith('favicon.ico'))badLinks.push(msg.params.response.url);if(msg.method==='Page.javascriptDialogOpening')send('Page.handleJavaScriptDialog',{accept:true});});
  function send(method,params={}){return new Promise((resolve,reject)=>{const id=++seq;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timed out: '+method));},15000);pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});ws.send(JSON.stringify({id,method,params}));});}
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  async function js(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
  async function wait(expression){const end=Date.now()+10000;while(Date.now()<end){try{if(await js(expression))return;}catch{}await new Promise(r=>setTimeout(r,60));}throw new Error('Timed out: '+expression);}
  async function go(p){await send('Page.navigate',{url:base+p});await wait(`location.href===${JSON.stringify(base+p)} && document.readyState==='complete'`);await wait(`document.querySelector('main:not([hidden])')`);}
  async function click(selector){await js(`document.querySelector(${JSON.stringify(selector)}).click()`);}
  async function fill(data){await js(`Object.entries(${JSON.stringify(data)}).forEach(([id,value])=>{document.getElementById(id).value=value;document.getElementById(id).dispatchEvent(new Event('input',{bubbles:true}));})`);}
  async function login(name,civil,page){await go('/index.html');await fill({'login-name':name,'login-civil':civil});await click('#login-form button');await wait(`location.pathname.endsWith('/${page}.html') && document.querySelector('main:not([hidden])')`);}
  async function logout(){await click('#logout-button');await wait(`location.pathname.endsWith('/index.html') && document.querySelector('main:not([hidden])')`);}
  const teacherData={'field-name':'معلمة تجريبية','field-civilRegistration':'1000000001','field-employeeNumber':'DEMO-01','field-specialty':'الرياضيات','field-stage':'الابتدائية','field-subjects':'الرياضيات، العلوم','field-workload':'18'};
  console.log('Browser ready; starting teacher flow.');
  await login('noura','1000000001','teacher-info');
  await click('#professional-form button[type=submit]');assert.ok(await js(`location.pathname.endsWith('teacher-info.html')`));
  await fill(teacherData);await click('#professional-form button[type=submit]');await wait(`document.querySelectorAll('[data-category]').length===7`);
  assert.equal(await js(`document.documentElement.dir`),'rtl');
  const types=await js(`Array.from(document.querySelectorAll('[data-category]'),a=>a.dataset.category)`);
  for(const type of types){ console.log('Checking '+type);
   await click(`[data-category="${type}"]`);await wait(`document.querySelector('.empty-state__title')?.textContent.includes('لا توجد')`);
   assert.ok(await js(`location.pathname.endsWith('teacher-records.html')`));
   await click('.activities-heading a');await wait(`document.getElementById('professional-form')`);
   await js(`document.querySelectorAll('#professional-form input, #professional-form textarea').forEach(el=>{el.value=el.type==='date'?'2026-10-17':'بيانات تجريبية '+el.name;})`);
   await click('#professional-form button[type=submit]');await wait(`document.querySelector('.professional-table tbody tr')`);
   assert.ok(await js(`document.getElementById('global-status').textContent.includes('تم حفظ البيانات بنجاح')`));
   await send('Page.reload');await wait(`document.querySelector('.professional-table tbody tr')`);
   await click('.row-actions a');await wait(`document.querySelector('#professional-form input:disabled')`);
   assert.equal(await js(`document.querySelectorAll('#professional-form button[type=submit]').length`),0);
   await click('.form-actions a');await wait(`document.querySelector('.row-actions')`);await click('.row-actions a:nth-child(2)');await wait(`document.querySelector('#professional-form input:not(:disabled)')`);
   await fill({'field-notes':'ملاحظات معدلة'});await click('#professional-form button[type=submit]');await wait(`document.querySelector('.professional-table tbody tr')`);
   await click('.professional-breadcrumb a');await wait(`document.querySelector('[data-category]')`);
   assert.equal(await js(`document.querySelector('[data-category="${type}"] [data-count]').textContent`),'1');
  }
  await go('/pages/teacher-info.html');assert.equal(await js(`document.getElementById('field-name').value`),'معلمة تجريبية');
  await fill({'field-name':'معلمة تجريبية معدلة'});await click('#professional-form button[type=submit]');await wait(`document.getElementById('teacher-welcome')?.textContent.includes('معدلة')`);
  assert.deepEqual(await js(`Array.from(document.querySelectorAll('[data-count]'),n=>n.textContent)`),Array(7).fill('1'));
  for(const width of [1440,768,390]) {
   await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   for(const p of ['/pages/teacher-dashboard.html','/pages/teacher-info.html','/pages/teacher-records.html?type=attended-courses','/pages/teacher-record-form.html?type=attended-courses']){
    await go(p);assert.ok(await js(`document.documentElement.scrollWidth<=innerWidth`),`${width}: ${p}`);
    if(p.includes('dashboard')){const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(os.tmpdir(),`schooladmin-teacher-${width}.png`),Buffer.from(screenshot.data,'base64'));}
   }
  }
  await go('/pages/teacher-records.html?type=attended-courses');await click('[data-delete]');await wait(`document.querySelector('.empty-state__title')`);
  await go('/pages/teacher-dashboard.html');assert.equal(await js(`document.querySelector('[data-category="attended-courses"] [data-count]').textContent`),'0');
  await logout();await login('noura','1000000001','teacher-dashboard');await logout();
  await login('hana','1000000002','teacher-info');await fill({...teacherData,'field-name':'معلمة ثانية','field-civilRegistration':'1000000002'});await click('#professional-form button[type=submit]');await wait(`document.querySelector('[data-count]')`);
  assert.deepEqual(await js(`Array.from(document.querySelectorAll('[data-count]'),n=>n.textContent)`),Array(7).fill('0'));
  await go('/pages/teacher-record-form.html?type=unknown');assert.ok(await js(`document.body.textContent.includes('الفئة غير موجودة')`));
  await logout();await login('admin','1000000000','admin-dashboard');
  for(const p of ['/pages/admin-dashboard.html','/pages/teachers.html','/pages/permissions.html','/pages/teacher-profile.html?teacher=noura-mohammed','/pages/activity-details.html?teacher=noura-mohammed'])await go(p);
  await fill({'activity-title':'نشاط إداري تجريبي','activity-type':'مبادرة','activity-date':'2026-10-17'});await click('#save-activity-button');await wait(`document.querySelector('.activity-card')`);
  await click('.activity-card__content');await wait(`document.getElementById('activity-title')?.value==='نشاط إداري تجريبي'`);
  await fill({'activity-notes':'تعديل الإدارة'});await click('#save-activity-button');await wait(`document.querySelector('.activity-card')`);await click('[data-delete]');await wait(`document.getElementById('activities-empty-state')?.hidden===false`);
  assert.deepEqual(errors,[]);assert.deepEqual(badLinks,[]);
  console.log('PASS: first/repeat login, profile validation/edit, all seven category add/view/edit/list/count flows, deletion, refresh persistence, separate teacher accounts, RTL, desktop/tablet/mobile overflow, GitHub Pages subpath, admin pages and activity CRUD, zero JavaScript errors or broken requests.');
  console.log('Screenshots: '+path.join(os.tmpdir(),'schooladmin-teacher-{1440,768,390}.png'));
 }finally{if(ws)ws.close();proc.kill();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
