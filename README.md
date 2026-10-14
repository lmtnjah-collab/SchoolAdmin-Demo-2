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

- `index.html`: login; admins go to the dashboard and teachers directly to the activity form.
- `pages/admin-dashboard.html`: exactly two sections, teachers and permissions.
- `pages/teachers.html`: dynamic search, add/edit modal, deactivate/reactivate.
  Deactivation preserves activity history and prevents login/new activities.
- `pages/teacher-profile.html?teacher=ID`: selected teacher activities for admins.
  Teachers use the same page through «نشاطاتي», scoped to their session ID.
- `pages/activity-details.html`: original activity form, reused for create/details/edit.
  Admin creation needs `?teacher=ID`; details also need `&activity=ID`.
  Teachers always create for the current session ID, regardless of URL parameters.
  «إضافة نشاط» remains their login destination; «نشاطاتي» opens their saved activities
  and read-only details. Teacher edit/delete and administrative access remain blocked.
- `pages/permissions.html`: grant/revoke admin access for active teachers or create
  another authorized administrator. Revoking a non-teaching admin deactivates that
  account; permissions can be granted again. Self-revocation/deactivation is blocked.

## Frontend data boundary

`js/data.js` is the asynchronous repository, session and prototype policy layer.
UI files never access storage directly. `js/app.js` handles shared startup/guards;
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
- `node tests/browser.cjs`: Chrome UI regression tests and desktop/mobile screenshots.
  Requires externally available Playwright (`PLAYWRIGHT_MODULE` can point to its
  module directory) and installed Chrome; no app dependency was added. The test
  starts a temporary static file server, uses an isolated browser context, and closes
  both afterward. It does not modify the user's normal browser data.

Browser tests cover login/redirects, direct URL guards, teacher CRUD/deactivation,
permission changes, activity creation/edit/delete, ownership mismatch, attachments,
reload persistence, Arabic RTL pages and mobile overflow at 390px.
