# strapi-content-helper

Generate and keep in sync your **Strapi v5** content model (components, single types,
collection types, dynamic zones) directly from your **Next.js** or **Astro** frontend code —
with as little extra authoring as possible.

The frontend team builds pages and storyboard components first. This tool reads that code and
writes the matching Strapi `schema.json` files, so nobody has to recreate the model by hand in
the Content-Type Builder, and the two never drift.

> Status: core engine, CLI, and Next.js + Astro support are implemented and tested.
> The Strapi admin plugin is included for dev-mode use. See [PRD.md](./PRD.md) for the task map.

---

## How it works

Strapi reads every `schema.json` at startup and syncs the database automatically — there is no
safe runtime API to mutate content types. So the tool **writes/patches `schema.json` files and
you restart Strapi**. Re-runs are a **3-way merge**: new fields are added, your manual Strapi-side
edits are preserved, and nothing is deleted without an explicit flag.

```
frontend code ──▶ parse (ts-morph) ──▶ IR ──▶ Strapi v5 schema ──▶ 3-way merge ──▶ schema.json
                                                                         ▲
                                                              lockfile + files on disk
```

## What maps to what

| Frontend signal | Strapi output |
|---|---|
| Static route (`app/about/page.tsx`, `src/pages/about.astro`) exporting `CmsContent` | **single type** |
| Dynamic route (`app/blog/[slug]/page.tsx`, `src/pages/blog/[slug].astro`) | **collection type** |
| Astro content collection (`src/content.config.ts` Zod schema) | **collection type** |
| A component's props interface / nested object | **component** |
| Array of objects | **repeatable component** |
| Array of a union of component types (`blocks: (Hero \| Cta)[]`) — the storyboard | **dynamic zone** |
| `{ url, alt, … }` / `ImageProps` / prop named `cover`/`gallery`/… | **media** (array ⇒ multiple) |
| String-literal union (`'sm' \| 'lg'`) | **enumeration** |
| `@cms relation <kind> <target>` annotation | **relation** |

## The opt-in convention

A page becomes a content type only when it **exports a `CmsContent` type**. Its fields come from
that type (not from the page's `params`/`searchParams`). Pages without `CmsContent` are ignored,
so dashboards, auth pages, and API-backed `[id]` pages never generate junk content types.

```tsx
// app/blog/[slug]/page.tsx  ->  collection type "blog"
import type { HeroProps, CtaProps, ImageProps } from '@/components/blocks';

export interface CmsContent {
  title: string;
  cover: ImageProps;                 // -> media
  /** @cms richtext */
  body: string;                      // -> richtext
  status: 'draft' | 'published';     // -> enumeration
  blocks: (HeroProps | CtaProps)[];  // -> dynamic zone
  /** @cms relation manyToOne author */
  author: string;                    // -> relation api::author.author
}
```

For Astro, the same `CmsContent` export works in `.astro` frontmatter, and **content collections**
in `src/content.config.ts` are read directly from their Zod schemas.

## `@cms` annotations

Put a JSDoc tag on a prop for things types can't express:

- `@cms ignore` — exclude this prop.
- `@cms richtext` (or `text`, `decimal`, `media`, any Strapi scalar) — override the inferred type.
- `@cms relation <oneToOne|oneToMany|manyToOne|manyToMany> <target>` — declare a relation.

UI-only props (`className`, `style`, `children`, `key`, `ref`, functions) are filtered automatically.

## Install & configure

```bash
pnpm add -D strapi-content-helper
npx strapi-content-helper init    # writes content-helper.config.json
```

```jsonc
// content-helper.config.json
{
  "framework": "next",            // or "astro"
  "frontendRoot": ".",            // base for appDir/srcDir/tsconfig
  "appDir": "app",                // Next: app dir (auto-detected if omitted)
  // "srcDir": "src",             // Astro: src dir
  "strapiRoot": "../strapi",      // path to the Strapi project
  "markerName": "CmsContent",
  "componentCategory": "sections",
  "ignore": ["admin/**"],
  "namespaceBySource": false      // prefix names per source to avoid Next/Astro collisions
}
```

## CLI

```bash
strapi-content-helper generate            # write/patch schema files
strapi-content-helper generate --dry-run  # show the diff, write nothing
strapi-content-helper generate --prune    # also remove fields the source no longer produces
strapi-content-helper generate --force    # overwrite attributes you edited manually
strapi-content-helper check               # exit 1 if the model is out of date (CI gate)
```

After a `generate` that changed files, **restart Strapi** (`npm run develop`) for it to pick up
the new schema.

## Merge semantics (safe re-runs)

- **Add**: new generated fields are added.
- **Update**: a generated field you didn't touch is updated to match the source.
- **Keep**: a field you edited manually (that the generator didn't change) is preserved.
- **Conflict**: both sides changed — your edit is kept and reported; `--force` takes the generator's.
- **Remove**: a field the source dropped is kept and reported; `--prune` actually deletes it.
- **Rename**: a removed+added pair of identical shape is flagged as a probable rename and is
  **never auto-pruned** (Strapi treats a rename as drop+add and would lose the column's data).

State is tracked in `<strapiRoot>/.content-helper/lock.json` (the merge base). Commit it.

## CI

```yaml
- run: npx strapi-content-helper check   # fails the build if frontend & Strapi drifted
```

## Strapi admin plugin (dev only)

The `@strapi-content-helper/plugin` package exposes a **"Sync content model"** action in the
admin settings that previews the diff and applies it. It is **guarded to development mode** —
production Strapi typically runs from a read-only image and cannot rewrite its own `src/`. In
production, run the CLI in CI, commit the schema files, and deploy.

## Packages

| Package | Purpose |
|---|---|
| `@strapi-content-helper/core` | Framework-agnostic engine: parse → IR → emit → 3-way merge |
| `strapi-content-helper` (CLI) | `generate` / `check` / `init` |
| `@strapi-content-helper/plugin` | Strapi v5 plugin (dev-mode sync + admin preview) |

## Development

```bash
pnpm install
pnpm build
pnpm test            # unit + fixture + golden tests
UPDATE_GOLDENS=1 pnpm test   # refresh golden schema files after an intentional change
```
