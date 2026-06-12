# @swamp-crocodile/content-helper-core

Framework-agnostic engine behind [`strapi-content-helper`](https://www.npmjs.com/package/strapi-content-helper)
and [`strapi-plugin-content-helper`](https://www.npmjs.com/package/strapi-plugin-content-helper).

It parses Next.js / Astro frontend code (via `ts-morph`) into an intermediate
representation, emits validated **Strapi v5** `schema.json`, and reconciles it with
existing files through an idempotent 3-way merge.

```
discover → parse → IR → emit Strapi v5 schema → 3-way merge → schema.json
```

Most users want the CLI or the plugin instead — this package is the programmatic API:

```ts
import { planSync, applyPlan, hasChanges, renderDiff } from '@swamp-crocodile/content-helper-core';

const plan = planSync({ framework: 'next', appDir: '/app', strapiRoot: '/strapi' });
if (plan.errors.length === 0 && hasChanges(plan.changeSet)) {
  console.log(renderDiff(plan.changeSet));
  applyPlan(plan, '/strapi');
}
```

See the [project README](https://github.com/sridhar-s-subramanian/strapi-plugin-content-helper#readme)
for the full model, conventions, and merge semantics.

## License

MIT © Sivasubramanian Rajamanickam
