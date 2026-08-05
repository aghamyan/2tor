# Varzharan landing page - session handoff

Written for a fresh session with no prior context. Read this before touching `landing/`.

---

## 1. What this is

A **static, UI-only landing page** for Վարժարան (Varzharan) - a managed online school
connecting Armenian-American K-12 students in the US with vetted Armenian teachers in
Armenia. Currently math-only.

```
landing/
  index.html    401 lines
  styles.css   1601 lines
  main.js       380 lines
  HANDOFF.md    this file
```

No build step, no dependencies, no backend. Open `index.html` directly, or serve it
(`python3 -m http.server`) if you need to screenshot it - Playwright refuses `file://`.

**Explicitly out of scope so far:** any backend, forms that submit, routing, i18n.
Every link is a `#` placeholder.

### Source of truth for the brief

`../project_description.rtf` (read with `textutil -convert txt -stdout`). Key positioning
line, which has driven several decisions: *academic, institutional, warm - explicitly NOT
a children's gaming app and NOT an AI startup.*

---

## 2. Where we started

The user asked for a landing page referencing **dasa2.com**, calling it "pure garbage
design-wise," and asked to enhance toward apple.com-grade polish. Constraints given:
beautiful, simple, **not text heavy**, and *"IT MUST BE VERY EASY TO UNDERSTAND WHAT IS
WHERE."*

### The dasa2.com audit (fetched and analysed, not assumed)

What it does wrong, and what this page deliberately does instead:

| dasa2.com | This page |
|---|---|
| Hero reads "expert tutors \| private classes" - sells a *marketplace* | Hero sells a *school*: "Math tutoring that runs like a school." |
| 15 tutor headshots dumped in a flat grid | A scroll-snap rail, browsable without becoming a directory |
| YouTube embeds treated as page content | Cut entirely |
| Never explains what happens after you enroll | The four-step process is the spine of the page |

The whole differentiator from the brief - assessment → personalised plan → dedicated
teacher → visible progress - is invisible on dasa2. It is the centre of this page.

### Page structure (6 content sections)

`#top` hero → facts strip → `#how` four steps → `#subjects` bento → `#progress` record
card + teacher note + quote → `#teachers` rail → `#enroll` CTA → footer.

Deliberately capped at 6 sections. An earlier 11-section plan was cut because it
contradicted "not text heavy."

---

## 3. What we used

### Skills
- **`design-taste-frontend`** (v2) - the anti-slop rules. Drove: section count, the
  em-dash ban, eyebrow budget, "no div-based fake screenshots," the banned-palette lists.
  Its **anti-default palette rotation** is what produced the final colour direction.
- **`apple-design`** - materials/translucency, spring vs. damping guidance, the vibrancy
  rule (never muted grey on glass), "never stack a light translucent surface on another."
- **`ui-ux-pro-max`** - used its raw CSVs directly:
  `~/.claude/plugins/cache/ui-ux-pro-max-skill/ui-ux-pro-max/2.11.0/cli/assets/data/`
  (`colors.csv`, `typography.csv`).

### MCP
- **Playwright** - used constantly, and not just for screenshots. It was the measuring
  instrument: computed styles, `getBoundingClientRect`, `getAnimations()` progress,
  `document.fonts` state, `matchMedia` emulation. **Nearly every real bug in this page
  was found by measuring, not by looking.**

### Not used, and why
- **GSAP / Motion / any animation library** - the final motion system uses native
  scroll-driven animations, which run off the main thread and are scrubbable. Adding a
  library to a zero-dependency static page would have been a downgrade.
- **Figma / Canva MCP** - they generate designs, not photography. Wrong tool for the
  asset gap.
- **Image generation** - no image tool available in this environment. See §7.

### Verification method (please keep this up)
Two habits did most of the quality work:

1. **Contrast by calculation, never by eye.** A throwaway Python script computes WCAG
   ratios including **alpha compositing** (glass over its backdrop, scrim over a
   worst-case pure-white photo, `color-mix` results). Numbers are recorded in the
   `styles.css` header comment.
2. **Measure the DOM instead of trusting a screenshot.** Screenshots are downsampled and
   lie; several "problems" turned out to be scaling artifacts, and several real bugs were
   invisible at screenshot resolution.

