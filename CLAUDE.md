# Working in this repo

Notes that cost real time to discover. Everything here was verified by measurement, not inferred.
Code comments carry the detail; this is the index so you don't have to go find them first.

## Public surfaces

`apps/web/app/(marketing)/*` — home, `/how-it-works`, `/group-lessons`, `/parents`, subject pages,
`/consultation`, `/login`. The design system (`--vz-*`) is scoped to `[data-surface="vz"]`, set by
`app/(marketing)/layout.tsx`. It cannot reach `app/(app)/*`, whose dashboards keep their own palette.

Shared across public pages — change these rather than copying:

| Thing | Lives in |
| --- | --- |
| Design tokens | `app/globals.css` |
| Page ground: ruled grid + blooms + parallax | `components/marketing/section-ground.tsx` |
| Section eyebrow + `accentedTitle` | `components/marketing/section-heading.tsx` |
| Scroll-linked depth | `components/marketing/parallax-field.tsx` |
| Header, footer, buttons, nav | `components/marketing/site/site.module.css` |

**Most of `components/marketing/home/` is dead code.** Only eight files are reachable from
`index.tsx`: `content`, `hero`, `compact-home`, `classroom-boards`, `home-sections`, `closing-cta`,
`reveal`, and `index` itself — and the only stylesheet they reach is `compact-home.module.css`.

Everything else there (`premium-home`, `premium-content`, `home.module.css`, `final-cta`, `subjects`,
`testimonials`, `trust-bar`, `tutors`, `why-choose-us`, `for-parents`, `safety-strip`,
`scroll-reveal`, `icons`, `how-it-works`, `project-based-learning`, `home-sections 2`) is an older
design that still imports itself, so a naive "who imports this?" grep makes it look live. Recompute
reachability from `index.tsx` before trusting that a file matters.

## Colour: pick the token for the job, not the one that looks right

- `--vz-accent` (vermillion) measures **4.68:1 on paper** — fine for fills, rules, icons and large
  text. It does **not** clear AA as small text, and drops to ~3.6:1 over the field tints.
- `--vz-accent-ink` exists for accent-as-text. Use it for anything under heading size.
- `--vz-muted` measures **~2.25:1 on the pine block** and must never be used there.
- `--vz-positive` is a dark green and disappears on pine (1.73:1). On the block use `--vz-field-1`.
- `--vz-line` is a **content** hairline (1.15:1 on paper). When a border is the only thing
  identifying a control, use `--vz-line-strong` (3.08:1, WCAG 2.2 §1.4.11).
- On the pine block only `--vz-block-on` at alpha, `--vz-field-1` and `--vz-field-2` read as text.

**Darkening a surface is a contrast change for everything on it.** Both must move together. This
caused three separate AA regressions in one session.

## Traps that fail silently

**Cascade.** `app/(marketing)/surface.module.css` has `.surface :is(h1,h2,h3,h4)` at (0,2,0). A bare
`.myHeading` at (0,1,0) loses — the home hero declared `letter-spacing: -0.071em` and
`line-height: 0.94` and rendered neither. Scope through a parent (`.page h1.heroTitle`, (0,2,1)).
Verify against the live cascade (Playwright + CDP `CSS.getMatchedStylesForNode`), not the source. Both big stylesheets also have a preflight
`.page h1,h2,h3,p,ul { margin: 0 }` at (0,1,1) that silently zeroes single-class margins.

**Framer inline transforms.** `motion` writes `x`/`y`/`scale` to the element's inline `transform`,
which beats any class. An animated node **cannot** also carry a CSS transform for positioning or
centring — it loses it, with no error. Split into a plain positioned wrapper + an inner motion node.
Hit four times in one session; check for it first when something is off-centre or off-canvas.

**Positional selectors.** `:last-of-type` / `:last-child` retarget when you add or remove a sibling.
Replacing a `<p>` with a `<ul>` handed a body-copy rule to the section's eyebrow.

**Font axis limits.** Instrument Sans is loaded variable, `wght 400–700`. Anything above 700 clamps
and renders identically — 640/650/700/720/750/800/850 were all one weight. Atkinson Hyperlegible has
no variable face and ships **only 400 and 700**: `font-weight: 500` renders 400, `600` renders 700.

**`ch` units** measure the first *available* font. A measure calibrated on Latin means something else
in `hy`, which falls through to Noto Sans Armenian.

## Armenian is not a size variant of English

`--vz-display` has no Armenian coverage. Latin tracking does not transfer: at `-0.028em` the `hy`
hero ran 5 lines against English's 3 and pushed the CTAs below the fold at 1366×768. There is a
`:lang(hy)` block in `compact-home.module.css`. **Always screenshot both locales** — several defects
this session appeared only in `hy`, where labels run longer.

Accent phrases in headings follow **meaning, not position**: the same idea usually lands elsewhere in
the Armenian sentence.

## Verifying

The a11y suite (`tests/a11y/`) needs Docker and won't run on a plain dev box. Substitute: inject
`axe-core` from `node_modules` with Playwright and run the `wcag2a/2aa/21aa/22aa` tags.

**axe is not sufficient here.** It defers `color-contrast` to `incomplete` whenever it can't resolve
the background — which is every element over a bloom, gradient or glass surface. It reported **zero**
while a card header sat at 1.26:1. Sample real pixels (screenshot the element, decode with `sharp`,
compare darkest vs lightest) for anything on glass or a tinted ground.

Check at 390 / 768 / 1024 / 1440, in both locales, and with `prefers-reduced-motion` — reduced motion
must show the **finished** state, not a faster animation.

## Glass

`globals.css` states the test: if a surface would look identical with `backdrop-filter: none`, it is
not glass, it is a tinted div. It needs real content behind it — pass `blooms` to `SectionGround`,
not just a mask. `prefers-reduced-transparency` is a real code path: the rim is an inset shadow and
vanishes with the material, so the fallback must draw a border.

## Conventions

- Commit as you go. "Restore the previous version" is expensive when nothing is committed.
- `.playwright-mcp/` scratch dumps and `.claude/settings.local N.json` duplicates keep getting
  committed; they shouldn't be.
- Impeccable config is read from `<cwd>/.impeccable/config.json`, and `apps/web` counts as a project
  root (it has a `package.json`). An ignore added at the repo root is **invisible** to the hook —
  it must exist in `apps/web/.impeccable/config.json` too.
