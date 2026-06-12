import { describe, expect, it } from 'vitest';
import { parseAstroRoute } from './astro-route.js';

describe('parseAstroRoute', () => {
  it('maps index to a home single type', () => {
    expect(parseAstroRoute('index.astro')).toMatchObject({ ok: true, kind: 'single', name: 'home' });
  });
  it('maps a static page to a single type', () => {
    expect(parseAstroRoute('about.astro')).toMatchObject({ ok: true, kind: 'single', name: 'about' });
  });
  it('maps a dynamic page to a collection type', () => {
    expect(parseAstroRoute('blog/[slug].astro')).toMatchObject({
      ok: true,
      kind: 'collection',
      name: 'blog',
    });
  });
  it('maps a section index to its folder name', () => {
    expect(parseAstroRoute('blog/index.astro')).toMatchObject({ ok: true, name: 'blog', kind: 'single' });
  });
  it('skips catch-all and private files', () => {
    expect(parseAstroRoute('legal/[...slug].astro').ok).toBe(false);
    expect(parseAstroRoute('_draft.astro').ok).toBe(false);
  });
});