---

## 4. What did not work

Genuinely useful negative results. Do not re-try these.

### 4.1 SVG `feDisplacementMap` for glass refraction - REJECTED
`backdrop-filter: url(#filter)` **does work** in Chromium. Both a `feTurbulence` map and a
radial gradient map were built and rendered over a high-contrast stripe backdrop.

- Turbulence → melting wobble. Looks broken, not like glass.
- Radial map → breaks the frost and produces hard edges.

Neither resembles iOS Liquid Glass. Dropped. If you revisit this, test visually first -
support is not the problem, appearance is.

### 4.2 Glass v1 - user called it "pure garbage," and was right
Two independent faults:
- The edge lens used a `content-box` XOR mask, which draws a **hard inner rectangle** in
  every card. Reads as a rendering bug.
- `--glass-bg` was a bone tint over a bone page. Glass and backdrop were the same colour,
  so the blur had nothing to do.

Fixed by a 5-recipe side-by-side lab (see §5.2). **If a surface would look identical with
`backdrop-filter: none`, it is not glass - it is a tinted div.** Apply that test to any
new glass surface.

### 4.3 Navy + gold palette - rejected as "too AI"
Started at `#1E3A5F` + `#B45309` from `colors.csv` row 163 (*Academic Journal*). The user
rejected it. They were right, and the design skill agrees: `#B45309` sits in the
documented **brass/ochre** banned family, and navy+gold is the reflex pick for anything
academic.

**`colors.csv` is not useful for escaping this.** Searched it for alternatives; it only
offers Tailwind defaults (teal/orange, indigo, pink) which read *more* templated. Use the
design skill's anti-default rotation list instead.

### 4.4 Steps section - three failed iterations
1. Four stacked paragraph blocks (~1000px tall) → *"heavy to follow."*
2. Timeline with per-step connectors → three loud orange dashes, row stopped dead after
   `04`.
3. Continuous rail, nodes left-aligned in columns → *"kinda misplaced."* Measurement
   confirmed it: 131px of air on the left, **234px on the right**.

Now: centred nodes + subgrid (§5.1).

### 4.5 `ui-ux-pro-max` education classification is wrong for this brief
It classifies "education" as kids' edtech and returns Claymorphism and playful palettes.
Wrong every time for this project. Same for its `typography.csv` Academic/Research pairing
- it recommends **Crimson Pro** for headlines, which has **zero Armenian glyph coverage**,
and the brand name is Armenian script.

### 4.6 Tooling gotchas that cost time
- **Chromium restores scroll position on `reload()`.** This produced a reading that looked
  exactly like inverted nav logic. Always `history.scrollRestoration = 'manual'` before
  measuring scroll-dependent state.
- **`page.setViewportSize()` inside `browser_run_code_unsafe` silently does nothing** once
  the MCP browser has its own viewport. Use the `browser_resize` MCP tool. If it sticks,
  `browser_close` then re-navigate.
- Screenshots from `browser_run_code_unsafe` land in the Playwright server's CWD, which is
  not reachable. Use the `browser_take_screenshot` tool with a path under the project.

---

## 5. What we liked (keep these)

### 5.1 Steps: centred nodes + CSS subgrid
Nodes centred in their columns → rail runs centre-to-centre → **131px of air on each
side**, symmetric. Verified at 1000/1280/1440: rail lands on the first and last node
centres with delta 0.

`.steps` declares three rows (node / heading / body); each `.step` opts in with
`grid-template-rows: subgrid`. A heading that wraps to two lines can no longer knock its
neighbours' body copy off the baseline. Measured: nodes 371, headings 447, body 479,
identical across all four columns. `@supports not` falls back to a flex column.

Desktop uses one continuous rail (`.steps::before`); **mobile keeps the per-step
`.step__link` connectors**, because a single rail cannot know where the last node's centre
sits once rows stack.

### 5.2 The glass material
Built from a 5-recipe visual lab. The cue that actually sells it is the **offset
specular**: `inset 2px 3px 0 -2px` with negative spread draws a hairline highlight just
inside the top-left edge, plus a dimmer bounce bottom-right. Plus chromatic fringing (warm
one edge, cool the other), an inner bloom, and a **radially-masked** outer lens halo (no
hard boundary).

