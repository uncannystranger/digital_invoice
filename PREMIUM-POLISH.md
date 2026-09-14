# QAANSHEEG premium interaction pass

This pass changes application presentation only. Authentication and credentials, IndexedDB, invoice calculations, the invoice document, and PDF code are byte-for-byte unchanged (recorded in `output/premium/protected-before.sha256`). No routes, data structures, or business workflows were added.

The visual layer uses deep petrol primary surfaces with fine highlight edges and directional shadows; shared radius, border, shadow and motion tokens; quiet neutral navigation/filter surfaces; refined inputs, avatars, status pills, menus, dialogs and toasts. Lucide remains the only icon family.

Primary buttons share a 460-stiffness/32-damping spring, independent plus-icon rotation and a faint mouse-only pointer highlight. The mobile action remains in its reserved area above navigation: scrolling down compacts it to a 54px circle, scrolling up expands it, and keyboard focus expands its label. Reduced motion leaves it expanded and suppresses transforms. There is no idle animation.

## Verification

- `npm run build` and `npm test`.
- Existing workflow browser regression: create/edit/delete/duplicate invoices, decimal totals, partial/final payments, persistence, customer creation, settings, search/filter, PDF download and print-opening, keyboard focus and reduced motion.
- Authentication browser suite: unchanged credentials, inline error, Enter, returnTo, show/hide, refresh, reopen, logout and expiry.
- `node output/premium/verify.mjs`: rendered screens at 320, 375, 390, 430, 768, 1024, 1440 and 1920px; floating action collapse/expand, keyboard focus, scroll clearance, reduced motion and touch activation.
- `node output/premium/interaction-check.mjs`: observed plus rotation, press compression, profile/command menus, delete confirmation, delayed tooltip, focus outline and reduced-motion modal.

Screenshots and JSON evidence are in `output/premium/`; full workflow results remain in `output/playwright/`. Checks use desktop Chrome and emulated mobile viewports/touch. Physical-device Safari chrome and native password-manager autofill were not retested in this visual pass.
