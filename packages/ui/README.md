# @app/ui

A shadcn/ui-style, Radix-backed component library for the workspace. The visual direction is deliberately quiet: high-contrast ink, mineral-blue actions, compact radii, and an Armenian-capable font stack for dense administrative work.

## Setup

Load the tokens once in the consuming app's global CSS:

```css
@import "@app/ui/src/theme/tokens.css";
```

For Tailwind v3, add the preset and scan the package source:

```ts
import uiPreset from "@app/ui/tailwind-preset";

export default {
  presets: [uiPreset],
  content: ["./packages/ui/src/**/*.{ts,tsx}", "./apps/web/**/*.{ts,tsx}"],
};
```

For Tailwind v4, retain the CSS import and map the semantic variables into the app's `@theme inline` block. All library classes use semantic names such as `bg-primary` and `text-muted-foreground`; consumers can reskin the system by overriding only the CSS variables.

```tsx
import { Button, Field, FieldLabel, Input } from "@app/ui";

<Field data-invalid={Boolean(error)}>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid={Boolean(error)} {...register("email")} />
</Field>;
```

`Input`, `Textarea`, the native-style `RadioGroup`, `Checkbox`, and `Switch` accept normal field props, so `react-hook-form`'s `register()` can be passed directly. Render the error produced by your Zod resolver in `FieldMessage`; this package intentionally does not own form schemas or validation strings.

## Components

The package exports Button, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Dialog, Drawer, Tabs, Table, DataTable, Card, Badge, Avatar, Toast, Tooltip, Skeleton, EmptyState, Alert, Pagination, DatePicker, and form primitives. `DataTable` is intentionally display-only and receives rows, columns, and pagination state from its caller. `DatePicker` preserves date-only values as `YYYY-MM-DD` and formats the adjacent display using its required `timeZone` prop, preventing date shifts across clients.

`ComponentLibraryDemo` is a self-contained gallery that renders every component. Mount it in an internal route or Storybook story:

```tsx
import { ComponentLibraryDemo } from "@app/ui";

export default function UiDemo() {
  return <ComponentLibraryDemo />;
}
```

## Accessibility

- Keyboard behavior, focus management, and dialog/modal semantics come from Radix primitives.
- `:focus-visible` uses a high-contrast ring; error, warning, success, and selection states also have text/icon/border indicators rather than relying on color alone.
- Motion is disabled under `prefers-reduced-motion`.
- Overlay close controls and pagination labels are caller-supplied so they can be localized. Provide `DialogTitle` / `DrawerTitle`, `aria-label` values for icon-only controls, `AvatarFallback`, and a visible `FieldLabel` (or equivalent accessible name).
- The font stack includes `Noto Sans Armenian` and `DejaVu Sans` fallbacks. Host apps should load Noto Sans Armenian when they need a guaranteed Armenian webfont.

Run axe against the mounted gallery in the consuming app as part of browser-level CI; its supplied labels and semantic headings are designed to produce no critical violations.
