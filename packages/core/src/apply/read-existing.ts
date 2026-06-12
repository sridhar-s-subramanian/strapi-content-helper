/**
 * Read the schema files already present in a Strapi project into merge units ("ours").
 * Scans `src/api/<api>/content-types/<ct>/schema.json` and `src/components/<cat>/<name>.json`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { SchemaDoc, SchemaUnit } from '../merge/types.js';

export interface ReadExistingResult {
  units: SchemaUnit[];
  warnings: string[];
}

function readJson(path: string): SchemaDoc | null {
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8')) as SchemaDoc;
    if (!doc.attributes || typeof doc.attributes !== 'object') doc.attributes = {};
    return doc;
  } catch {
    return null;
  }
}

function dirs(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path).filter((name) => statSync(join(path, name)).isDirectory());
}

export function readExistingSchemas(strapiRoot: string): ReadExistingResult {
  const units: SchemaUnit[] = [];
  const warnings: string[] = [];

  // Content types: src/api/<api>/content-types/<ct>/schema.json
  const apiRoot = join(strapiRoot, 'src', 'api');
  for (const api of dirs(apiRoot)) {
    const ctRoot = join(apiRoot, api, 'content-types');
    for (const ct of dirs(ctRoot)) {
      const file = join(ctRoot, ct, 'schema.json');
      if (!existsSync(file)) continue;
      const doc = readJson(file);
      if (!doc) {
        warnings.push(`could not parse ${file}; ignoring`);
        continue;
      }
      const singular =
        (doc.info as { singularName?: string } | undefined)?.singularName ?? ct;
      units.push({
        uid: `api::${singular}.${singular}`,
        path: `src/api/${api}/content-types/${ct}/schema.json`,
        kind: 'contentType',
        schema: doc,
      });
    }
  }

  // Components: src/components/<category>/<name>.json
  const compRoot = join(strapiRoot, 'src', 'components');
  for (const category of dirs(compRoot)) {
    const catDir = join(compRoot, category);
    for (const file of readdirSync(catDir)) {
      if (!file.endsWith('.json')) continue;
      const doc = readJson(join(catDir, file));
      if (!doc) {
        warnings.push(`could not parse ${join(catDir, file)}; ignoring`);
        continue;
      }
      const name = file.replace(/\.json$/, '');
      units.push({
        uid: `${category}.${name}`,
        path: `src/components/${category}/${file}`,
        kind: 'component',
        schema: doc,
      });
    }
  }

  return { units, warnings };
}
