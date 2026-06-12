/**
 * Parse `@cms ...` JSDoc directives attached to a prop into structured hints.
 * T04 only captures them; T16 layers on the config-file overrides.
 */
import { Node, type JSDocableNode } from 'ts-morph';
import type { RelationKind } from '../ir/types.js';
import type { CmsHints } from './field-tree.js';

const RELATION_KINDS: ReadonlySet<string> = new Set([
  'oneToOne',
  'oneToMany',
  'manyToOne',
  'manyToMany',
]);

/** Extract `@cms` tag bodies from a declaration node, if it can carry JSDoc. */
export function readCmsTags(decl: Node | undefined): string[] {
  if (!decl || !Node.isJSDocable(decl)) return [];
  const tags: string[] = [];
  for (const doc of (decl as JSDocableNode).getJsDocs()) {
    for (const tag of doc.getTags()) {
      if (tag.getTagName() === 'cms') {
        tags.push((tag.getCommentText() ?? '').trim());
      }
    }
  }
  return tags;
}

export function parseCmsHints(tags: string[]): CmsHints {
  const hints: CmsHints = { raw: tags };
  for (const tag of tags) {
    const tokens = tag.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    const [directive, ...rest] = tokens;
    switch (directive) {
      case 'ignore':
        hints.ignore = true;
        break;
      case 'relation': {
        const [cardinality, target] = rest;
        if (cardinality && RELATION_KINDS.has(cardinality) && target) {
          hints.relation = { cardinality: cardinality as RelationKind, target };
        }
        break;
      }
      default:
        // Treat the first token as a Strapi type override (richtext, text, decimal, media, ...).
        hints.typeOverride = directive;
        break;
    }
  }
  return hints;
}

/** Convenience: read + parse in one step. */
export function readHints(decl: Node | undefined): CmsHints {
  return parseCmsHints(readCmsTags(decl));
}
