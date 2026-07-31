# Marketing slice

This route group is server-rendered. The lead form is the only interactive marketing component;
there are no ad, social, or third-party analytics scripts. It uses local system fonts and no hero
images, avoiding a render-blocking font/image request and reserving the full layout before paint.

## SEO and accessibility

- Each route has a descriptive title and the FAQ route emits `FAQPage` JSON-LD.
- Semantic headings, labelled inputs, native disclosure controls, keyboard focus, and reduced-motion
  styles are included. Run `pnpm --filter web test` and the project’s browser/axe checks after
  deploying to verify the production bundle.
- The testimonial component only accepts verified, parent-consented, non-identifying testimonials;
  its type rejects child names and photos.

## Lead retention and deployment handoff

`/api/leads` validates minimal input, rejects spam through a honeypot, and rate-limits each IP to
five attempts per ten minutes. Every accepted record has `retentionUntil = createdAt + 90 days`.
The allowed file scope does not include a database migration, so `store.ts` is an explicit adapter
seam and currently process-local. Wire it to the approved durable lead store and schedule deletion
by `retentionUntil` before production.

The existing `(app)/page.tsx` already owns `/`, so the public home lives at `/home` to avoid two
route groups resolving to the root path. To make the public home own `/`, the authenticated root
route must be moved or removed by its owner. The marketing URLs are explicitly allowlisted in
`apps/web/proxy.ts`; add any future public slug there as part of the same change.
