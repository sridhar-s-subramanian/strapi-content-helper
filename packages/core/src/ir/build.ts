/**
 * IR builder (T06): DiscoveredModel field trees -> validated `Ir`.
 *
 * Responsibilities:
 *  - convert raw field types to IR `Field`s,
 *  - register nested objects / object arrays as reusable components (deduped by UID),
 *  - turn unions of objects into dynamic zones,
 *  - resolve `@cms relation` targets to content-type UIDs,
 *  - apply the collision policy (error, or namespace per source).
 */
import type { DiscoveredModel } from '../discover/types.js';
import { componentNameFrom, humanize, pluralize, singularize, toKebab } from '../emit/names.js';
import { componentUid, contentTypeUid } from './types.js';
import type {
  ComponentDef,
  ContentModel,
  Field,
  Ir,
  SourceKind,
} from './types.js';
import type { RawField, RawObjectType } from '../parse/field-tree.js';

export interface BuildIrOptions {
  /** Default component category folder. Default `sections`. */
  componentCategory?: string;
  /** Prefix categories + model names with the source to avoid cross-framework collisions. */
  namespaceBySource?: boolean;
  /** draftAndPublish defaults per kind. */
  draftAndPublish?: { collection?: boolean; single?: boolean };
}

export interface BuildIrResult {
  ir: Ir;
  warnings: string[];
  errors: string[];
}

interface BuildContext {
  baseCategory: string;
  source: SourceKind;
  components: Map<string, ComponentDef>;
  errors: string[];
  namespaceBySource: boolean;
}

function categoryFor(ctx: BuildContext): string {
  return ctx.namespaceBySource ? `${ctx.source}-${ctx.baseCategory}` : ctx.baseCategory;
}

function sameShape(a: ComponentDef | ContentModel, b: ComponentDef | ContentModel): boolean {
  return JSON.stringify(a.fields) === JSON.stringify(b.fields);
}

function registerComponent(def: ComponentDef, ctx: BuildContext): void {
  const uid = componentUid(def.category, def.name);
  const existing = ctx.components.get(uid);
  if (!existing) {
    ctx.components.set(uid, def);
    return;
  }
  if (!sameShape(existing, def)) {
    ctx.errors.push(
      `component "${uid}" is defined with conflicting shapes (${existing.source ?? '?'} vs ${def.source ?? '?'}); ` +
        `enable namespaceBySource or reconcile the types`,
    );
  }
}

function registerComponentFromRaw(obj: RawObjectType, ctx: BuildContext, nameHint: string): string {
  const baseName = componentNameFrom(obj.typeName ?? nameHint);
  const category = categoryFor(ctx);
  const uid = componentUid(category, baseName);
  // Build fields first (may register nested components), then register this one.
  const fields = buildFields(obj.fields, ctx);
  registerComponent(
    { category, name: baseName, displayName: humanize(baseName), fields, source: ctx.source },
    ctx,
  );
  return uid;
}

function buildField(raw: RawField, ctx: BuildContext): Field {
  const base = { name: raw.name, required: raw.required };
  switch (raw.type.kind) {
    case 'scalar':
      return { ...base, type: raw.type.scalar };
    case 'enum':
      return { ...base, type: 'enumeration', values: raw.type.values };
    case 'media':
      return { ...base, type: 'media', multiple: raw.type.multiple };
    case 'relation': {
      const singular = singularize(toKebab(raw.type.target));
      return { ...base, type: 'relation', relation: raw.type.cardinality, target: contentTypeUid(singular) };
    }
    case 'object': {
      const uid = registerComponentFromRaw(raw.type.object, ctx, raw.name);
      return { ...base, type: 'component', component: uid, repeatable: raw.type.repeatable };
    }
    case 'dynamiczone': {
      const uids = raw.type.members.map((m) => registerComponentFromRaw(m, ctx, raw.name));
      return { ...base, type: 'dynamiczone', components: uids };
    }
  }
}

function buildFields(rawFields: RawField[], ctx: BuildContext): Field[] {
  return rawFields.map((rf) => buildField(rf, ctx));
}

export function buildIr(discovered: DiscoveredModel[], opts: BuildIrOptions = {}): BuildIrResult {
  const baseCategory = opts.componentCategory ?? 'sections';
  const namespaceBySource = opts.namespaceBySource ?? false;
  const dapCollection = opts.draftAndPublish?.collection ?? true;
  const dapSingle = opts.draftAndPublish?.single ?? false;

  const components = new Map<string, ComponentDef>();
  const errors: string[] = [];
  const warnings: string[] = [];
  const modelMap = new Map<string, ContentModel>();

  for (const d of discovered) {
    const ctx: BuildContext = { baseCategory, source: d.source, components, errors, namespaceBySource };
    const fields = buildFields(d.read.object.fields, ctx);

    const prefix = namespaceBySource ? `${d.source}-` : '';
    const singularName = `${prefix}${singularize(toKebab(d.name))}`;
    let pluralName = pluralize(singularName);
    if (pluralName === singularName) pluralName = `${singularName}-items`;

    const model: ContentModel = {
      kind: d.kind,
      singularName,
      pluralName,
      displayName: humanize(singularName),
      draftAndPublish: d.kind === 'collection' ? dapCollection : dapSingle,
      source: d.source,
      fields,
    };

    const existing = modelMap.get(singularName);
    if (existing) {
      if (!sameShape(existing, model)) {
        errors.push(
          `content type "${singularName}" is defined with conflicting shapes (${existing.source ?? '?'} vs ${model.source ?? '?'}); ` +
            `enable namespaceBySource or reconcile the sources`,
        );
      }
      continue;
    }
    modelMap.set(singularName, model);
  }

  const ir: Ir = {
    models: [...modelMap.values()].sort((a, b) => a.singularName.localeCompare(b.singularName)),
    components: [...components.values()].sort((a, b) =>
      componentUid(a.category, a.name).localeCompare(componentUid(b.category, b.name)),
    ),
  };

  return { ir, warnings, errors };
}
