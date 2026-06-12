/** Types for the 3-way merge (T07). The merge itself is pure — no filesystem. */

export type SchemaKind = 'contentType' | 'component';

/** A schema document with an attributes map; other keys (info, options, …) are preserved. */
export interface SchemaDoc {
  attributes: Record<string, unknown>;
  [key: string]: unknown;
}

/** One schema file's identity + content, as seen in base (lock) / ours (disk) / theirs (generated). */
export interface SchemaUnit {
  uid: string;
  path: string;
  kind: SchemaKind;
  schema: SchemaDoc;
}

export type AttrChangeType =
  | 'add'
  | 'update'
  | 'remove' // applied (prune)
  | 'remove-pending' // would remove, but kept because --prune was not set
  | 'conflict'
  | 'rename';

export interface AttrChange {
  attr: string;
  type: AttrChangeType;
  detail?: string;
}

export type UnitStatus = 'create' | 'update' | 'unchanged';

export interface UnitResult {
  uid: string;
  path: string;
  kind: SchemaKind;
  status: UnitStatus;
  /** The schema to write for create/update; equals ours for unchanged. */
  merged: SchemaDoc;
  changes: AttrChange[];
}

export interface MergeOptions {
  /** Apply generator-side changes even when the user also edited the attribute. */
  force?: boolean;
  /** Actually delete attributes that the source no longer produces. */
  prune?: boolean;
}

export interface ChangeSet {
  units: UnitResult[];
  warnings: string[];
  hasConflicts: boolean;
  /** True when there are removals deferred because --prune was not set. */
  hasPendingPrune: boolean;
}
