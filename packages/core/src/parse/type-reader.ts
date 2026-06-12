/**
 * ts-morph powered reader: a TS object type (interface / type alias / inline object)
 * -> a framework-agnostic `RawObjectType` field tree, applying the prop-filter rules
 * (FR1.4) and capturing `@cms` hints. Knows nothing about Strapi UIDs or pluralisation.
 */
import { Node, Project, SymbolFlags, type SourceFile, type Type } from 'ts-morph';
import type { ScalarType } from '../ir/types.js';
import { readHints } from './cms-hints.js';
import type { CmsHints, RawField, RawObjectType, RawType, ReadResult } from './field-tree.js';

/** Props that are UI plumbing, never content. */
const SKIP_PROP_NAMES: ReadonlySet<string> = new Set([
  'className',
  'class',
  'style',
  'children',
  'key',
  'ref',
  'dangerouslySetInnerHTML',
]);

const SCALAR_OVERRIDES: ReadonlySet<string> = new Set<ScalarType>([
  'string',
  'text',
  'richtext',
  'email',
  'password',
  'uid',
  'integer',
  'biginteger',
  'float',
  'decimal',
  'boolean',
  'date',
  'time',
  'datetime',
  'json',
]);

const MEDIA_TYPE_NAME_RE = /^(image|images|media|asset|assets|file|files|photo|picture)/i;
const MEDIA_PROP_NAME_RE =
  /^(image|images|cover|photo|avatar|icon|thumbnail|banner|logo|picture|media|gallery|files|attachments?)$/i;

/** Create an in-memory project (used by tests and ad-hoc snippet parsing). */
export function createInMemoryProject(files: Record<string, string>): Project {
  const project = new Project({
    useInMemoryFileSystem: true,
    compilerOptions: { strict: true, jsx: 4 /* react-jsx */ },
  });
  for (const [path, content] of Object.entries(files)) {
    project.createSourceFile(path, content, { overwrite: true });
  }
  return project;
}

type Classified = { type: RawType } | { skip: string };

function meaningfulTypeName(type: Type): string | undefined {
  const name = type.getAliasSymbol()?.getName() ?? type.getSymbol()?.getName();
  if (!name || name === '__type' || name === '__object' || name === 'Array') return undefined;
  return name;
}

function nonNullableConstituents(type: Type): Type[] {
  if (!type.isUnion()) return [type];
  return type.getUnionTypes().filter((t) => !t.isUndefined() && !t.isNull());
}

function isCallable(type: Type): boolean {
  return type.getCallSignatures().length > 0;
}

function isObjectLike(type: Type): boolean {
  return type.isObject() && !type.isArray() && !isCallable(type);
}

const MEDIA_SIBLING_PROPS = ['alt', 'width', 'height', 'mime', 'formats', 'ext', 'hash', 'provider'];

function isMediaShape(type: Type, propName: string): boolean {
  const name = type.getAliasSymbol()?.getName() ?? type.getSymbol()?.getName();
  if (name && MEDIA_TYPE_NAME_RE.test(name)) return true;
  // A `{ url, alt | width | mime | ... }` object resembles a Strapi media object.
  if (
    isObjectLike(type) &&
    type.getProperty('url') &&
    MEDIA_SIBLING_PROPS.some((s) => type.getProperty(s))
  ) {
    return true;
  }
  if (MEDIA_PROP_NAME_RE.test(propName) && (type.isAny() || isObjectLike(type))) return true;
  return false;
}

function readObjectType(
  type: Type,
  location: Node,
  visited: Set<string>,
  skipped?: { name: string; reason: string }[],
): RawObjectType {
  const typeName = meaningfulTypeName(type);
  const fields: RawField[] = [];

  for (const sym of type.getProperties()) {
    const name = sym.getName();
    const decl = sym.getDeclarations()[0];
    const hints = readHints(decl);

    if (SKIP_PROP_NAMES.has(name)) {
      skipped?.push({ name, reason: 'ui prop' });
      continue;
    }
    if (hints.ignore) {
      skipped?.push({ name, reason: 'cms ignore' });
      continue;
    }

    const propType = decl ? sym.getTypeAtLocation(decl) : sym.getTypeAtLocation(location);
    if (isCallable(propType)) {
      skipped?.push({ name, reason: 'function' });
      continue;
    }

    const required = !sym.hasFlags(SymbolFlags.Optional);
    const classified = classifyType(propType, decl ?? location, hints, name, visited);
    if ('skip' in classified) {
      skipped?.push({ name, reason: classified.skip });
      continue;
    }
    fields.push({ name, required, type: classified.type, hints });
  }

  return typeName ? { typeName, fields } : { fields };
}

