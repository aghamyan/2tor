# `@app/i18n`

The supported interface locales are English (`en`, the default) and Armenian (`hy`). Interface language is deliberately separate from content language: use `interfaceLocale` for UI, dates, and numbers; retain a separate `contentLocale` for user content, search, or filtering.

## Message modules

Each domain owns a paired message module:

```
messages/en/<module>.json
messages/hy/<module>.json
```

The JSON should be namespaced by the module name, so modules never collide:

```json
{ "billing": { "invoice": { "title": "Invoice" } } }
```

`getMessages(locale)` automatically globs and deeply merges every `messages/<locale>/*.json` file. Do not add module imports to a central index. Duplicate message keys are rejected.

Use typed translations in React components:

```tsx
import { useTranslations } from "next-intl";

const t = useTranslations("common.actions");
return <button>{t("save")}</button>;
```

The `next-intl` module augmentation is based on `messages/en/common.json`; when adding a new module, extend the English message type source as part of the owning module's integration if full cross-module compile-time key checking is needed. Runtime loading always includes every module.

## Locale detection and switching

Use `detectLocale(request.headers.get("accept-language"))` for an initial interface locale, then load `await getMessages(locale)`. Render `I18nProvider` with those values. `LocaleSwitcher` is controlled: persist the selected UI locale in the host app and rerender the provider with the chosen locale and that locale's messages. `NextIntlClientProvider` is keyed by locale, so translated strings rerender on switch.

## Display formatting

Use `formatNumber`, `formatCurrency`, `formatDate`, and `formatDateTime`. The date helpers require the user's IANA time zone (for example, `Asia/Yerevan`) and only apply it during display; they do not mutate or reinterpret stored instants.

## CI translation parity

Run this command in CI:

```sh
pnpm exec tsx packages/i18n/src/checkMessageParity.ts
```

It exits non-zero when a leaf key exists in English but not Armenian. It deliberately permits Armenian-only keys while migration is in progress.
