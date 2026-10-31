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
| Brand | one anchor hue: `primary` #5b47e8 (dark mode #7564f5) and `brand-deep` #3a2cb8 for solid brand panels. No gradients |
| Form fields | `--input` #868fa0 (dark #64748f): field edges meet 3:1 against their surface (WCAG 1.4.11) |
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
- **Overlays:** dialogs zoom and fade in over a solid scrim (no frosted glass), sheets slide in, menus pop in; all are Radix-based and keyboard accessible.
- **Motion:** `FadeIn`, `Stagger`/`StaggerItem` and `NumberTicker` live in `components/motion.tsx`. `MotionConfig reducedMotion="user"` disables movement for users who prefer reduced motion. Screen readers always get the final values.

## Patterns

- **App shell:** collapsible sidebar (state remembered per browser, switches size instantly rather than animating width) with colour-coded section icons and a spring-animated active indicator; a solid sticky top bar with search, a "New" quick-create menu, theme switch, notifications and account menu; page content fades in on navigation.
- **Dashboard:** tinted welcome banner with working quick actions and the date-range filter; KPI cards with icon tiles and count-up values (all from the analytics API).
- **Pipeline:** columns carry a stage-colour top bar and count chip; cards have a stage-colour edge, lift on hover, tilt while dragged; empty columns show a dashed drop zone.
- **Deals:** the stage tracker is a row of connected chevrons. Click a chevron to move the deal.
- **Tables:** sentence-case headers in the body face, sortable columns with icon arrows highlighted in the brand colour, row hover, solid status pills.
- **Auth:** split layout with a solid deep-brand panel and four factual points; 44px controls.
- **Landing:** the hero shows a real screenshot of the product (labelled as the demo workspace), not a drawn mock-up; plain copy; pricing as a comparison table; the page ends on its one action.
- **Copy:** meta lines are written as phrases ("Growth plan, Owner", "Sam Patel, 2 weeks ago"), never glued together with middle dots.

## Hallmark audit

[Hallmark](https://github.com/nutlope/hallmark) (MIT) is installed in `.claude/skills/hallmark`. Its linter was run against the app and the public pages. To re-run it (the browser tier needs `puppeteer-core`, located through `HALLMARK_PUPPETEER`, and Chrome):

```bash
node .claude/skills/hallmark/scripts/sloplint.mjs apps/web/src --genre modern-minimal --scope app
node .claude/skills/hallmark/scripts/sloplint.mjs apps/web/src/app/page.tsx --genre modern-minimal --render --url http://localhost:3000/ --url http://localhost:3000/login
```

| Pass | Before | After |
| --- | --- | --- |
| App screens (static, 58 files) | 73 FAIL, 2 REFLEX, 20 WARN | 1 FAIL, 0 REFLEX, 7 WARN |
| Public pages (rendered at 8 widths) | 14 FAIL, 18 REFLEX, 21 WARN | 1 FAIL, 1 REFLEX, 9 WARN |

The remaining findings were reviewed and kept on purpose:

- **Gate 20 (no Hallmark stamp):** the stamp records a Hallmark build's decisions; this design was not generated by Hallmark.
- **Gate 74 (stock chart colours):** the chart palette was validated for colour-vision deficiency and contrast.
- **Gate 85 and 77 on login/register:** landing-page rules (closing action, section count) applied to sign-in forms.
- **Gate 70 (success with no request):** false positives. The invitation resend calls the API, and the other match is placeholder text.
- **Gate 49 (search label):** the label already truncates and does not wrap.
- **F25 (plan table on phones):** the first column is pinned with `position: sticky`; the detector does not account for it.
- **Gate 58 (word budget):** the security section and the registration form sit at 86 to 89 words, close to the 80-word guide.
