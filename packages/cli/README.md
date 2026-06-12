# strapi-content-helper

CLI to generate and keep in sync your **Strapi v5** content model (components, single
types, collection types, dynamic zones) from your **Next.js** or **Astro** frontend code.

```bash
pnpm add -D strapi-content-helper
npx strapi-content-helper init      # writes content-helper.config.json
npx strapi-content-helper generate  # write/patch Strapi schema.json files
```

## Commands

```bash
strapi-content-helper generate            # write/patch schema files
strapi-content-helper generate --dry-run  # show the diff, write nothing
strapi-content-helper generate --prune    # also remove fields the source no longer produces
strapi-content-helper generate --force    # overwrite attributes you edited manually
strapi-content-helper check               # exit 1 if the model is out of date (CI gate)
```

After a `generate` that changed files, **restart Strapi** for it to pick up the new schema.

Pages opt in by exporting a `CmsContent` type; static routes become single types and
dynamic routes become collection types. See the
[project README](https://github.com/sridhar-s-subramanian/strapi-plugin-content-helper#readme)
for conventions, `@cms` annotations, config, and merge semantics.

## License

MIT © Sivasubramanian Rajamanickam