Equally important: glass needs a real backdrop. `--field-1/2/3` are **light but
saturated** - enough colour to refract, light enough that text still clears AA.

Glass lives in exactly three placements, each chosen by the blur-off test: the nav, the
facts cards (over the gradient field), and the chips over photography. That is 5 elements
carrying `.glass` plus `.nav__bar`, which shares the recipe without the class.

### 5.3 The nav
Measured from **roseart.io** with Playwright rather than guessed:

| | at top | scrolled |
|---|---|---|
| width | 1440 | 1120 |
| height | 72 | 60 |
| y | 0 | 12 |
| radius | 0 | pill |
| surface | transparent | glass |

Plus a **scrollspy**: one pill that glides and restretches between labels, driven by a
thin band (`rootMargin: -42% 0px -52%`). Clicking pins the highlight to its target so the
smooth scroll doesn't strobe through intermediate sections.

### 5.4 The motion system
Native **scroll-driven animations** (`animation-timeline: view()`). Elements morph in as
they rise and out as they leave, and it is scrubbable - scroll up and it plays backwards.
Stagger comes from shifting each sibling's `animation-range` via `--i`.

Plus: headlines split into masked words that rise individually (`--w` stagger), hero
parallax, and a count-up on the progress figure.

### 5.5 Semantic colour in the record card
The user correctly flagged that vermillion on a *rising* test score reads as a warning.
There is now a `--positive` tone **separate from the brand accent**:
- green → progress bar, `68%`, `↑ 62% to 84%`, "Mastered"
- vermillion → **only** the "In review" dot, the one thing needing work
- neutral → all values, including "Next up"

---

## 6. What we disliked / rejected

- **Em-dashes.** Zero on the page. Audited every round. Note the user's own reference
  screenshot contained one (`Solid concept - needs fluency`); it was rewritten.
- **Fake dashboards.** The record card is a designed data card, not a simulated product
  screenshot. Keep it that way.
- **Invented statistics.** The `62% → 84%` figure comes from the project brief. The card
  is labelled "Sample record."
- **Stock headshots for teachers.** Deliberately monograms. Random strangers on a page
  whose pitch is "vetted Armenian teachers" is worse than an honest placeholder.
- **Pricing.** Cut - the brief says pricing is unvalidated, so inventing tiers would be
  fabrication.
- **Hover-tilt on the bento.** Considered and rejected: there is already lift + a cursor
  spotlight, and a third hover behaviour reads as fidgety and fights the spotlight's
  pointer handler.
- **Eyebrows.** Zero section eyebrows across 6 sections (budget was 2).

---

## 7. Known gaps / open risks

### Placeholder assets (the biggest gap)
| Where | Current | Needs |
|---|---|---|
| Hero | `picsum.photos/id/24` (an open book) | Real photo of a lesson in progress, portrait ~1000×1250 |
| High-school tile | `picsum.photos/id/180` | Landscape ~1200×900 |
| Competition tile | `picsum.photos/id/42` | Landscape ~900×700 |
| Teachers ×6 | Invented names + monograms | Real vetted staff + headshots |

### Technical debt
- **Fonts load from Google via `<link>`.** Fine for a prototype, should be self-hosted
  before production. Note `Noto Sans Armenian` is in **both** stacks - without it,
  Վարժարան falls back to an arbitrary system font. Verified via
  `document.fonts.check('600 64px "Noto Sans Armenian"', 'Վ')`.
- **Browser matrix untested.** Everything was verified in Chrome 150 only. Specifically
  unverified in Safari/Firefox: scroll-driven animations, `subgrid`, `color-mix()`,
  `mask-composite`, `:has()`-free but `@supports`-gated paths. All have fallbacks, none
  are verified.
- **No Lighthouse run.** LCP/INP/CLS unmeasured. The blur-heavy morphs are the thing to
  watch on low-end hardware.
- **`--glass-border` and `--glass-hi`** survive from the old material and are each used in
  only one place. Candidates for cleanup.

---

## 8. Next steps (suggested order)

