# SchoolAdmin — frontend prototype

Arabic / RTL static frontend, preserving the original Tajawal font, teal palette,
responsive teacher table, cards and activity form. Open `index.html` through a
static web server (for example your editor's Live Server). There is no application
backend or database. Google Fonts is optional; the existing system fonts are the fallback.

## Demo login

| Role | Name / username | Civil registration (sample only) |
| --- | --- | --- |
| Admin | admin / وكيلة المدرسة | 1000000000 |
| Teacher | noura / نورة محمد | 1000000001 |
| Teacher | hana / هناء علي | 1000000002 |
| Teacher | samira / سميرة أحمد | 1000000003 |

Use fictional data only. localStorage is readable/editable by the browser user.
Frontend route/service checks demonstrate intended behavior, not real authorization.

## Pages and responsibilities

- `index.html`: login; admins keep their dashboard. Teachers without a completed profile go to `teacher-info.html`; returning teachers go to `teacher-dashboard.html`.
- `pages/admin-dashboard.html`: exactly two sections, teachers and permissions.
- `pages/teachers.html`: dynamic search, add/edit modal, deactivate/reactivate.
  Deactivation preserves activity history and prevents login/new activities.
- `pages/teacher-profile.html?teacher=ID`: selected teacher activities for admins.
  The legacy teacher activity view remains available, separate from professional records.
- `pages/activity-details.html`: original activity form, reused for create/details/edit.
  Admin creation needs `?teacher=ID`; details also need `&activity=ID`.
  Teachers always create for the current session ID, regardless of URL parameters.
  Legacy activities remain intact and are no longer the teacher login destination.
- `pages/permissions.html`: grant/revoke admin access for active teachers or create
  another authorized administrator. Revoking a non-teaching admin deactivates that
  account; permissions can be granted again. Self-revocation/deactivation is blocked.

## Teacher professional record flow

- `pages/teacher-info.html`: required fictional profile data; prefilled for editing. Editing this profile does not change demo login credentials or professional records.
- `pages/teacher-dashboard.html`: welcome, compact profile, and exactly seven category cards with saved record counts.
- `pages/teacher-records.html?type=TYPE`: category-specific list, empty state, add/view/edit/delete actions.
- `pages/teacher-record-form.html?type=TYPE`: category-specific fields, required-field validation, read-only details with `&id=ID&mode=view`, editing with `&id=ID`.
- `js/teacher-professional.js`: shared category definitions, teacher storage and page behavior. Existing form/card/table styles are reused; small responsive additions live in `css/components.css`.

Supported types: peer-visits, workshops, principal-visits, vice-principal-visits,
guided-reading, presented-courses, attended-courses. All start empty. Notes and
recommendations are optional; other record fields are required. Subjects use a
comma-separated text field. Workload is an integer from 0 to 60.

localStorage uses separate maps keyed by stable session teacher ID:

```js
teacherProfile = {
  "noura-mohammed": { teacherId, name, civilRegistration, employeeNumber,
    specialty, stage, subjects, workload, updatedAt }
};
teacherRecords = {
  "noura-mohammed": { peerVisits: [], workshops: [], principalVisits: [],
    vicePrincipalVisits: [], guidedReading: [], presentedCourses: [], attendedCourses: [] }
};
// Each record includes its category fields, id, teacherId, createdAt, updatedAt.
```

No professional records are migrated from legacy activities because their fields
and categories differ. The admin display of professional records is deferred.
All app links work under a GitHub Pages repository subpath. The existing optional
Google Fonts links are retained. No build step or application dependencies are needed.

## Frontend data boundary

`js/data.js` is the asynchronous repository, session and prototype policy layer.
The legacy UI uses that repository; professional pages encapsulate their separate localStorage in `js/teacher-professional.js`. `js/app.js` handles shared startup/guards;
`js/teachers.js` handles teacher/permission screens; `js/interactions.js` handles activities.

Users are seeded once into `schoolAdminUsers.v1`; additions and edits persist.
The session stores only a user ID in sessionStorage (`schoolAdminSession.v1`).
Role/active status are re-read before operations. Activities retain the original
`schoolAdminActivities` storage key and existing teacher IDs. Unknown legacy records
are retained but never shown under a different teacher. Existing attachment path
strings cannot recover the original file; those files must be attached again.
New PNG/JPEG/WebP/PDF attachments up to 1 MiB are stored locally, with quota errors
reported without a success message. Clearing browser site data resets the prototype.

## Future API integration

Replace repository implementations with API calls while retaining the async interface.
Node.js/Express/database work is intentionally deferred. The server must authenticate
credentials, derive teacher identity from a verified session, enforce every role and
ownership check, validate data, protect civil registration information, manage secure
sessions, and provide file upload/storage. None of those server protections exists yet.

## Verification

- `node --test tests/data.test.cjs`: repository roles, ownership, user lifecycle,
  duplicate credentials, permissions, persistence, legacy data and corrupt storage.
- `node tests/browser.cjs`: dependency-free browser regression using installed Chrome and a temporary static server. Override `CHROME_PATH` for another Chrome installation. Tests run in a separate temporary browser profile under a GitHub Pages style subpath.

Browser tests cover first and repeat teacher login, required profile validation,
profile editing, all seven category add/view/edit/list/count flows, delete,
refresh persistence, account separation, Arabic RTL, desktop/tablet/mobile
overflow, admin pages and legacy activity CRUD, failed local requests and
JavaScript exceptions. Dashboard screenshots are written to the OS temporary
folder as `schooladmin-teacher-{1440,768,390}.png`.
