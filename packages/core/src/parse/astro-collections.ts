/**
 * Astro content-collections parser (T11). Statically reads the Zod schemas in
 * `src/content.config.ts` (or legacy `src/content/config.ts`) into the same field
 * tree the TS reader produces — no code execution. Each collection becomes a
 * Strapi collection type.
 *
 * Supported Zod shapes: string/number/boolean/date, enum, array, object, union,
 * `.optional()`/`.nullish()`, `z.coerce.date()`, and the Astro `image()` helper.
 * Unsupported shapes are skipped with a reason.
 */
import {
  Node,
  type CallExpression,
  type Expression,
  type ObjectLiteralExpression,
  type SourceFile,
} from 'ts-morph';
import type { RawField, RawObjectType, RawType, ReadResult } from './field-tree.js';

export interface AstroCollection {
  name: string;
  read: ReadResult;
}

type Classified = { type: RawType } | { skip: string };

const MODIFIERS_MAKING_OPTIONAL = new Set(['optional', 'nullish']);
const PASSTHROUGH_MODIFIERS = new Set([
  'nullable',
  'default',
  'describe',
  'min',
  'max',
  'length',
  'email',
  'url',
  'uuid',
  'regex',
  'positive',
  'int',
  'transform',
  'refine',
  'catch',
  'brand',
  'readonly',
]);

/** Peel chained modifier calls (`.optional()`, `.min(1)`, …) down to the base z-call. */
function peel(expr: Expression): { base: Expression; optional: boolean } {
  let optional = false;
  let cur: Expression = expr;
  while (Node.isCallExpression(cur)) {
    const callee = cur.getExpression();
    if (!Node.isPropertyAccessExpression(callee)) break;
    const method = callee.getName();
    const target = callee.getExpression();
    if (!Node.isCallExpression(target)) break; // reached z.<type>(...)
    if (MODIFIERS_MAKING_OPTIONAL.has(method)) optional = true;
    else if (!PASSTHROUGH_MODIFIERS.has(method)) break; // unknown method: stop here
    cur = target;
  }
  return { base: cur, optional };
}

function firstObjectArg(call: CallExpression): ObjectLiteralExpression | undefined {
  const arg = call.getArguments()[0];
  return arg && Node.isObjectLiteralExpression(arg) ? arg : undefined;
}

function enumValues(call: CallExpression): string[] | undefined {
  const arg = call.getArguments()[0];
  if (!arg || !Node.isArrayLiteralExpression(arg)) return undefined;
  const values: string[] = [];
  for (const el of arg.getElements()) {
    if (Node.isStringLiteral(el)) values.push(el.getLiteralValue());
    else return undefined;
  }
  return values;
}

function isImageCall(expr: Expression): boolean {
  return Node.isCallExpression(expr) && Node.isIdentifier(expr.getExpression()) &&
    expr.getExpression().getText() === 'image';
}

function classify(expr: Expression): Classified {
  if (isImageCall(expr)) return { type: { kind: 'media', multiple: false } };

  const { base } = peel(expr);
  if (!Node.isCallExpression(base)) return { skip: 'unrecognised zod expression' };

  const callee = base.getExpression();
  if (!Node.isPropertyAccessExpression(callee)) {
    return isImageCall(base) ? { type: { kind: 'media', multiple: false } } : { skip: 'unrecognised zod call' };
  }

  const method = callee.getName();
  const target = callee.getExpression();
  const targetText = target.getText();

  // z.coerce.date()
  if (method === 'date') return { type: { kind: 'scalar', scalar: 'datetime' } };
  if (targetText !== 'z') return { skip: `unsupported zod namespace "${targetText}"` };

  switch (method) {
    case 'string':
      return { type: { kind: 'scalar', scalar: 'string' } };
    case 'number':
      return { type: { kind: 'scalar', scalar: 'integer' } };
    case 'boolean':
      return { type: { kind: 'scalar', scalar: 'boolean' } };
    case 'enum': {
      const values = enumValues(base);
      return values ? { type: { kind: 'enum', values } } : { skip: 'unsupported enum' };
    }
    case 'literal':
      return { type: { kind: 'scalar', scalar: 'string' } };
    case 'object': {
      const obj = firstObjectArg(base);
      return obj
        ? { type: { kind: 'object', object: zodObject(obj), repeatable: false } }
        : { skip: 'object without literal shape' };
    }
    case 'array':
      return classifyArray(base);
    case 'union':
      return classifyUnion(base);
    default:
      return { skip: `unsupported zod type "${method}"` };
  }
}

