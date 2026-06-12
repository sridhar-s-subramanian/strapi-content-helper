import { describe, expect, it } from 'vitest';
import { createInMemoryProject } from '../parse/type-reader.js';
import { discoverNext } from './next.js';

function discover(files: Record<string, string>, ignore?: string[]) {
  const project = createInMemoryProject(files);
  return discoverNext({ appDir: '/proj/app', project, ignore });
}

describe('discoverNext', () => {
  it('discovers opted-in static and dynamic pages and ignores the rest', () => {
    const result = discover({
      '/proj/app/about/page.tsx': `export interface CmsContent { heading: string; }`,
      '/proj/app/blog/[slug]/page.tsx': `export interface CmsContent { title: string; }`,
      // not opted in -> ignored silently
      '/proj/app/dashboard/page.tsx': `export default function Page() { return null; }`,
      // API-backed detail page, not opted in
      '/proj/app/products/[id]/page.tsx': `export default function Page() { return null; }`,
    });

    const byName = Object.fromEntries(result.models.map((m) => [m.name, m]));
    expect(Object.keys(byName).sort()).toEqual(['about', 'blog']);
    expect(byName.about.kind).toBe('single');
    expect(byName.blog.kind).toBe('collection');
    expect(byName.about.read.object.fields.map((f) => f.name)).toEqual(['heading']);
  });

  it('warns about opted-in pages on unsupported routes', () => {
    const result = discover({
      '/proj/app/docs/[...slug]/page.tsx': `export interface CmsContent { body: string; }`,
    });
    expect(result.models).toHaveLength(0);
    expect(result.warnings.some((w) => w.includes('catch-all'))).toBe(true);
  });

  it('requires the marker to be exported', () => {
    const result = discover({
      '/proj/app/about/page.tsx': `interface CmsContent { heading: string; }`,
    });
    expect(result.models).toHaveLength(0);
  });

  it('honours ignore globs', () => {
    const result = discover(
      {
        '/proj/app/about/page.tsx': `export interface CmsContent { heading: string; }`,
        '/proj/app/admin/page.tsx': `export interface CmsContent { heading: string; }`,
      },
      ['admin/**', 'admin'],
    );
    expect(result.models.map((m) => m.name)).toEqual(['about']);
    expect(result.warnings.some((w) => w.includes('ignored'))).toBe(true);
  });
});
