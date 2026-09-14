# QAANSHEEG product improvement verification

Verified locally on 14 September 2026 against the production build in desktop Chrome using isolated browser profiles. Existing business data in the user's browser was not used for testing.

## Implemented

- Minimal Somali login, provisioned account only, password visibility toggle, inline errors, loading/check/exit feedback, password-manager HTML semantics.
- Central AuthProvider/useAuth with a replaceable adapter; salted PBKDF2-SHA256 account hash, seven-day sessions, expiry, cross-tab logout and validated returnTo paths. Authentication remains a bypassable frontend-local gate, not server security.
- Profile menus with business logos and logout; mobile access through settings. Logout never deletes business data.
- Consistent Lucide sizing, reusable button variants/sizes, pointer-aware interaction states, focus states, reduced-motion support, delayed icon tooltips, moving navigation/filter indicators, gentle page and modal transitions.
- Search clearing, compact three-second success toasts, loading skeletons, safe-area spacing, Ctrl/Cmd+K actions and N for invoice creation outside typing controls.

## Observed passing

- Production build; repository and authentication automated tests. No plaintext password in production assets.
- All protected route families, invalid credentials, correct credentials, Enter submission, show/hide, field focus, error clearing, refresh, close/reopen tab, full browser shutdown/restart, session expiry, cross-tab logout, and return to an existing invoice.
- Login at 320, 360, 375, 390 and 430px. Application screens at 320, 375, 390, 430, 768, 1024, 1440 and 1920px, plus additional 360px checks.
- Fixed mobile navigation and create action at top, middle and bottom of scrolling pages across six widths. Mobile content scrolls in a reserved area above the action dock so rows never sit beneath the floating action. Last-row clearance and toast positioning above navigation/create action.
- Customer creation/editing and refresh; invoice creation/editing/duplication/deletion and refresh; search, paid/partial filters; partial/final payments and persisted balances; settings and currency persistence.
- Five-line invoice: $1,000 subtotal, 10% discount, 5% tax, $945 total. Downloaded PDF visually reviewed; print opens the generated PDF. Uploaded business logo and custom purple accent persist and appear in a newly downloaded PDF, also visually reviewed.
- Modal focus/Escape, delete cancellation, item delete/disabled icon, desktop hover/press feedback, reduced-motion suppression, command palette navigation/search focus, mobile profile logout, toast auto-dismiss.
- No uncaught browser errors in the recorded suites; the full workflow suite also checks console warnings/errors.

The invoice document, PDF module, repository and calculation modules were not modified. Optional scroll-collapse and swipe-dismiss were omitted to keep interactions predictable.

## Manual checks remaining

Native saved-password autofill in the actual Safari/Chrome password-manager UI was not exercised; only correct autocomplete/type/name semantics were verified. Physical iPhone/Safari browser chrome, physical-device keyboard behavior, native sharing and physical printing were not tested. Firefox and WebKit browser runtimes are not installed in this workspace.

## Evidence and reruns

- `npm test`
- `QAANSHEEG_URL=http://127.0.0.1:5176 npm run test:auth`
- `QAANSHEEG_URL=http://127.0.0.1:5176 npm run test:browser`
- `node output/playwright/polish-verify.mjs`
- `node output/playwright/navigation-check.mjs`
- `node output/playwright/final-polish-check.mjs`

JSON results, screenshots and downloaded PDFs are in `output/playwright/`. The local generated account is recorded in `DEVELOPMENT-README.md`; that file is ignored by git, denied by the development server, and excluded from production output.
