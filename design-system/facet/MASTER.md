# Facet Design System — Precision Canvas

> Product principle: **quiet chrome, powerful canvas**. The interface is a professional review workspace, not a decorated HTML viewer.

**Status:** implementation baseline  
**Design dials:** variance 6/10 · motion 4/10 · density 7/10  
**Page overrides:** check `design-system/facet/pages/[page-name].md` first; a page file overrides this master only where explicit.

## Experience model

Facet has one dominant surface: the artifact canvas. Navigation, commands, comments, history, and metadata recede until requested.

- **Explore:** links, controls, diagrams, and embedded interactions behave normally.
- **Review:** selections create anchored comments; artifact actions cannot fire accidentally.
- **Decide:** structured approvals, rankings, and choices are foregrounded; submission has a review step.
- Mode changes are announced to assistive technology and remain visible in the toolbar.
- Comments bind to semantic node IDs and artifact versions. Stale and orphaned anchors are visible states.

## Color tokens

### Application chrome

| Token | Value | Use |
|---|---:|---|
| `--app-bg` | `#080A0E` | Window and focus-mode background |
| `--surface-1` | `#0F1218` | Rails and toolbar |
| `--surface-2` | `#141821` | Elevated controls and panels |
| `--surface-3` | `#1B202B` | Selected or hovered controls |
| `--line` | `#242A36` | Dividers and boundaries |
| `--text-strong` | `#EEF1F8` | Primary chrome text |
| `--text-muted` | `#9BA4B7` | Secondary chrome text |
| `--action` | `#7C6CFF` | Primary action and annotation |
| `--focus` | `#44D5EE` | Keyboard focus and active location |
| `--success` | `#4ED28A` | Completed and accepted |
| `--warning` | `#F0B762` | Stale, attention, partial |
| `--danger` | `#F26C7D` | Destructive and failed |

### Artifact canvas

| Token | Value | Use |
|---|---:|---|
| `--canvas-bg` | `#F7F8FB` | Default artifact page |
| `--canvas-surface` | `#FFFFFF` | Tables, code cards, grouped controls |
| `--canvas-ink` | `#171A23` | Primary canvas text |
| `--canvas-muted` | `#667085` | Secondary canvas text |
| `--canvas-line` | `#E3E7EE` | Canvas dividers |
| `--canvas-selection` | `#E9E5FF` | Selected semantic node |

Dark artifact themes are allowed as content presets, but the default reading canvas is light. Text meets WCAG AA; focus indicators reach at least 3:1 against adjacent colors.

## Typography

- UI and prose: `Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Code, IDs, shortcuts, and token data only: `"JetBrains Mono", ui-monospace, monospace`.
- Do not use monospace for every heading; precision comes from hierarchy and alignment.
- Display: 40–56px / 0.98–1.05 / weight 720–780 / tracking -0.045em.
- Page title: 28–36px / 1.1 / weight 700–760.
- Section title: 18–24px / 1.2 / weight 650–720.
- Body: 14–16px / 1.5–1.65 / weight 400–500.
- UI label: 11–13px / 1.3 / weight 550–700.

## Geometry and layout

- Base unit: 4px. Primary rhythm: 8px.
- Control radii: 6–8px. Panel radii: 10–14px. Marketing containers may use 18–22px.
- Avoid pill shapes except for tags, statuses, and compact segmented controls.
- Desktop shell: 48px toolbar; 208–240px navigation rail; flexible canvas; 292–320px review rail.
- Both rails collapse. Focus mode shows the canvas plus a minimal escape affordance.
- Canvas reading width: 680–880px for prose; structured grids can expand to the workspace.
- Minimum targets: 24px for tightly grouped desktop controls with spacing; 44px on touch layouts.
- Mobile: content-first; navigation is a drawer; review is a bottom sheet with deliberate snap points.

## Components

- Use semantic primitives and a single Lucide-style outline icon family.
- Buttons are quiet by default. Only the current primary task gets a filled action color.
- Cards group a real object or action. Do not wrap every paragraph in a rounded rectangle.
- Tables keep headers visible and scroll inside an explicitly labeled region.
- Diagrams expose an equivalent text description and navigable node list.
- Code blocks include language, copy action, wrapping control, and accessible line references.
- Annotation pins never obscure content; selecting a pin focuses its thread and vice versa.
- Decision controls show saved, pending, submitted, expired, and conflict states.

## Motion

| Token | Duration | Use |
|---|---:|---|
| `--motion-fast` | `120ms` | Hover and press feedback |
| `--motion-base` | `180ms` | Menus, selection, small panels |
| `--motion-spatial` | `240ms` | Rail and bottom-sheet transitions |

- Default easing: `cubic-bezier(.2,.8,.2,1)`.
- Motion explains state change or spatial continuity; no decorative stagger on dense data.
- Never animate layout-critical dimensions in a way that shifts reading position.
- Under `prefers-reduced-motion: reduce`, remove transforms and nonessential transitions.

## Interaction and copy

- Keyboard and pointer have feature parity. Provide a command palette, visible shortcuts, and predictable focus restoration.
- Show human states such as “3 comments need review” and “Changes saved locally”; do not expose polling mechanics as primary copy.
- Destructive operations show exact scope and recovery implications.
- Offline, reconnecting, conflict, invalid artifact, unsupported node, and failed patch states require recovery paths.

## Performance budgets

- Immediate selection feedback: under 100ms.
- Initial local artifact interaction: target under 1s on the benchmark machine.
- No layout shift after the main canvas becomes interactive.
- Virtualize large lists/tables and progressively render heavy diagrams.
- The core viewer must not require a CDN at runtime.

## Forbidden patterns

- Gold-on-black branding, ornamental serif headings, or heavy gradient decoration.
- Permanent sidebars, ambiguous click-to-annotate behavior, or hidden mode changes.
- Card soup, excessive shadows, inflated pills, emoji icons, or novelty cursors.
- Unrestricted artifact JavaScript, inaccessible canvas-only content, or silent annotation loss.
- Hover-only actions, invisible focus rings, layout-shifting hovers, and motion without reduced-motion support.

## Release checklist

- [ ] Explore, Review, and Decide modes are unambiguous by sight, keyboard, and screen reader.
- [ ] Keyboard navigation, focus restoration, and skip paths pass manual review.
- [ ] Text contrast is at least 4.5:1; non-text state and focus contrast are at least 3:1.
- [ ] Responsive QA passes at 375, 768, 1024, and 1440px without horizontal page scroll.
- [ ] No content is hidden behind fixed chrome; mobile sheets preserve reading position.
- [ ] Reduced motion, 200% zoom, long content, empty, loading, error, offline, and conflict states are verified.
- [ ] Semantic anchors survive patches or are explicitly marked stale/orphaned.
- [ ] Token, latency, bundle, and accessibility gates from the implementation plan pass.
