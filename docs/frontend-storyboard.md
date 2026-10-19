# Digital Invoice frontend storyboard

This is a focused refinement of the existing dark green invoice workspace.

| Surface | Desktop | Mobile | Awwwards reference |
| --- | --- | --- | --- |
| Invoice browser | Tighter rows, stable monetary text, visible selected item, named preview | Readable two-line rows and clear filter recovery | [Envato entry screen](https://www.awwwards.com/inspiration/sign-up-envato) for controlled hierarchy |
| Preview | Existing Motion arrival; invoice number announces selection; keyboard row selection | Explicit selected edit/preview controls | [Eduard Bodak form fill](https://www.awwwards.com/inspiration/form-fill-eduard-bodak-portfolio) |
| Editor | Existing two-panel composition retained | Save bar stays reachable inside resized keyboard viewport; safe-area clearance | [Eduard Bodak form fill](https://www.awwwards.com/inspiration/form-fill-eduard-bodak-portfolio) |

CSS cascade: style.css supplies base structure; premium.css supplies reusable components; cinematic.css is the final product theme. This pass consolidates invoice-specific hover and row spacing in the final theme, without removing the established layers or restyling printed documents. Native View Transitions retain the existing navigation fallback and user reduced-motion check. Keep finance, local IndexedDB, auth, PDF and print contracts unchanged.
