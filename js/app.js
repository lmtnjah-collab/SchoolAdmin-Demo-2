/* Shared navigation and session guard. Real authorization must live in the future API. */
window.SchoolApp = (() => {
  const root = new URL('../', document.currentScript.src);
  const url = (path, params = {}) => {
    const result = new URL(path, root);
    Object.entries(params).forEach(([key, value]) => result.searchParams.set(key, value));
    return result.href;
  };
  const home = user => url(user.role === 'admin' ? 'pages/admin-dashboard.html' : SchoolProfessional.hasProfile(user.id) ? 'pages/teacher-dashboard.html' : 'pages/teacher-info.html');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function status(id, message, error = true) {
    const el = document.getElementById(id);
    el.textContent = message;
    el.dataset.state = error ? 'error' : 'success';
  }
  async function guard() {
    const user = await SchoolData.session();
    const page = document.body.dataset.page;
    if (page === 'login') {
      if (user) { location.replace(home(user)); return null; }
      return false;
    }
    if (!user) { location.replace(url('index.html')); return null; }
    if (user.role !== 'admin' && !['activity', 'profile', 'teacher-info', 'teacher-dashboard', 'teacher-records', 'teacher-record-form'].includes(page)) {
      location.replace(home(user)); return null;
    }
    if (page.startsWith('teacher-') && (user.role !== 'teacher' || (page !== 'teacher-info' && !SchoolProfessional.hasProfile(user.id)))) {
      location.replace(home(user)); return null;
    }
    return user;
  }
  async function init() {
    try {
      const user = await guard();
      if (user === null) return;
      document.getElementById('main-content').hidden = false;
      if (user) {
        document.getElementById('account-actions').hidden = false;
        document.getElementById('account-name').textContent = user.name;
        document.getElementById('home-link').href = home(user);
        if (user.role === 'teacher' && document.getElementById('teacher-navigation')) {
          document.getElementById('teacher-navigation').hidden = false;
          const activeLink = document.getElementById(document.body.dataset.page === 'profile' || new URLSearchParams(location.search).has('activity') ? 'teacher-activities-link' : 'teacher-add-link');
          activeLink.setAttribute('aria-current', 'page');
          activeLink.classList.add('ui-button--primary');
          const professionalLink = document.createElement('a');
          professionalLink.className = 'ui-button'; professionalLink.href = home(user); professionalLink.textContent = 'السجل المهني';
          document.getElementById('teacher-navigation').prepend(professionalLink);
        }
        document.getElementById('logout-button').onclick = async () => {
          await SchoolData.logout(); location.replace(url('index.html'));
        };
      }
      switch (document.body.dataset.page) {
        case 'teacher-info': case 'teacher-dashboard': case 'teacher-records': case 'teacher-record-form':
          SchoolProfessional.init(user); break;
        case 'login':
          ['teacher','admin'].forEach(role=>{
            document.getElementById(`demo-${role}-login`).onclick = async () => {
              const buttons = ['teacher','admin'].map(r=>document.getElementById(`demo-${r}-login`));
              buttons.forEach(button=>{button.disabled=true;});
              try {
                await SchoolData.demoLogin(role);
                location.replace(url(role==='teacher'?'pages/teacher-dashboard.html':'pages/admin-dashboard.html'));
              } catch(error) {
                status('login-status',error.message);
                buttons.forEach(button=>{button.disabled=false;});
              }
            };
          });
          document.getElementById('login-form').onsubmit = async event => {
            event.preventDefault();
            try {
              const logged = await SchoolData.login(document.getElementById('login-name').value, document.getElementById('login-civil').value);
              location.replace(home(logged));
            } catch (error) { status('login-status', error.message); }
          };
          break;
        case 'teachers': await SchoolTeachers.initTeachers(); break;
        case 'permissions': await SchoolTeachers.initPermissions(user); break;
        case 'profile': await SchoolActivities.initProfile(user); break;
        case 'activity': await SchoolActivities.initForm(user); break;
      }
    } catch (error) { status('global-status', error.message); }
  }
  document.addEventListener('DOMContentLoaded', init);
  // Revalidate sessions after history restoration, role changes, or deactivation in another tab.
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
  window.addEventListener('storage', event => { if (event.key === 'schoolAdminUsers.v1' || event.key === null) location.reload(); });
  return { url, home, escape, status, guard };
})();
