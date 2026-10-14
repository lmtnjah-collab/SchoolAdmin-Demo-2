/* Prototype repository. Replace these async methods with HTTP API calls later.
 * Browser storage and role checks are demonstrations, not a security boundary.
 */
window.SchoolData = (() => {
  const usersKey = 'schoolAdminUsers.v1';
  const activitiesKey = 'schoolAdminActivities'; // Preserve existing teacher-linked activities.
  const sessionKey = 'schoolAdminSession.v1';
  const seeds = [
    { id: 'vice-principal', name: 'وكيلة المدرسة', username: 'admin', job: 'وكيلة المدرسة', civilRegistration: '1000000000', role: 'admin', active: true, isTeacher: false },
    { id: 'noura-mohammed', name: 'نورة محمد', username: 'noura', job: 'الرياضيات', civilRegistration: '1000000001', role: 'teacher', active: true, isTeacher: true },
    { id: 'hana-ali', name: 'هناء علي', username: 'hana', job: 'الأحياء', civilRegistration: '1000000002', role: 'teacher', active: true, isTeacher: true },
    { id: 'samira-ahmed', name: 'سميرة أحمد', username: 'samira', job: 'الفيزياء', civilRegistration: '1000000003', role: 'teacher', active: true, isTeacher: true },
  ];
  const clean = value => String(value ?? '').trim();
  const digits = value => clean(value).replace(/[٠-٩۰-۹]/g, c => String(c.charCodeAt(0) - (c <= '٩' ? 1632 : 1776)));
  const id = () => crypto.randomUUID();
  function read(key, fallback) {
    const raw = localStorage.getItem(key);
    if (raw === null) return structuredClone(fallback);
    let result;
    try { result = JSON.parse(raw); } catch { throw new Error('تعذر قراءة البيانات المحلية. يرجى استعادة نسخة سليمة من بيانات المتصفح.'); }
    if (!Array.isArray(result)) throw new Error('تنسيق البيانات المحلية غير صالح.');
    return result;
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { throw new Error('تعذر حفظ البيانات. قد تكون مساحة التخزين ممتلئة أو غير متاحة.'); }
  }
  function users() {
    if (localStorage.getItem(usersKey) === null) write(usersKey, seeds);
    return read(usersKey, []);
  }
  function current() {
    const userId = sessionStorage.getItem(sessionKey);
    return users().find(u => u.id === userId && u.active) || null;
  }
  function requireUser(admin = false) {
    const user = current();
    if (!user || (admin && user.role !== 'admin')) throw new Error('لا تملكين صلاحية تنفيذ هذا الإجراء.');
    return user;
  }
  function teacherFor(user, teacherId) {
    const target = users().find(u => u.id === teacherId && u.isTeacher);
    if (!target || (user.role !== 'admin' && target.id !== user.id)) throw new Error('بيانات المعلمة غير متاحة.');
    return target;
  }
  function validateUser(input, all, existingId) {
    const value = { name: clean(input.name), username: clean(input.username), job: clean(input.job), civilRegistration: digits(input.civilRegistration) };
    if (!value.name || !value.job || !/^\d{10}$/.test(value.civilRegistration)) throw new Error('أدخلي الاسم والوظيفة ورقم تسجيل مدني من 10 أرقام.');
    if (all.some(u => u.id !== existingId && (u.civilRegistration === value.civilRegistration || (value.username && u.username?.toLowerCase() === value.username.toLowerCase())))) throw new Error('رقم التسجيل المدني أو اسم المستخدم مسجل مسبقًا.');
    return value;
  }
  return {
    async login(name, civilRegistration) {
      const loginName = clean(name).toLowerCase();
      const user = users().find(u => u.active && u.civilRegistration === digits(civilRegistration) && (u.name.toLowerCase() === loginName || u.username?.toLowerCase() === loginName));
      if (!user) throw new Error('بيانات الدخول غير صحيحة أو الحساب غير نشط.');
      sessionStorage.setItem(sessionKey, user.id);
      return { id: user.id, name: user.name, role: user.role };
    },
    async logout() { sessionStorage.removeItem(sessionKey); },
    async session() { const u = current(); return u ? { id: u.id, name: u.name, role: u.role } : null; },
    async listTeachers() { requireUser(true); return users().filter(u => u.isTeacher).map(({ civilRegistration, ...u }) => u); },
    async getTeacher(teacherId) {
      const actor = requireUser();
      const u = teacherFor(actor, teacherId);
      if (actor.role === 'admin') return { ...u };
      const { civilRegistration, ...profile } = u;
      return profile;
    },
    async saveTeacher(input, teacherId) {
      requireUser(true);
      const all = users();
      const old = teacherId ? all.find(u => u.id === teacherId && u.isTeacher) : null;
      if (teacherId && !old) throw new Error('المعلمة غير موجودة.');
      const fields = validateUser(input, all, teacherId);
      const saved = { ...(old || { id: id(), role: 'teacher', active: true, isTeacher: true }), ...fields };
      write(usersKey, old ? all.map(u => u.id === teacherId ? saved : u) : [...all, saved]);
      return saved.id;
    },
    async setTeacherActive(teacherId, active) {
      const actor = requireUser(true);
      const all = users();
      const target = teacherFor(actor, teacherId);
      if (target.id === actor.id) throw new Error('لا يمكنك تعطيل حسابك الحالي.');
      write(usersKey, all.map(u => u.id === teacherId ? { ...u, active: Boolean(active) } : u));
    },
    async listUsers() { requireUser(true); return users().map(({ civilRegistration, ...u }) => u); },
    async createAdmin(input) {
      requireUser(true);
      const all = users();
      const fields = validateUser(input, all);
      write(usersKey, [...all, { ...fields, id: id(), role: 'admin', active: true, isTeacher: false }]);
    },
    async setAdmin(userId, grant) {
      const actor = requireUser(true);
      const all = users();
      const target = all.find(u => u.id === userId);
      if (!target || (!target.active && !(grant && !target.isTeacher))) throw new Error('الحساب غير موجود أو غير نشط.');
      if (actor.id === userId) throw new Error('لا يمكنك سحب صلاحيتك الحالية.');
      // A non-teaching administrator is deactivated when access is revoked.
      write(usersKey, all.map(u => u.id === userId ? { ...u, role: grant ? 'admin' : 'teacher', active: grant || u.isTeacher } : u));
    },
    async listActivities(teacherId) {
      teacherFor(requireUser(), teacherId);
      return read(activitiesKey, []).filter(a => a.teacherId === teacherId);
    },
    async getActivity(activityId, teacherId) {
      teacherFor(requireUser(), teacherId);
      const activity = read(activitiesKey, []).find(a => a.id === activityId && a.teacherId === teacherId);
      if (!activity) throw new Error('النشاط غير موجود أو لا ينتمي إلى المعلمة المحددة.');
      return activity;
    },
    async saveActivity(input, teacherId, activityId) {
      const actor = requireUser();
      const target = teacherFor(actor, actor.role === 'admin' ? teacherId : actor.id);
      if (!target.active) throw new Error('يجب تفعيل حساب المعلمة قبل إضافة نشاط.');
      if (activityId && actor.role !== 'admin') throw new Error('تعديل الأنشطة متاح للإدارة فقط.');
      const all = read(activitiesKey, []);
      const old = activityId ? all.find(a => a.id === activityId && a.teacherId === target.id) : null;
      if (activityId && !old) throw new Error('النشاط غير موجود لهذه المعلمة.');
      const payload = Object.fromEntries(['title', 'type', 'description', 'date', 'notes'].map(k => [k, clean(input[k])]));
      if (!payload.title || !payload.type || !/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error('أكملي اسم النشاط ونوعه وتاريخه.');
      const now = new Date().toISOString();
      const saved = { ...payload, id: old?.id || id(), teacherId: target.id, createdAt: old?.createdAt || now, updatedAt: now, attachment: Object.hasOwn(input, 'attachment') ? input.attachment : old?.attachment ?? null };
      write(activitiesKey, old ? all.map(a => a.id === old.id ? saved : a) : [...all, saved]);
      return saved.id;
    },
    async deleteActivity(activityId, teacherId) {
      teacherFor(requireUser(true), teacherId);
      const all = read(activitiesKey, []);
      if (!all.some(a => a.id === activityId && a.teacherId === teacherId)) throw new Error('النشاط غير موجود لهذه المعلمة.');
      write(activitiesKey, all.filter(a => !(a.id === activityId && a.teacherId === teacherId)));
    },
  };
})();
