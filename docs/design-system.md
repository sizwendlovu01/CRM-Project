# Design system

The interface uses an original visual identity. Monday.com's CRM was studied as a reference for polish and usability (colour-coded statuses, board columns with colour accents, a stage tracker, generous spacing). No branding, assets or layouts were copied.

## Sources

- **[claudedesignskills](https://github.com/freshtechbro/claudedesignskills)** (MIT). This is a Claude Code skills marketplace, not an npm UI kit. Following its "individual skills for local projects" install route, the three skills relevant to a CRM UI are installed in `.claude/skills/`:
  - `modern-web-design`: design tokens, elevation scale, micro-interaction timing, accessibility and performance rules
  - `motion-framer`: Motion for React patterns (variants, stagger, springs, `layoutId`, reduced motion)
  - `animated-component-libraries`: Magic UI / React Bits component patterns (for example the number ticker)

  The other 19 skills (Three.js, Babylon.js, GSAP scroll effects, Lottie, Rive, and similar) target 3D and marketing sites and were deliberately not installed. The skills' Python helper scripts are not run as part of the build.
- **`motion` 12.43.0** (MIT): the animation library the skills recommend, imported from `motion/react`.

## Tokens (`apps/web/src/app/globals.css`)

| Token group | Values |
| --- | --- |
| Layers | `canvas` (app background) < `card`/`background` (surfaces) < `popover` (overlays) |
| Brand | `primary` #5b47e8 (dark mode #7564f5), `--brand-gradient` violet to sky, `--hero-gradient` soft tint |
| Status fills | green, amber, red, blue, violet, slate, teal, pink. White text on every fill meets 4.5:1 |
| Soft tones | success, warning, danger and info tints for badges and banners |
| Elevation | `shadow-xs`, `sm`, `md`, `lg`, `xl` (separate dark-mode values) |
| Radius | base 12px; cards and dialogs 16px (`rounded-2xl`); controls 12px (`rounded-lg`) |
| Type | Inter (UI text), Plus Jakarta Sans (headings and figures) |
| Motion | `--ease-out` cubic-bezier(0.22, 1, 0.36, 1); 150-260 ms; keyframes for fade, dialog, sheet, drawer, pop and shimmer |
| Charts | the dataviz-validated categorical palette (unchanged) |

## Components

- **Buttons:** default, soft, secondary, outline, ghost, destructive and link variants; press-scale feedback; coloured focus ring.
- **Inputs:** 40px controls, hover border, soft focus halo, error state wired to `aria-invalid`.
- **StatusPill:** solid colour-coded status cells. Blue means new or open, violet in conversation, amber in progress, green a positive outcome, red a negative outcome, slate inactive.
- **PriorityBadge:** a signal-bar glyph plus text, so priority never relies on colour alone.
- **IconTile:** tinted icon containers used in page headers, KPI cards and feature lists.
- **Card:** an `interactive` variant lifts on hover. Skeletons use a shimmer.
- **Overlays:** dialogs zoom and fade in, sheets slide in, menus pop in; all are Radix-based and keyboard accessible.
- **Motion:** `FadeIn`, `Stagger`/`StaggerItem` and `NumberTicker` live in `components/motion.tsx`. `MotionConfig reducedMotion="user"` disables movement for users who prefer reduced motion. Screen readers always get the final values.

## Patterns

- **App shell:** collapsible sidebar (state remembered per browser) with colour-coded section icons and a spring-animated active indicator; a translucent sticky top bar with search, a "New" quick-create menu, theme switch, notifications and account menu; page content fades in on navigation.
- **Dashboard:** gradient welcome banner with working quick actions and the date-range filter; KPI cards with icon tiles and count-up values (all from the analytics API).
- **Pipeline:** columns carry a stage-colour top bar and count chip; cards have a stage-colour edge, lift on hover, tilt while dragged; empty columns show a dashed drop zone.
- **Deals:** the stage tracker is a row of connected chevrons. Click a chevron to move the deal.
- **Tables:** uppercase micro-headers, sortable columns highlighted in the brand colour, row hover, solid status pills.
- **Auth:** split layout with a brand-gradient panel and an abstract product preview (shapes only, no invented figures).
