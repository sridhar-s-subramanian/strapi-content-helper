/**
 * The "field tree" — a framework-agnostic, pre-IR description of a TS prop type.
 * The type reader (T04) produces this; the IR builder (T06) turns it into Strapi
 * models/components (assigning component UIDs, pluralising names, resolving relations).
 *
 * It intentionally does NOT know about Strapi UIDs or pluralisation.
 */
import type { RelationKind, ScalarType } from '../ir/types.js';

/** Parsed `@cms ...` JSDoc directives. Interpretation is finalised in T16. */
export interface CmsHints {
  /** `@cms ignore` — drop this prop entirely. */
  ignore?: boolean;
  /** `@cms <type>` — force a Strapi type (e.g. `richtext`, `text`, `decimal`, `media`). */
  typeOverride?: string;
  /** `@cms relation <cardinality> <target>` — declare a relation TS can't express. */
  relation?: { cardinality: RelationKind; target: string };
  /** Raw tag bodies, preserved for T16 / diagnostics. */
  raw: string[];
}

export interface RawObjectType {
  /** Named type symbol (e.g. `HeroProps`) when resolvable — drives component naming. */
  typeName?: string;
  fields: RawField[];
}

export type RawType =
  | { kind: 'scalar'; scalar: ScalarType }
  | { kind: 'enum'; values: string[] }
  | { kind: 'media'; multiple: boolean }
  /** Nested object → (repeatable) component. */
  | { kind: 'object'; object: RawObjectType; repeatable: boolean }
  /** Union of object types → dynamic zone (Strapi dynamic zones are always arrays). */
  | { kind: 'dynamiczone'; members: RawObjectType[] }
  | { kind: 'relation'; cardinality: RelationKind; target: string };

export interface RawField {
  name: string;
  required: boolean;
  type: RawType;
  hints: CmsHints;
}

/** A prop that was deliberately not mapped, with a human-readable reason (diagnostics). */
export interface SkippedField {
  name: string;
  reason: string;
}

export interface ReadResult {
  object: RawObjectType;
  skipped: SkippedField[];
}