function classifyArray(call: CallExpression): Classified {
  const el = call.getArguments()[0];
  if (!el || !Node.isExpression(el)) return { skip: 'unresolved array element' };
  if (isImageCall(el)) return { type: { kind: 'media', multiple: true } };

  const { base } = peel(el);
  if (Node.isCallExpression(base)) {
    const callee = base.getExpression();
    if (Node.isPropertyAccessExpression(callee)) {
      const method = callee.getName();
      if (method === 'object') {
        const obj = firstObjectArg(base);
        if (obj) return { type: { kind: 'object', object: zodObject(obj), repeatable: true } };
      }
      if (method === 'union') return classifyUnion(base);
    }
  }
  return { skip: 'array of scalars is not directly representable (use a nested object)' };
}

function classifyUnion(call: CallExpression): Classified {
  const arg = call.getArguments()[0];
  if (!arg || !Node.isArrayLiteralExpression(arg)) return { skip: 'unsupported union' };
  const members: RawObjectType[] = [];
  for (const el of arg.getElements()) {
    const { base } = peel(el);
    if (!Node.isCallExpression(base)) return { skip: 'union of non-objects' };
    const callee = base.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'object') {
      return { skip: 'union members must be z.object(...)' };
    }
    const obj = firstObjectArg(base);
    if (!obj) return { skip: 'union object without literal shape' };
    members.push(zodObject(obj));
  }
  return { type: { kind: 'dynamiczone', members } };
}

function zodObject(obj: ObjectLiteralExpression): RawObjectType {
  const fields: RawField[] = [];
  for (const prop of obj.getProperties()) {
    if (!Node.isPropertyAssignment(prop)) continue;
    const name = prop.getName().replace(/^['"]|['"]$/g, '');
    const initializer = prop.getInitializer();
    if (!initializer || !Node.isExpression(initializer)) continue;
    const { optional } = peel(initializer);
    const classified = classify(initializer);
    if ('skip' in classified) continue;
    fields.push({ name, required: !optional, type: classified.type, hints: { raw: [] } });
  }
  return { fields };
}

/** Resolve a `schema:` value to its z.object literal (handles the `({ image }) => z.object(...)` form). */
function resolveSchemaObject(expr: Expression): ObjectLiteralExpression | undefined {
  let body: Node | undefined = expr;
  if (Node.isArrowFunction(expr) || Node.isFunctionExpression(expr)) {
    const fnBody = expr.getBody();
    body = Node.isParenthesizedExpression(fnBody) ? fnBody.getExpression() : fnBody;
  }
  if (body && Node.isCallExpression(body)) {
    const callee = body.getExpression();
    if (Node.isPropertyAccessExpression(callee) && callee.getName() === 'object') {
      return firstObjectArg(body);
    }
  }
  return undefined;
}

export function readAstroCollections(sourceFile: SourceFile): AstroCollection[] {
  const decl = sourceFile.getVariableDeclaration('collections');
  const init = decl?.getInitializer();
  if (!init || !Node.isObjectLiteralExpression(init)) return [];

  const collections: AstroCollection[] = [];
  for (const prop of init.getProperties()) {
    let name: string;
    let value: Expression | undefined;
    if (Node.isPropertyAssignment(prop)) {
      // `blog: defineCollection(...)`
      name = prop.getName().replace(/^['"]|['"]$/g, '');
      value = prop.getInitializer();
    } else if (Node.isShorthandPropertyAssignment(prop)) {
      // `{ blog }` — resolve to the `const blog = defineCollection(...)` initializer
      name = prop.getName();
      value = sourceFile.getVariableDeclaration(name)?.getInitializer();
    } else {
      continue;
    }
    if (!value || !Node.isCallExpression(value)) continue; // expect defineCollection(...)

    const configArg = firstObjectArg(value);
    const schemaProp = configArg?.getProperty('schema');
    if (!schemaProp || !Node.isPropertyAssignment(schemaProp)) continue;
    const schemaExpr = schemaProp.getInitializer();
    if (!schemaExpr || !Node.isExpression(schemaExpr)) continue;

    const obj = resolveSchemaObject(schemaExpr);
    if (!obj) continue;
    collections.push({ name, read: { object: zodObject(obj), skipped: [] } });
  }
  return collections;
}
