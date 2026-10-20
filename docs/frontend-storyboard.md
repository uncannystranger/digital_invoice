# Digital Invoice frontend storyboard

This is a focused refinement of the existing dark green invoice workspace.

| Surface | Desktop | Mobile | Awwwards reference |
| --- | --- | --- | --- |
| Invoice browser | Tighter rows, stable monetary text, visible selected item, named preview | Readable two-line rows and clear filter recovery | [Envato entry screen](https://www.awwwards.com/inspiration/sign-up-envato) for controlled hierarchy |
| Preview | Existing Motion arrival; invoice number announces selection; keyboard row selection | Explicit selected edit/preview controls | [Eduard Bodak form fill](https://www.awwwards.com/inspiration/form-fill-eduard-bodak-portfolio) |
| Editor | Existing two-panel composition retained | Save bar stays reachable inside resized keyboard viewport; safe-area clearance | [Eduard Bodak form fill](https://www.awwwards.com/inspiration/form-fill-eduard-bodak-portfolio) |

CSS cascade: style.css supplies base structure; premium.css supplies reusable components; cinematic.css is the final product theme. This pass consolidates invoice-specific hover and row spacing in the final theme, without removing the established layers or restyling printed documents. Native View Transitions retain the existing navigation fallback and user reduced-motion check. Keep finance, local IndexedDB, auth, PDF and print contracts unchanged.

## Technology study: Tipalti

https://www.awwwards.com/sites/tipalti
https://www.awwwards.com/inspiration/tipalti-ui-components-tipalti
https://www.awwwards.com/inspiration/form-fill-eduard-bodak-portfolio

Adapt Tipalti's modular finance surfaces and green focal accents to the existing graphite invoice workspace. Four status/count surfaces act as filters; selected lime makes the current scope unambiguous. The document browser has a compact index heading, customer/number hierarchy and a stationary amount. Above 1100px, the actual selected invoice appears in a distinct sticky paper stage with customer, currency-specific outstanding balance and Open Invoice action. A 280ms rise/fade follows selection; Bodak's form-feedback reference supplies short directional button/row feedback. Phone uses the same filters in two columns and opens the full invoice through its existing route. PDF/print paper styles are excluded from new CSS via screen media queries. Calculations, IndexedDB and PDF generation remain unchanged. Reduced-motion settings retain existing MotionConfig plus CSS suppression.
