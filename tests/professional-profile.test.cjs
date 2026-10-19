const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const storage = () => { const m = new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v),removeItem:k=>m.delete(k)}; };
  const nodes = new Map();
  const node = id => {if(!nodes.has(id)) nodes.set(id,{hidden:false,textContent:'',innerHTML:'',dataset:{},value:'',querySelector(){return node('header');}});return nodes.get(id);};
  const c = {window:{addEventListener(){}},localStorage:storage(),sessionStorage:storage(),structuredClone,crypto:require('node:crypto').webcrypto,URL,URLSearchParams,location:{search:'',replace(url){this.href=url;}},document:{body:{dataset:{page:'login'}},currentScript:{src:'https://example.test/SchoolAdmin/js/app.js'},addEventListener(){},getElementById:node,querySelector:s=>node(s),querySelectorAll:()=>[]}};
  vm.createContext(c);
  for(const [file,name] of [['data','SchoolData'],['teacher-professional','SchoolProfessional'],['app','SchoolApp'],['interactions','SchoolActivities']]) {
    vm.runInContext(fs.readFileSync(`js/${file}.js`,'utf8'),c);
    c[name]=c.window[name];
  }
  return {c,node};
}
function addRecord(c,node,type,values,attachment,editId) {
  c.document.body.dataset.page='teacher-record-form';c.location.search=`?type=${type}${editId?`&id=${editId}`:""}`;
  const controls=Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{value,dataset:{}}]));
  {
    controls.attachment={value:'',dataset:{},files:[],click(){}};
    Object.assign(node('field-attachment'),controls.attachment);
    controls.attachment=node('field-attachment');
  }
  node('professional-form').elements={namedItem:k=>controls[k]};
  c.SchoolProfessional.init({id:'noura-mohammed',role:'teacher'});
  if(attachment) {controls.attachment.files=[{name:attachment,type:'application/pdf',size:123456}];controls.attachment.onchange();}
  node('professional-form').onsubmit({preventDefault(){}});
  assert.match(c.location.href,/saved=1/);
  return controls;
}
test('teacher quick login, saves, logout, admin review, latest data and isolated records', async()=>{
  const {c,node}=setup();
  await c.SchoolData.demoLogin('teacher');
  assert.equal(c.SchoolProfessional.hasProfile('noura-mohammed'),true);
  addRecord(c,node,'attended-courses',{title:'دورة اختبار',organization:'جهة تجريبية',date:'2026-10-19',duration:'ساعتان',courseType:'عن بعد',place:'منصة تجريبية',notes:'ملاحظات الدورة'});
  addRecord(c,node,'peer-visits',{visitor:'معلمة زائرة',date:'2026-10-19',period:'الثانية',subject:'الرياضيات',grade:'الثالث'},'زيارة-صفية.pdf');
  await c.SchoolData.logout();assert.equal(await c.SchoolData.session(),null);
  await c.SchoolData.demoLogin('admin');
  c.document.body.dataset.page='profile';c.location.search='?teacher=noura-mohammed';
  assert.equal((await c.SchoolApp.guard()).role,'admin');
  await c.SchoolActivities.initProfile(await c.SchoolData.session());
  const html=node('admin-professional-profile').innerHTML;
  assert.match(html,/DEMO-NOURA/);assert.match(html,/دورة اختبار/);assert.match(html,/ملاحظات الدورة/);
  assert.match(html,/معلمة زائرة/);assert.match(html,/📎 زيارة-صفية.pdf/);
  assert.equal((html.match(/class="ui-card admin-professional-counter"/g)||[]).length,7);
  assert.equal((html.match(/<strong>1<\/strong>/g)||[]).length,2);
  assert.equal((html.match(/لا توجد بيانات مسجلة في هذا القسم./g)||[]).length,5);
  assert.doesNotMatch(html,/<input|<button|download=|href="data:/);
  assert.equal(node('.activities-toolbar').hidden,true);
  const other=await c.SchoolProfessional.getTeacherProfessionalData('hana-ali');assert.equal(other.records.peerVisits.length,0);
  const latest=JSON.parse(c.localStorage.getItem('teacherRecords'));latest['noura-mohammed'].workshops=[{title:'ورشة جديدة',notes:'<script>unsafe</script>'}];c.localStorage.setItem('teacherRecords',JSON.stringify(latest));
  await c.SchoolProfessional.renderAdminProfile(node('admin-professional-profile'),'noura-mohammed');
  assert.match(node('admin-professional-profile').innerHTML,/ورشة جديدة/);assert.match(node('admin-professional-profile').innerHTML,/&lt;script&gt;/);
  await c.SchoolProfessional.renderAdminProfile(node('admin-professional-profile'),'hana-ali');
  assert.match(node('admin-professional-profile').innerHTML,/غير مسجل/);
  assert.doesNotMatch(node('admin-professional-profile').innerHTML,/دورة اختبار/);
  await assert.rejects(c.SchoolProfessional.getTeacherProfessionalData('missing'));
});
test('teachers cannot read admin professional data or access another teacher through the legacy profile URL', async()=>{
  const {c,node}=setup();await c.SchoolData.demoLogin('teacher');
  await assert.rejects(c.SchoolProfessional.getTeacherProfessionalData('hana-ali'));
  await assert.rejects(c.SchoolProfessional.getTeacherProfessionalData('noura-mohammed'));
  c.location.search='?teacher=hana-ali';await c.SchoolActivities.initProfile(await c.SchoolData.session());
  assert.equal(node('activities-title').textContent,'نورة محمد');
  assert.equal(node('admin-professional-profile').innerHTML,'');
  await c.SchoolData.logout();await assert.rejects(c.SchoolProfessional.getTeacherProfessionalData('noura-mohammed'));
});
test('legacy activities remain separate and older peer visit information stays visible', async()=>{
  const {c,node}=setup();await c.SchoolData.demoLogin('admin');
  await c.SchoolData.saveActivity({title:'نشاط سابق',type:'نشاط',date:'2026-10-19',description:'وصف'},'noura-mohammed');
  c.localStorage.setItem('teacherRecords',JSON.stringify({'noura-mohammed':{peerVisits:[{host:'مزارة قديمة',lesson:'درس قديم',notes:'ملاحظة قديمة'}]}}));
  c.location.search='?teacher=noura-mohammed';await c.SchoolActivities.initProfile(await c.SchoolData.session());
  assert.equal(node('legacy-activities-title').hidden,false);assert.match(node('activities-list').innerHTML,/نشاط سابق/);
  const html=node('admin-professional-profile').innerHTML;
  assert.match(html,/مزارة قديمة/);assert.match(html,/درس قديم/);assert.match(html,/ملاحظة قديمة/);assert.match(html,/لا يوجد مرفق/);
  assert.doesNotMatch(html,/نشاط سابق/);
});

const categoryCases = [
  ['peer-visits','peerVisits',['visitor','date','period','subject','grade']],
  ['workshops','workshops',['title','topic','place','date','audience','role','notes']],
  ['principal-visits','principalVisits',['date','subject','grade','period','lesson','notes','recommendations']],
  ['vice-principal-visits','vicePrincipalVisits',['date','subject','grade','period','lesson','notes','recommendations']],
  ['guided-reading','guidedReading',['title','topic','date','audience','description','notes']],
  ['presented-courses','presentedCourses',['title','organization','date','duration','audience','place','notes']],
  ['attended-courses','attendedCourses',['title','organization','date','duration','courseType','place','notes']]
];
for(const [type,key,fields] of categoryCases) test(type+': attachment save, list, admin, edit, remove, no file, deletion and old data',async()=>{
  const {c,node}=setup();c.confirm=()=>true;
  const values=Object.fromEntries(fields.map(k=>[k,k==='date'?'2026-10-19':'Demo '+k]));
  const records=()=>JSON.parse(c.localStorage.getItem('teacherRecords'))['noura-mohammed'][key];
  const submit=()=>node('professional-form').onsubmit({preventDefault(){}});
  const openList=()=>{c.document.body.dataset.page='teacher-records';c.location.search='?type='+type;c.SchoolProfessional.init({id:'noura-mohammed',role:'teacher'});return node('professional-content').innerHTML;};
  await c.SchoolData.demoLogin('teacher');
  c.document.body.dataset.page='teacher-dashboard';c.SchoolProfessional.init(await c.SchoolData.session());
  assert.ok(node('professional-content').innerHTML.includes('type='+type));
  addRecord(c,node,type,values,'evidence-'+type+'.pdf');
  const formHtml=node('professional-content').innerHTML;
  assert.equal((formHtml.match(/type="file"/g)||[]).length,1);
  assert.match(formHtml,/إرفاق ملف \/ إثبات/);
  assert.match(formHtml,/accept=".pdf,.jpg,.jpeg,.png/);
  assert.deepEqual(JSON.parse(JSON.stringify(records()[0].attachment)),{name:'evidence-'+type+'.pdf',type:'application/pdf',size:123456});
  assert.ok(openList().includes('📎 evidence-'+type+'.pdf'));
  assert.match(node('professional-content').innerHTML,/>المرفق</);
  await c.SchoolData.logout();await c.SchoolData.demoLogin('admin');
  c.location.search='?teacher=noura-mohammed';await c.SchoolActivities.initProfile(await c.SchoolData.session());
  assert.ok(node('admin-professional-profile').innerHTML.includes('📎 evidence-'+type+'.pdf'));
  await c.SchoolData.logout();await c.SchoolData.demoLogin('teacher');
  const id=records()[0].id;
  const controls=addRecord(c,node,type,values,null,id);
  assert.equal(records()[0].attachment.name,'evidence-'+type+'.pdf');
  controls.attachment.files=[];controls.attachment.onchange();submit();assert.equal(records()[0].attachment.name,'evidence-'+type+'.pdf');
  controls.attachment.files=[{name:'bad.exe',type:'application/octet-stream',size:1}];controls.attachment.onchange();submit();assert.equal(records()[0].attachment.name,'evidence-'+type+'.pdf');
  controls.attachment.files=[{name:'replacement.PNG',type:'image/png',size:42,data:'must not persist'}];controls.attachment.onchange();submit();
  assert.deepEqual(JSON.parse(JSON.stringify(records()[0].attachment)),{name:'replacement.PNG',type:'image/png',size:42});
  node('professional-attachment-remove').onclick();submit();assert.equal(records()[0].attachment,null);
  addRecord(c,node,type,values);assert.equal(records()[1].attachment,null);
  // Legacy records without attachment metadata still render in lists and admin tables.
  const all=JSON.parse(c.localStorage.getItem('teacherRecords'));delete all['noura-mohammed'][key][1].attachment;
  c.localStorage.setItem('teacherRecords',JSON.stringify(all));assert.match(openList(),/لا يوجد مرفق/);
  node('professional-content').onclick({target:{closest:()=>({dataset:{delete:id}})}});
  assert.equal(records().length,1);assert.equal(records().some(r=>r.id===id),false);
  await c.SchoolData.logout();await c.SchoolData.demoLogin('admin');
  await c.SchoolProfessional.renderAdminProfile(node('admin-professional-profile'),'noura-mohammed');
  assert.match(node('admin-professional-profile').innerHTML,/لا يوجد مرفق/);
});
test('legacy peer attachmentName is displayed, migrated on edit, and can be removed',async()=>{
 const {c,node}=setup();await c.SchoolData.demoLogin('teacher');
 c.localStorage.setItem('teacherRecords',JSON.stringify({'noura-mohammed':{peerVisits:[{id:'old',attachmentName:'old.pdf'}]}}));
 const values={visitor:'Demo',date:'2026-10-19',period:'1',subject:'Math',grade:'3'};
 addRecord(c,node,'peer-visits',values,null,'old');
 let saved=JSON.parse(c.localStorage.getItem('teacherRecords'))['noura-mohammed'].peerVisits[0];
 assert.equal(saved.attachment.name,'old.pdf');assert.equal(Object.hasOwn(saved,'attachmentName'),false);
 node('professional-attachment-remove').onclick();node('professional-form').onsubmit({preventDefault(){}});
 saved=JSON.parse(c.localStorage.getItem('teacherRecords'))['noura-mohammed'].peerVisits[0];assert.equal(saved.attachment,null);
});
