/* Reuses the existing activity cards and detail form. */
window.SchoolActivities = (() => {
  const el = id => document.getElementById(id);
  const esc = value => SchoolApp.escape(value);
  const params = () => new URLSearchParams(location.search);
  const profileUrl = teacher => SchoolApp.url('pages/teacher-profile.html', { teacher });
  async function initProfile(user) {
    const isAdmin = user.role === 'admin';
    const teacherId = isAdmin ? params().get('teacher') : user.id;
    el('activities-back-link').hidden = !isAdmin;
    if (!isAdmin) {
      document.title = 'نشاطاتي | إدارة المدرسة';
      document.querySelector('.activities-heading .eyebrow').textContent = 'نشاطاتي';
    }
    let teacher;
    try { teacher = await SchoolData.getTeacher(teacherId); }
    catch (error) {
      el('activities-title').textContent = 'المعلمة غير موجودة';
      el('activities-subtitle').textContent = error.message;
      el('add-activity-button').hidden = true;
      return;
    }
    el('activities-title').textContent = teacher.name;
    el('activities-subtitle').textContent = `${teacher.job} · ${teacher.active ? 'أنشطة المعلمة' : 'حساب غير نشط — الأنشطة محفوظة للعرض'}`;
    el('add-activity-button').hidden = !teacher.active;
    document.querySelectorAll('#add-activity-button, #activities-empty-state a').forEach(link => {
      link.href = SchoolApp.url('pages/activity-details.html', isAdmin ? { teacher: teacher.id } : {});
      link.hidden = !teacher.active;
    });
    async function render() {
      const activities = await SchoolData.listActivities(teacher.id);
      el('activities-count-number').textContent = activities.length;
      el('activities-empty-state').hidden = activities.length > 0;
      el('activities-list').innerHTML = activities.slice().reverse().map(a => `<article class="activity-card"><div class="activity-card__top"><span class="activity-card__category">${esc(a.type || 'غير محدد')}</span>${isAdmin ? `<button class="secondary-button delete-button" data-delete="${esc(a.id)}" aria-label="حذف ${esc(a.title)}">حذف</button>` : ''}</div><a class="activity-card__content" href="${esc(SchoolApp.url('pages/activity-details.html', isAdmin ? { teacher: teacher.id, activity: a.id } : { activity: a.id }))}"><h2>${esc(a.title)}</h2><p>${esc(a.description || 'لا يوجد وصف متاح.')}</p><div class="activity-card__footer"><span>عرض التفاصيل ←</span><span>${esc(a.date)}</span></div></a></article>`).join('');
    }
    el('activities-list').onclick = async event => {
      const button = event.target.closest('[data-delete]');
      if (!isAdmin || !button || !confirm('هل أنتِ متأكدة من حذف هذا النشاط؟')) return;
      try { await SchoolData.deleteActivity(button.dataset.delete, teacher.id); await render(); SchoolApp.status('global-status', 'تم حذف النشاط.', false); }
      catch (error) { SchoolApp.status('global-status', error.message); }
    };
    await render();
  }
  async function readAttachment(file) {
    if (!file) return undefined;
    if (file.size > 1024 * 1024) throw new Error('حجم المرفق يتجاوز 1 ميغابايت.');
    if (!['image/png', 'image/jpeg', 'image/webp', 'application/pdf'].includes(file.type)) throw new Error('اختاري صورة PNG أو JPEG أو WebP أو ملف PDF.');
    const data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('تعذر قراءة المرفق.'));
      reader.readAsDataURL(file);
    });
    return { name: file.name, type: file.type, data };
  }
  async function initForm(user) {
    const teacherId = user.role === 'admin' ? params().get('teacher') : user.id;
    const activityId = params().get('activity');
    const form = el('activity-form');
    let teacher = user;
    let activity = null;
    try {
      if (user.role === 'admin') teacher = await SchoolData.getTeacher(teacherId);
      if (activityId) activity = await SchoolData.getActivity(activityId, teacherId);
      if (user.role === 'admin' && !teacher.active && !activity) throw new Error('حساب المعلمة غير نشط؛ يمكنك عرض الأنشطة من ملفها.');
    } catch (error) {
      form.hidden = true;
      el('activity-page-title').textContent = 'بيانات النشاط غير متاحة';
      el('activity-page-subtitle').textContent = error.message;
      el('activity-back-link').href = SchoolApp.url(user.role === 'admin' ? 'pages/teachers.html' : 'pages/teacher-profile.html');
      el('activity-back-link').textContent = user.role === 'admin' ? 'العودة إلى المعلمات' : 'العودة إلى نشاطاتي';
      return;
    }
    const back = user.role === 'admin' ? profileUrl(teacherId) : SchoolApp.url('pages/teacher-profile.html');
    const readOnly = Boolean(activity) && (user.role !== 'admin' || !teacher.active);
    el('activity-back-link').href = back;
    el('cancel-activity-button').href = user.role === 'teacher' && !activity ? SchoolApp.home(user) : back;
    el('cancel-activity-button').textContent = user.role === 'admin' ? 'إلغاء' : activity ? 'العودة إلى نشاطاتي' : 'مسح النموذج';
    el('activity-page-title').textContent = activity ? 'تفاصيل النشاط' : 'إضافة نشاط';
    el('activity-page-subtitle').textContent = `المعلمة: ${teacher.name} — يُحفظ النشاط في ملفها تلقائيًا.`;
    el('save-activity-button').textContent = activity ? 'تحديث النشاط' : 'حفظ النشاط';
    for (const field of ['title','type','description','date','notes']) {
      const input = el(`activity-${field}`);
      if (field === 'type' && activity?.type && !Array.from(input.options).some(o => o.value === activity.type)) input.add(new Option(activity.type, activity.type));
      input.value = activity?.[field] || '';
    }
    if (activity?.attachment?.data && /^data:(image\/(png|jpeg|webp)|application\/pdf);base64,/.test(activity.attachment.data)) {
      const link = document.createElement('a');
      link.className = 'secondary-button'; link.href = activity.attachment.data;
      link.download = activity.attachment.name; link.textContent = `تنزيل المرفق: ${activity.attachment.name}`;
      el('attachment-current').append(link);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary-button delete-button'; remove.textContent = 'إزالة المرفق';
      remove.onclick = () => { activity.attachment = null; el('attachment-current').replaceChildren(); };
      if (!readOnly) el('attachment-current').append(remove);
    } else if (activity?.attachment) {
      el('attachment-current').textContent = 'المرفق القديم لم يكن محفوظًا كملف. يمكنك إرفاقه مجددًا.';
    }
    if (readOnly) {
      form.querySelectorAll('input, select, textarea').forEach(input => { input.disabled = true; });
      el('save-activity-button').hidden = true;
      el('activity-page-subtitle').textContent = `المعلمة: ${teacher.name} — تفاصيل النشاط للعرض فقط.`;
    }
    el('delete-activity-button').hidden = !activity || user.role !== 'admin';
    el('delete-activity-button').onclick = async () => {
      if (!confirm('هل أنتِ متأكدة من حذف هذا النشاط؟')) return;
      try { await SchoolData.deleteActivity(activity.id, teacherId); location.href = back; }
      catch (error) { SchoolApp.status('activity-form-status', error.message); }
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (readOnly) return;
      const button = el('save-activity-button'); button.disabled = true;
      try {
        const payload = Object.fromEntries(['title','type','description','date','notes'].map(k => [k, el(`activity-${k}`).value]));
        payload.attachment = await readAttachment(el('activity-attachment').files[0]) ?? activity?.attachment ?? null;
        await SchoolData.saveActivity(payload, teacherId, activityId);
        if (user.role === 'admin') { location.href = back; return; }
        form.reset();
        SchoolApp.status('activity-form-status', 'تم حفظ النشاط في ملفك بنجاح. يمكنك إضافة نشاط آخر.', false);
      } catch (error) { SchoolApp.status('activity-form-status', error.message); }
      finally { button.disabled = false; }
    };
  }
  return { initProfile, initForm };
})();
