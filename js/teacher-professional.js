/* Teacher professional record prototype. All data is scoped to the session teacher ID. */
window.SchoolProfessional = (() => {
  const stages = ['الطفولة المبكرة', 'الابتدائية', 'المتوسطة', 'الثانوية'];
  const field = (key, label, type = 'text', required = true) => ({key, label, type, required});
  const notes = () => field('notes', 'الملاحظات', 'textarea', false);
  const date = () => field('date', 'التاريخ', 'date');
  const lesson = () => [date(), field('subject','المادة'), field('grade','الصف'), field('period','الحصة'), field('lesson','موضوع الدرس'), notes(), field('recommendations','التوصيات','textarea',false)];
  const categories = [
    {type:'peer-visits', key:'peerVisits', title:'الزيارات التبادلية', icon:'↔', fields:[field('visitor','اسم المعلمة الزائرة'),field('host','اسم المعلمة المزارة'),field('subject','المادة'),field('grade','الصف'),date(),field('period','الحصة'),field('lesson','موضوع الدرس'),notes()], columns:['host','subject','date','grade']},
    {type:'workshops', key:'workshops', title:'ورش العمل', icon:'⚒', fields:[field('title','اسم الورشة'),field('topic','موضوع الورشة'),field('place','الجهة / المكان'),date(),field('audience','الفئة المستهدفة'),field('role','دور المعلمة'),notes()], columns:['title','date','place']},
    {type:'principal-visits', key:'principalVisits', title:'زيارات المديرة', icon:'▣', fields:lesson(), columns:['date','subject','grade']},
    {type:'vice-principal-visits', key:'vicePrincipalVisits', title:'زيارات الوكيلة', icon:'✓', fields:lesson(), columns:['date','subject','grade']},
    {type:'guided-reading', key:'guidedReading', title:'أنشطة القراءة الموجهة', icon:'▤', fields:[field('title','عنوان النشاط'),field('topic','الموضوع'),date(),field('audience','الفئة المستهدفة'),field('description','وصف مختصر','textarea'),notes()], columns:['title','date','audience']},
    {type:'presented-courses', key:'presentedCourses', title:'الدورات التي قدمتها المعلمة', icon:'♧', fields:[field('title','اسم الدورة'),field('organization','الجهة المستفيدة'),date(),field('duration','مدة الدورة'),field('audience','الفئة المستهدفة'),field('place','المكان'),notes()], columns:['title','date','audience']},
    {type:'attended-courses', key:'attendedCourses', title:'الدورات التي حضرتها المعلمة', icon:'◇', fields:[field('title','اسم الدورة'),field('organization','الجهة المقدمة'),date(),field('duration','مدة الدورة'),field('courseType','نوع الدورة'),field('place','المكان / المنصة'),notes()], columns:['title','organization','date']}
  ];
  const profileFields = [field('name','الاسم'),field('civilRegistration','رقم السجل المدني'),field('employeeNumber','الرقم الوظيفي'),field('specialty','التخصص'),field('stage','المرحلة','select'),field('subjects','مواد التدريس'),field('workload','النصاب','number')];
  function read(key) {
    const raw = localStorage.getItem(key);
    if (raw === null) return {};
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error('تعذر قراءة البيانات المحلية. لم يتم تغيير البيانات المحفوظة.'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('تنسيق البيانات المحلية غير صالح.');
    return value;
  }
  function write(key,value) {
    try { localStorage.setItem(key,JSON.stringify(value)); }
    catch { throw new Error('تعذر حفظ البيانات. تحققي من توفر مساحة التخزين في المتصفح.'); }
  }
  function hasProfile(id) {
    const p = read('teacherProfile')[id];
    return Boolean(p && profileFields.every(f=>String(p[f.key] ?? '').trim()) && stages.includes(p.stage));
  }
  const esc = value => SchoolApp.escape(value);
  const link = (page,category,extra={}) => SchoolApp.url(`pages/${page}.html`,{type:category.type,...extra});
  function input(f,value='',disabled=false) {
    const attrs = `id="field-${f.key}" name="${f.key}" ${f.required?'required':''} ${disabled?'disabled':''}`;
    const control = f.type === 'textarea' ? `<textarea ${attrs} maxlength="3000">${esc(value)}</textarea>` : f.type === 'select' ? `<select ${attrs}><option value="">اختاري المرحلة</option>${stages.map(s=>`<option ${s===value?'selected':''}>${s}</option>`).join('')}</select>` : `<input ${attrs} type="${f.type}" value="${esc(value)}" ${f.type==='number'?'min="0" max="60" step="1"':f.type==='text'?'maxlength="200"':''}>`;
    return `<div class="form-field ${f.type==='textarea'?'form-field--full':''}"><label for="field-${f.key}">${f.label}${!f.required?' (اختياري)':''}</label>${control}</div>`;
  }
  function values(form,fields) {
    const data = Object.fromEntries(fields.map(f=>[f.key,form.elements.namedItem(f.key).value.trim()]));
    if(fields.some(f=>f.required&&!data[f.key])) throw new Error('يرجى إكمال جميع الحقول المطلوبة.');
    return data;
  }
  function formMarkup(title,fields,data={},view=false,back='teacher-dashboard.html',save='حفظ') {
    return `<div class="activity-form-shell"><div class="activity-form-card"><header class="form-header"><h1>${esc(title)}</h1></header><form id="professional-form" class="activity-form"><div class="form-grid">${fields.map(f=>input(f,data[f.key],view)).join('')}</div><p id="professional-status" class="form-status" role="alert"></p><div class="form-actions"><a class="secondary-button" href="${esc(back)}">العودة</a>${view?'':`<button class="ui-button ui-button--primary" type="submit">${save}</button>`}</div></form></div></div>`;
  }
  function init(user) {
    const page = document.body.dataset.page;
    const root = document.getElementById('professional-content');
    if(page==='teacher-info') {
      root.innerHTML = formMarkup('بيانات المعلمة',profileFields,read('teacherProfile')[user.id],false,'teacher-dashboard.html','حفظ ومتابعة');
      root.querySelector('.form-header').insertAdjacentHTML('beforeend','<p>يمكنك تعديل بياناتك لاحقًا من صفحتك الرئيسية.</p><p>نسخة تجريبية؛ استخدمي بيانات وهمية فقط. افصلي مواد التدريس بفاصلة.</p>');
      const form = document.getElementById('professional-form');
      form.onsubmit = event => {
        event.preventDefault();
        try {
          const data = values(form,profileFields);
          if(!stages.includes(data.stage) || !Number.isInteger(Number(data.workload)) || Number(data.workload)<0 || Number(data.workload)>60) throw new Error('تحققي من المرحلة والنصاب (من 0 إلى 60).');
          const profiles = read('teacherProfile');
          profiles[user.id] = {...data,teacherId:user.id,updatedAt:new Date().toISOString()};
          write('teacherProfile',profiles);
          location.href='teacher-dashboard.html';
        } catch(error) { SchoolApp.status('professional-status',error.message); }
      };
      return;
    }
    const all = read('teacherRecords');
    const records = all[user.id] || {};
    if(page==='teacher-dashboard') {
      const profile=read('teacherProfile')[user.id];
      root.innerHTML=`<header class="activities-heading"><div><p class="eyebrow" id="teacher-welcome">مرحبًا، ${esc(profile.name)}</p><h1>السجل المهني للمعلمة</h1></div></header><section class="ui-card professional-summary" aria-label="بيانات المعلمة"><dl>${profileFields.filter(f=>!['civilRegistration','employeeNumber'].includes(f.key)).map(f=>`<div><dt>${f.label}</dt><dd>${esc(profile[f.key])}</dd></div>`).join('')}</dl><a class="ui-button" href="teacher-info.html">عرض / تعديل بياناتي</a></section><section class="professional-grid" aria-label="فئات السجل المهني">${categories.map(c=>`<a class="profile-card" href="${esc(link('teacher-records',c))}" data-category="${c.type}"><span class="profile-card__icon" aria-hidden="true">${c.icon}</span><div class="profile-card__content"><h2>${c.title}</h2><p><strong data-count>${(records[c.key]||[]).length}</strong> عدد السجلات</p></div><span class="profile-card__link">عرض وإضافة ←</span></a>`).join('')}</section>`;
      return;
    }
    const params=new URLSearchParams(location.search);
    const category=categories.find(c=>c.type===params.get('type'));
    if(!category) {root.innerHTML='<div class="empty-state empty-state--inline"><h1>الفئة غير موجودة</h1><a class="ui-button" href="teacher-dashboard.html">العودة إلى السجل المهني</a></div>';return;}
    document.getElementById('breadcrumb-current').textContent=` / ${category.title}`;
    document.title=`${category.title} | السجل المهني`;
    const list=records[category.key] || [];
    function persist(next) {
      // Re-read at save time so changes in other categories/tabs are preserved.
      const latest=read('teacherRecords');
      latest[user.id] = {...Object.fromEntries(categories.map(c=>[c.key,[]])),...latest[user.id],[category.key]:next};
      write('teacherRecords',latest);
    }
    if(page==='teacher-records') {
      function render() {
        const current=read('teacherRecords')[user.id]?.[category.key] || [];
        root.innerHTML=`<header class="activities-heading"><div><p class="eyebrow">السجل المهني</p><h1>${category.title}</h1></div><a class="ui-button ui-button--primary" href="${esc(link('teacher-record-form',category))}">+ إضافة جديد</a></header>${current.length?`<section class="teachers-panel"><div class="table-scroll" tabindex="0" role="region" aria-label="سجلات ${category.title}"><table class="teachers-table professional-table"><caption class="visually-hidden">${category.title}</caption><thead><tr>${category.columns.map(k=>`<th scope="col">${category.fields.find(f=>f.key===k).label}</th>`).join('')}<th scope="col">التفاصيل</th></tr></thead><tbody>${current.slice().reverse().map(r=>`<tr>${category.columns.map(k=>`<td>${esc(r[k])}</td>`).join('')}<td><div class="row-actions"><a class="secondary-button" href="${esc(link('teacher-record-form',category,{id:r.id,mode:'view'}))}">عرض</a><a class="secondary-button" href="${esc(link('teacher-record-form',category,{id:r.id}))}">تعديل</a><button class="secondary-button delete-button" data-delete="${esc(r.id)}" type="button">حذف</button></div></td></tr>`).join('')}</tbody></table></div></section>`:`<div class="empty-state empty-state--inline"><p class="empty-state__title">لا توجد بيانات مسجلة حتى الآن</p><div class="empty-state__actions"><a class="ui-button ui-button--primary" href="${esc(link('teacher-record-form',category))}">إضافة أول سجل</a></div></div>`}`;
      }
      root.onclick=event=>{
        const button=event.target.closest('[data-delete]');
        if(!button || !confirm('هل أنتِ متأكدة من حذف هذا السجل؟')) return;
        try {persist((read('teacherRecords')[user.id]?.[category.key]||[]).filter(r=>r.id!==button.dataset.delete));render();SchoolApp.status('global-status','تم حذف السجل بنجاح',false);}
        catch(error){SchoolApp.status('global-status',error.message);}
      };
      render();
      if(params.get('saved')==='1') SchoolApp.status('global-status','تم حفظ البيانات بنجاح',false);
      return;
    }
    const id=params.get('id');
    const record=id?list.find(r=>r.id===id):null;
    const back=link('teacher-records',category);
    if(id&&!record){root.innerHTML=`<div class="empty-state"><h1>السجل غير موجود</h1><a class="ui-button" href="${esc(back)}">العودة إلى السجلات</a></div>`;return;}
    const view=params.get('mode')==='view';
    root.innerHTML=formMarkup(`${view?'عرض':id?'تعديل':'إضافة سجل'} — ${category.title}`,category.fields,record||{},view,back);
    if(view) return;
    const form=document.getElementById('professional-form');
    form.onsubmit=event=>{
      event.preventDefault();
      try {
        const data=values(form,category.fields);
        const current=read('teacherRecords')[user.id]?.[category.key]||[];
        if(id&&!current.some(r=>r.id===id)) throw new Error('السجل لم يعد متاحًا. عودي إلى قائمة السجلات.');
        const now=new Date().toISOString();
        const saved={...data,id:id||crypto.randomUUID(),teacherId:user.id,createdAt:record?.createdAt||now,updatedAt:now};
        persist(id?current.map(r=>r.id===id?saved:r):[...current,saved]);
        location.href=link('teacher-records',category,{saved:'1'});
      } catch(error){SchoolApp.status('professional-status',error.message);}
    };
  }
  window.addEventListener('storage',event=>{if(['teacherProfile','teacherRecords'].includes(event.key)) location.reload();});
  return {hasProfile,init};
})();
