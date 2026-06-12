import { describe, expect, it } from 'vitest';
import { parseAppRoute } from './next-route.js';

describe('parseAppRoute', () => {
  it('classifies a static route as a single type', () => {
    expect(parseAppRoute('about/page.tsx')).toMatchObject({ ok: true, kind: 'single', name: 'about' });
  });

  it('classifies a dynamic route as a collection type', () => {
    expect(parseAppRoute('blog/[slug]/page.tsx')).toMatchObject({
      ok: true,
      kind: 'collection',
      name: 'blog',
    });
  });

  it('treats the root page as a single type named home', () => {
    expect(parseAppRoute('page.tsx')).toMatchObject({ ok: true, kind: 'single', name: 'home' });
  });

  it('makes route groups transparent', () => {
    expect(parseAppRoute('(marketing)/pricing/page.tsx')).toMatchObject({
      ok: true,
      kind: 'single',
      name: 'pricing',
    });
  });

  it('skips catch-all and optional catch-all routes', () => {
    expect(parseAppRoute('docs/[...slug]/page.tsx').ok).toBe(false);
    expect(parseAppRoute('shop/[[...all]]/page.tsx').ok).toBe(false);
  });

  it('skips parallel slots and intercepting routes', () => {
    expect(parseAppRoute('@modal/page.tsx').ok).toBe(false);
    expect(parseAppRoute('feed/(.)photo/page.tsx').ok).toBe(false);
  });

  it('skips private folders', () => {
    expect(parseAppRoute('_internal/page.tsx').ok).toBe(false);
  });

  it('rejects non-page files', () => {
    expect(parseAppRoute('about/layout.tsx').ok).toBe(false);
  });
});
