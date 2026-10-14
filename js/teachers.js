window.SchoolTeachers = (() => {
  const el = id => document.getElementById(id);
  const esc = value => SchoolApp.escape(value);
  function setupDialog(save, refresh) {
    const dialog = el('person-dialog');
    let selected = null;
    el('close-person').onclick = () => dialog.close();
    el('person-form').onsubmit = async event => {
      event.preventDefault();
      const button = event.submitter;
      button.disabled = true;
      try {
        await save({ name: el('person-name').value, job: el('person-job').value, username: el('person-username').value, civilRegistration: el('person-civil').value }, selected);
        dialog.close();
        await refresh();
        SchoolApp.status('global-status', 'تم حفظ البيانات بنجاح.', false);
      } catch (error) { SchoolApp.status('person-status', error.message); }
      finally { button.disabled = false; }
    };
    return (title, person = null) => {
      selected = person?.id || null;
      el('person-form').reset();
      el('person-dialog-title').textContent = title;
      el('person-status').textContent = '';
      for (const [field, key] of [['name','name'],['job','job'],['username','username'],['civil','civilRegistration']]) el(`person-${field}`).value = person?.[key] || '';
      dialog.showModal();
      el('person-name').focus();
    };
  }
  async function initTeachers() {
    let teachers = [];
    function render() {
      const query = el('teacher-search-input').value.trim().toLocaleLowerCase('ar');
      const filtered = teachers.filter(t => `${t.name} ${t.job}`.toLocaleLowerCase('ar').includes(query));
      el('teachers-count').textContent = teachers.length;
      el('teachers-empty').hidden = filtered.length > 0;
      el('teachers-body').innerHTML = filtered.map(t => `<tr class="teacher-row"><td><div class="teacher-identity__details"><a class="teacher-name-link" href="${esc(SchoolApp.url('pages/teacher-profile.html', { teacher: t.id }))}">${esc(t.name)}</a><span class="teacher-identity__role">${t.active ? 'نشطة' : 'غير نشطة'}${t.role === 'admin' ? ' · صلاحية إدارية' : ''}</span></div></td><td><span class="specialization-badge">${esc(t.job)}</span></td><td><div class="row-actions"><button class="profile-button" data-edit="${esc(t.id)}">تعديل</button><button class="secondary-button ${t.active ? 'delete-button' : ''}" data-toggle="${esc(t.id)}">${t.active ? 'تعطيل' : 'تفعيل'}</button></div></td></tr>`).join('');
    }
    async function refresh() { teachers = await SchoolData.listTeachers(); render(); }
    const open = setupDialog((input, id) => SchoolData.saveTeacher(input, id), refresh);
    el('add-teacher').onclick = () => open('إضافة معلمة');
    el('teacher-search-input').oninput = render;
    el('teachers-body').onclick = async event => {
      const button = event.target.closest('button');
      if (!button) return;
      try {
        if (button.dataset.edit) open('تعديل بيانات المعلمة', await SchoolData.getTeacher(button.dataset.edit));
        if (button.dataset.toggle) {
          const teacher = teachers.find(t => t.id === button.dataset.toggle);
          if (!confirm(`${teacher.active ? 'تعطيل' : 'تفعيل'} حساب ${teacher.name}؟ ستبقى الأنشطة محفوظة.`)) return;
          await SchoolData.setTeacherActive(teacher.id, !teacher.active);
          await refresh();
          SchoolApp.status('global-status', 'تم تحديث حالة الحساب.', false);
        }
      } catch (error) { SchoolApp.status('global-status', error.message); }
    };
    await refresh();
  }
  async function initPermissions(actor) {
    let users = [];
    async function refresh() {
      users = await SchoolData.listUsers();
      el('permissions-list').innerHTML = users.map(u => `<article class="ui-card permission-row"><div><h2>${esc(u.name)}</h2><p>${esc(u.job)} · ${u.role === 'admin' && u.active ? 'صلاحية إدارية' : u.active ? 'معلمة' : 'حساب غير نشط'}</p></div>${u.id === actor.id ? '<span class="ui-badge">حسابك الحالي</span>' : (u.active || !u.isTeacher) ? `<button class="${u.role === 'admin' ? 'secondary-button delete-button' : 'ui-button ui-button--primary'}" data-user="${esc(u.id)}">${u.role === 'admin' ? 'سحب الصلاحية' : 'منح صلاحية إدارية'}</button>` : '<span class="ui-badge">غير نشط</span>'}</article>`).join('');
    }
    const open = setupDialog(input => SchoolData.createAdmin(input), refresh);
    el('add-admin').onclick = () => open('إضافة شخص بصلاحية إدارية');
    el('permissions-list').onclick = async event => {
      const button = event.target.closest('[data-user]');
      if (!button) return;
      const person = users.find(u => u.id === button.dataset.user);
      const grant = person.role !== 'admin';
      if (!confirm(`${grant ? 'منح' : 'سحب'} الصلاحية الإدارية ${grant ? 'لـ' : 'من'} ${person.name}؟${!grant && !person.isTeacher ? ' سيُعطّل هذا الحساب الإداري.' : ''}`)) return;
      try {
        await SchoolData.setAdmin(person.id, grant); await refresh();
        SchoolApp.status('global-status', 'تم تحديث الصلاحيات.', false);
      } catch (error) { SchoolApp.status('global-status', error.message); }
    };
    await refresh();
  }
  return { initTeachers, initPermissions };
})();