function classifyType(
  type: Type,
  location: Node,
  hints: CmsHints,
  propName: string,
  visited: Set<string>,
): Classified {
  // 1. Explicit relation annotation wins (TS cannot express relations).
  if (hints.relation) {
    return {
      type: { kind: 'relation', cardinality: hints.relation.cardinality, target: hints.relation.target },
    };
  }

  // 2. Scalar / media overrides.
  if (hints.typeOverride) {
    if (hints.typeOverride === 'media') {
      return { type: { kind: 'media', multiple: type.isArray() } };
    }
    if (SCALAR_OVERRIDES.has(hints.typeOverride)) {
      return { type: { kind: 'scalar', scalar: hints.typeOverride as ScalarType } };
    }
  }

  const parts = nonNullableConstituents(type);

  // `boolean` is internally `true | false`; collapse it (and optional booleans) first.
  if (type.isBoolean() || (parts.length > 0 && parts.every((p) => p.isBooleanLiteral()))) {
    return { type: { kind: 'scalar', scalar: 'boolean' } };
  }

  // 3. Unions (after dropping undefined/null).
  if (parts.length > 1) {
    if (parts.every((p) => p.isStringLiteral())) {
      return { type: { kind: 'enum', values: parts.map((p) => String(p.getLiteralValue())) } };
    }
    if (parts.every((p) => p.isNumberLiteral())) {
      return { type: { kind: 'scalar', scalar: 'integer' } };
    }
    if (parts.every((p) => isObjectLike(p))) {
      return { type: { kind: 'dynamiczone', members: parts.map((p) => readObjectType(p, location, visited)) } };
    }
    return { skip: 'unsupported union of mixed types' };
  }

  const t = parts[0] ?? type;

  // 4. Arrays.
  if (t.isArray()) {
    const el = t.getArrayElementType();
    if (!el) return { skip: 'unresolved array element' };
    const elParts = nonNullableConstituents(el);
    if (elParts.length > 1 && elParts.every((p) => isObjectLike(p))) {
      return { type: { kind: 'dynamiczone', members: elParts.map((p) => readObjectType(p, location, visited)) } };
    }
    if (isMediaShape(el, propName)) {
      return { type: { kind: 'media', multiple: true } };
    }
    if (isObjectLike(el)) {
      const nested = recurseObject(el, location, visited);
      if (!nested) return { skip: 'recursive type' };
      return { type: { kind: 'object', object: nested, repeatable: true } };
    }
    return { skip: 'array of scalars is not directly representable (use a component or @cms)' };
  }

  // 5. Media (single).
  if (isMediaShape(t, propName)) {
    return { type: { kind: 'media', multiple: false } };
  }

  // 6. Primitives.
  if (t.isBoolean() || t.isBooleanLiteral()) return { type: { kind: 'scalar', scalar: 'boolean' } };
  if (t.isNumber() || t.isNumberLiteral()) return { type: { kind: 'scalar', scalar: 'integer' } };
  if (t.getSymbol()?.getName() === 'Date') return { type: { kind: 'scalar', scalar: 'datetime' } };
  if (t.isStringLiteral()) return { type: { kind: 'enum', values: [String(t.getLiteralValue())] } };
  if (t.isString()) return { type: { kind: 'scalar', scalar: 'string' } };

  // 7. Nested object → component.
  if (isObjectLike(t)) {
    const nested = recurseObject(t, location, visited);
    if (!nested) return { skip: 'recursive type' };
    return { type: { kind: 'object', object: nested, repeatable: false } };
  }

  return { skip: 'unsupported or unresolved type' };
}

/** Recurse into an object type while guarding against self-referential loops. */
function recurseObject(type: Type, location: Node, visited: Set<string>): RawObjectType | undefined {
  const name = meaningfulTypeName(type);
  if (name) {
    if (visited.has(name)) return undefined;
    const next = new Set(visited);
    next.add(name);
    return readObjectType(type, location, next);
  }
  return readObjectType(type, location, visited);
}

/** Read a named interface / type alias from a source file into a field tree. */
export function readNamedType(sourceFile: SourceFile, typeName: string): ReadResult | undefined {
  const decl =
    sourceFile.getInterface(typeName) ??
    sourceFile.getTypeAlias(typeName) ??
    undefined;
  if (!decl) return undefined;
  return readDeclaredType(decl);
}

/** Read any interface/type-alias/declaration node that resolves to an object type. */
export function readDeclaredType(decl: Node): ReadResult {
  const type = (decl as Node & { getType: () => Type }).getType();
  const skipped: { name: string; reason: string }[] = [];
  const visited = new Set<string>();
  const name = meaningfulTypeName(type);
  if (name) visited.add(name);
  const object = readObjectType(type, decl, visited, skipped);
  return { object, skipped };
}

/** Read a `Type` directly (used when discovery already holds a checker Type). */
export function readType(type: Type, location: Node): RawObjectType {
  const visited = new Set<string>();
  const name = meaningfulTypeName(type);
  if (name) visited.add(name);
  return readObjectType(type, location, visited);
}
