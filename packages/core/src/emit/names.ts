/**
 * Deterministic name transforms shared by the emitter (T03) and IR builder (T06).
 * Determinism matters: golden tests assert byte-for-byte output.
 */

/** `BlogPost` / `blog post` / `blog_post` -> `blog-post`. */
export function toKebab(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** `blog-post` -> `blog_post` (Strapi table names use snake_case). */
export function toSnake(input: string): string {
  return toKebab(input).replace(/-/g, '_');
}

/**
 * Naive English pluralisation — deterministic and good enough for table names.
 * Strapi reads `collectionName` from the file, so this only needs to be stable + unique.
 */
export function pluralize(word: string): string {
  if (!word) return word;
  if (/[^aeiou]y$/i.test(word)) return word.replace(/y$/i, 'ies');
  if (/(s|x|z|ch|sh)$/i.test(word)) return `${word}es`;
  return `${word}s`;
}

/** Uncountable / irregular words we must not naively de-pluralise. */
const UNCOUNTABLE: ReadonlySet<string> = new Set(['news', 'series', 'media', 'home', 'faq']);

/** Naive singularisation, conservative to avoid mangling non-plural folder names. */
export function singularize(word: string): string {
  const w = toKebab(word);
  if (UNCOUNTABLE.has(w)) return w;
  if (/ies$/.test(w)) return w.replace(/ies$/, 'y');
  if (/(s|x|z|ch|sh)es$/.test(w)) return w.replace(/es$/, '');
  if (/ss$/.test(w)) return w; // address
  if (/s$/.test(w) && w.length > 3) return w.replace(/s$/, '');
  return w;
}

/** `blog-post` -> `Blog Post`. */
export function humanize(input: string): string {
  return toKebab(input)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const COMPONENT_NAME_SUFFIXES = /(props|component|block|section|type|model|fields)$/i;

/** Derive a kebab component name from a TS type name, stripping noise suffixes. */
export function componentNameFrom(typeName: string): string {
  const stripped = typeName.replace(COMPONENT_NAME_SUFFIXES, '');
  const kebab = toKebab(stripped || typeName);
  return kebab || 'component';
}

/** DB table name for a content type, e.g. `blog-post` -> `blog_posts`. */
export function contentTypeCollectionName(singularName: string): string {
  return toSnake(pluralize(singularName));
}

/** DB table name for a component, e.g. (`sections`, `hero`) -> `components_sections_heroes`. */
export function componentCollectionName(category: string, name: string): string {
  return `components_${toSnake(category)}_${toSnake(pluralize(name))}`;
}

/** Repo-relative path of a content type schema file. */
export function contentTypeSchemaPath(singularName: string): string {
  return `src/api/${singularName}/content-types/${singularName}/schema.json`;
}

/** Repo-relative path of a component schema file. */
export function componentSchemaPath(category: string, name: string): string {
  return `src/components/${category}/${name}.json`;
}