1. **Replace the four placeholder assets.** Nothing else changes the perceived quality as
   much. Until then the page reads as a template.
2. **Browser matrix.** Safari + Firefox. Confirm the `@supports` fallbacks actually engage
   rather than degrading into something broken.
3. **Lighthouse + a low-end device profile.** If the morphs cost too much, `--mb` (morph
   blur) is already a per-element dial - turn it down before removing animations.
4. **Self-host the fonts**, keeping the Armenian face in both stacks.
5. **Decide the palette question with the user.** This page is pine/bone/vermillion. Per
   an existing project memory the live site elsewhere is **crimson `#b4123a`**. If brand
   continuity matters, the swap is five tokens: `--accent`, `--accent-on`, `--block`,
   `--block-on`, `--scrim` (plus `--field-*` for the glass backdrop). That claim is
   maintained deliberately - keep it true.
6. **Then, if the direction is approved:** port into `apps/web` (Next.js + Tailwind v4 +
   shadcn, per the repo README), add the enrollment form, and wire i18n (`next-intl`) with
   Armenian as a real locale - tag Armenian runs `lang="hy"`, as the current markup already
   does.

---

## 9. House rules to preserve

Carried through every round; breaking them will be a regression.

- **Zero em-dashes** anywhere visible.
- **Contrast by calculation**, including alpha compositing, before shipping any new
  colour pairing. Update the `styles.css` header block when you do.
- **No scroll listeners for animation.** IntersectionObserver, or scroll-driven CSS. The
  one exception is a passive listener on the teacher rail that only syncs arrow disabled
  state - it drives no animation and is documented in `main.js`.
- **Reduced motion and reduced transparency are real code paths**, not afterthoughts.
  Anything that starts at `scale(0)` must settle to *drawn*, not *invisible*.
- **One accent for brand emphasis**, plus `--positive` strictly for semantic status.
- **Every animation must be justifiable in one sentence** (hierarchy / storytelling /
  feedback / state change).

---

## 10. Bug log

Every one of these was found by measuring, and each is a pattern worth remembering.

| # | Bug | Cause |
|---|---|---|
| 1 | Step paragraphs rendered as 40px-wide slivers | Three grid children, not two - `<p>` wrapped into the numeral column |
| 2 | Mobile menu CTA unreadable | `.mobile-menu a` (0,1,1) outranks `.mobile-menu__cta` (0,1,0) |
| 3 | Burger close state was a chevron, not an X | Grid rows stretched to fill the button; strokes 21.5px apart, not 6.5px. Needed `place-content` |
| 4 | Stray spaces inside quote marks | HTML whitespace collapsing around the `<p>` text |
| 5 | Glass drew a rectangle inside every card | `content-box` XOR mask has a hard inner edge |
| 6 | Rail overshot the last node by 206px | `right: 28px` measures from the container, not from the left-aligned last node |
| 7 | Reduced-transparency fallback did nothing | Rim moved from `border` to inset shadow; fallback still set `border-color` on a borderless element |
| 8 | Photo chips white-on-white in reduced transparency | Fell back to `--surface` while keeping white text |
| 9 | Progress bar vanished on mobile | `width: 100%` inside a shrink-to-fit flex parent resolves to zero |
| 10 | Delta text at 4.44:1 | Six hundredths under AA-body, and 14.7px so it does not qualify as large text |
| 11 | **Entry morph never rendered** | `morph-out` with `fill: both` applies its from-keyframe during its before-phase and, being later, overrides `morph-in` entirely. Needs `forwards` |
| 12 | ~60 words each promoted to a compositor layer | `will-change: transform` on every `.word__inner` |

---

## 11. Quick reference

```bash
cd landing && python3 -m http.server 8747      # then http://localhost:8747/index.html
```

Structural conventions:
- `data-reveal` (36) - opts an element into the morph system; `--i` staggers siblings
- `data-split` (6) - headline is split into masked words by `main.js`; `--w` staggers them
- `data-count` (1) - count-up on scroll into view
- `data-state` (3) - semantic row state in the record card (`done` / `review` / `next`)
- `.glass` - the shared liquid-glass material. **Only use it where something real sits
  behind it.**
