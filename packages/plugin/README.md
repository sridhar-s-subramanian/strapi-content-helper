# strapi-plugin-content-helper

Strapi v5 plugin that generates your content model from Next.js / Astro frontend code,
with a **"Sync content model"** action in the admin settings that previews the diff and
applies it.

> **Development only.** Generating schemas rewrites files under the Strapi project's
> `src/` and requires a restart — neither is safe in a typical production deployment
> (read-only image, no self-restart). The plugin guards the apply action to dev mode.
> For production, run the [`strapi-content-helper`](https://www.npmjs.com/package/strapi-content-helper)
> CLI in CI, commit the generated schema files, and deploy.

## Install

```bash
pnpm add strapi-plugin-content-helper
```

Configure the frontend location in `config/plugins.ts`:

```ts
export default () => ({
  'content-helper': {
    enabled: true,
    config: {
      framework: 'next',          // or 'astro'
      frontendRoot: '../web',     // relative to the Strapi project root
      appDir: 'app',              // Next app dir (or srcDir for Astro)
    },
  },
});
```

Then open **Settings → Content Helper → Sync content model**, review the diff, and apply
(in development). Restart Strapi afterward.

See the [project README](https://github.com/sridhar-s-subramanian/strapi-plugin-content-helper#readme)
for the full model and conventions.

## License

MIT © Sivasubramanian Rajamanickam
