/* Browser regression tests; provide PLAYWRIGHT_MODULE if Playwright is not installed locally.
   The HTTP server below only serves static files for this test and is not an application backend. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const http=require('node:http');
const assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'})[path.extname(file)]||'application/octet-stream');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try {
  browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',d=>d.accept());
  const base=`http://127.0.0.1:${server.address().port}`;
  const go=p=>page.goto(base+p);
  const waitText=(id,text)=>page.waitForFunction(([id,text])=>document.getElementById(id)?.textContent.includes(text),[id,text]);
  async function login(name,civil){await go('/index.html');await page.fill('#login-name',name);await page.fill('#login-civil',civil);await page.click('#login-form button');}
  async function logout(){await page.click('#logout-button');await page.waitForURL('**/index.html');}
  async function activity(title){await page.fill('#activity-title',title);await page.selectOption('#activity-type','مبادرة');await page.fill('#activity-date','2026-09-27');await page.click('#save-activity-button');}
  await go('/pages/teachers.html');await page.waitForURL('**/index.html');
  await login('admin','bad');await waitText('login-status','غير صحيحة');
  await login('admin','1000000000');await page.waitForURL('**/admin-dashboard.html');
  assert.equal(await page.locator('.profile-card').count(),2);
  await page.screenshot({path:path.join(os.tmpdir(),'schooladmin-dashboard.png'),fullPage:true});
  await page.click('a[href="teachers.html"]');await page.waitForSelector('#teachers-body tr');
  assert.equal(await page.locator('#teachers-body tr').count(),3);
  assert.ok(!(await page.locator('#teachers-body').innerText()).includes('1000000001'));
  await page.fill('#teacher-search-input','الرياضيات');assert.equal(await page.locator('#teachers-body tr').count(),1);
  await page.fill('#teacher-search-input','لا يوجد');assert.equal(await page.locator('#teachers-body tr').count(),0);
  await page.fill('#teacher-search-input','');
  await page.click('#add-teacher');
  await page.fill('#person-name','معلمة اختبار');await page.fill('#person-job','علوم');await page.fill('#person-username','test');await page.fill('#person-civil','1234567890');await page.click('#person-form button[type=submit]');
  await page.waitForFunction(()=>document.querySelectorAll('#teachers-body tr').length===4);
  let row=page.locator('tr').filter({hasText:'معلمة اختبار'});
  await row.locator('[data-edit]').click();await page.fill('#person-job','الفنون');await page.click('#person-form button[type=submit]');await waitText('teachers-body','الفنون');
  await row.locator('[data-toggle]').click();await waitText('teachers-body','غير نشطة');
  await row.locator('[data-toggle]').click();await page.waitForFunction(()=>!document.getElementById('teachers-body').textContent.includes('غير نشطة'));
  await row.locator('a').click();await page.waitForURL('**/teacher-profile.html?teacher=*');
  const teacherUrl=page.url(); const teacherId=new URL(teacherUrl).searchParams.get('teacher');
  await page.click('#add-activity-button');await page.waitForSelector('#activity-form');
  await page.setInputFiles('#activity-attachment',{name:'sample.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});
  await activity('نشاط إداري');await page.waitForURL('**/teacher-profile.html?teacher=*');await waitText('activities-list','نشاط إداري');
  await page.reload();await waitText('activities-list','نشاط إداري');
  await page.locator('.activity-card__content').click();await page.waitForSelector('#attachment-current a');
  assert.equal(await page.locator('#activity-title').inputValue(),'نشاط إداري');
  const activityUrl=page.url();
  await page.fill('#activity-notes','ملاحظة محفوظة');await page.click('#save-activity-button');await page.waitForURL('**/teacher-profile.html?teacher=*');
  await go('/pages/activity-details.html?teacher=hana-ali&activity='+new URL(activityUrl).searchParams.get('activity'));await waitText('activity-page-title','غير متاحة');assert.equal(await page.locator('#activity-form').isVisible(),false);
  await go('/pages/teacher-profile.html?teacher=missing');await waitText('activities-title','غير موجودة');assert.equal(await page.locator('#add-activity-button').isVisible(),false);
  await go('/pages/permissions.html');await page.waitForSelector('[data-user]');
  let permission=page.locator('.permission-row').filter({hasText:'معلمة اختبار'});await permission.locator('button').click();await permission.getByText('سحب الصلاحية').waitFor();
  await permission.locator('button').click();await permission.getByText('منح صلاحية إدارية').waitFor();
  await page.click('#add-admin');await page.fill('#person-name','إدارية جديدة');await page.fill('#person-job','إدارة');await page.fill('#person-username','manager');await page.fill('#person-civil','1111111111');await page.click('#person-form button[type=submit]');await waitText('permissions-list','إدارية جديدة');
  await logout();await login('manager','1111111111');await page.waitForURL('**/admin-dashboard.html');await logout();
  await login('test','1234567890');await page.waitForURL('**/activity-details.html');
  assert.equal(await page.locator('select').count(),1);
  await go('/pages/activity-details.html?teacher=hana-ali');await waitText('activity-page-subtitle','معلمة اختبار');
  await activity('نشاط المعلمة');await waitText('activity-form-status','بنجاح');
  const own=await page.evaluate(()=>JSON.parse(localStorage.getItem('schoolAdminActivities')).find(a=>a.title==='نشاط المعلمة'));
  assert.equal(own.teacherId,teacherId);
  for(const p of ['/pages/admin-dashboard.html','/pages/teachers.html','/pages/permissions.html']) {
   await go(p);await page.waitForURL(base+'/pages/activity-details.html');await page.waitForSelector('#activity-form');
  }
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(os.tmpdir(),'schooladmin-mobile-activity.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await logout();await page.screenshot({path:path.join(os.tmpdir(),'schooladmin-mobile-login.png'),fullPage:true});
  await login('admin','1000000000');await page.waitForURL('**/admin-dashboard.html');
  for(const p of ['/pages/admin-dashboard.html','/pages/teachers.html','/pages/permissions.html','/pages/teacher-profile.html?teacher='+teacherId]) {await go(p);await page.waitForSelector('main:not([hidden])');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),p);}
  await page.screenshot({path:path.join(os.tmpdir(),'schooladmin-mobile-profile.png'),fullPage:true});
  await page.locator('[data-delete]').first().click();await page.waitForFunction(()=>document.querySelectorAll('.activity-card').length===1);
  await go('/pages/teachers.html');await page.waitForSelector('#teachers-body tr');await page.screenshot({path:path.join(os.tmpdir(),'schooladmin-mobile-teachers.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(os.tmpdir(),'schooladmin-teachers.png'),fullPage:true});
  row=page.locator('tr').filter({hasText:'معلمة اختبار'});await row.locator('[data-toggle]').click();await waitText('teachers-body','غير نشطة');await logout();await login('test','1234567890');await waitText('login-status','غير نشط');
  // Exact requested flows, using the original demo accounts and UI navigation.
  await login('noura','1000000001');await page.waitForURL('**/activity-details.html');
  await activity('نشاط نورة من حسابها');await waitText('activity-form-status','بنجاح');
  await page.click('#teacher-activities-link');await page.waitForURL('**/teacher-profile.html');
  await waitText('activities-list','نشاط نورة من حسابها');
  assert.equal(await page.locator('.activity-card').count(),1);
  assert.equal(await page.locator('[data-delete]').count(),0);
  await page.locator('.activity-card__content').click();await page.waitForSelector('#activity-title:disabled');
  assert.equal(await page.locator('#activity-title').inputValue(),'نشاط نورة من حسابها');
  assert.equal(await page.locator('#delete-activity-button').isVisible(),false);
  assert.equal(await page.locator('#save-activity-button').isVisible(),false);
  await page.click('#activity-back-link');await waitText('activities-list','نشاط نورة من حسابها');
  await logout();
  console.log('TEST 1 PASS: noura login -> add -> success -> My Activities -> own read-only details.');

  await login('admin','1000000000');await page.waitForURL('**/admin-dashboard.html');
  await page.click('a[href="teachers.html"]');await page.getByRole('link',{name:'نورة محمد',exact:true}).click();
  await page.waitForURL('**/teacher-profile.html?teacher=noura-mohammed');
  await waitText('activities-list','نشاط نورة من حسابها');
  assert.equal(await page.locator('#activity-form').count(),0);
  assert.equal(await page.locator('#activities-title').innerText(),'نورة محمد');
  assert.ok((await page.locator('#activities-subtitle').innerText()).includes('الرياضيات'));
  await page.click('#add-activity-button');await page.waitForURL('**/activity-details.html?teacher=noura-mohammed');
  await activity('نشاط نورة من الإدارة');await page.waitForURL('**/teacher-profile.html?teacher=noura-mohammed');
  await waitText('activities-list','نشاط نورة من الإدارة');
  assert.equal(await page.locator('.activity-card').count(),2);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('schoolAdminSession.v1')),'vice-principal');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('schoolAdminActivities')).find(a=>a.title==='نشاط نورة من الإدارة').teacherId),'noura-mohammed');
  console.log('TEST 2 PASS: admin -> teachers -> Noura list -> explicit add -> Noura list; admin session unchanged.');

  await page.click('#activities-back-link');await page.getByRole('link',{name:'هناء علي',exact:true}).click();
  await page.waitForURL('**/teacher-profile.html?teacher=hana-ali');await page.waitForSelector('#activities-empty-state:not([hidden])');
  assert.equal(await page.locator('.activity-card').count(),0);
  await page.click('#add-activity-button');await activity('نشاط هناء فقط');await page.waitForURL('**/teacher-profile.html?teacher=hana-ali');
  await waitText('activities-list','نشاط هناء فقط');assert.equal(await page.locator('.activity-card').count(),1);
  assert.ok(!(await page.locator('#activities-list').innerText()).includes('نورة'));
  const hanaDetail=await page.locator('.activity-card__content').getAttribute('href');
  await logout();
  console.log('TEST 3 PASS: another teacher shows only her own activities, with no Noura activities.');

  await login('noura','1000000001');await page.waitForURL('**/activity-details.html');
  await go('/pages/teacher-profile.html?teacher=hana-ali');await waitText('activities-list','نشاط نورة من الإدارة');
  assert.equal(await page.locator('.activity-card').count(),2);
  assert.ok(!(await page.locator('#activities-list').innerText()).includes('نشاط هناء فقط'));
  await page.goto(hanaDetail);await waitText('activity-page-title','غير متاحة');
  assert.equal(await page.locator('#activity-form').isVisible(),false);
  await page.click('#activity-back-link');await waitText('activities-list','نشاط نورة من حسابها');
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.locator('#teacher-activities-link').isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(os.tmpdir(),'schooladmin-my-activities-mobile.png'),fullPage:true});
  await page.click('#teacher-add-link');await page.waitForURL('**/activity-details.html');
  assert.ok(await page.locator('#activity-title').isEnabled());
  assert.deepEqual(errors,[]);
  console.log('PASS: login/redirects, teacher CRUD, permissions, activity ownership, attachments, deletion, persistence, direct URL guards, desktop/mobile overflow, zero runtime errors.');
  console.log('Screenshots: '+os.tmpdir()+'\\schooladmin-*.png');
 } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
