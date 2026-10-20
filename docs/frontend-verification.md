# Frontend review verification

2026-10-19: production build and all three configured Node test suites pass: auth/session isolation, IndexedDB persistence and numbering/payment limits, versioned backup validation. The auth suite read a git-ignored DEVELOPMENT-README.md and failed on a clean clone; it now reads the same public demo credentials from the tracked README. Authentication source and contract are unchanged. No lint/type script is configured.

Local browser: filter no-match and clear recovery passed. Enter on QSH-2026-0023 selected the matching desktop preview and current row. All six widths (320–1920px) captured, 24 seeded rows, no document overflow. Real screenshot frames record preview selection. The final theme owns invoice row spacing and hover feedback; prior component/base layers remain.

Created QSH-2026-0025 with two items at $25, no tax: editor, mobile preview, saved detail and reloaded detail showed $50. PDF downloaded through the real UI; one A4 page rendered and inspected; description, quantity 2, $25 unit price and $50 total/balance confirmed by text extraction. No actual printer submission or external sending.

390x600 mobile editor: save bar bounds y451–524, navigation begins y534.5. Edit/preview pressed state and corresponding panels inspected. visualViewport inset plus native resize hint support keyboard clearance; physical on-screen keyboard unavailable. OS reduced-motion switching and Safari/Firefox remain release checks. Existing reduced-motion checks retained. npm audit reports six inherited findings (1 low, 2 high, 3 critical); broad dependency upgrades are outside this UI pass. Production publication is separate.
