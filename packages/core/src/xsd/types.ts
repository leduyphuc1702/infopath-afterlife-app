// The field tree (design §5.2, R14). Type names are strings: `xsd:string` for XML Schema built-ins,
// `{uri}local` for other namespaces, `local` for no namespace (the path convention, §7.3).

import type { Located } from '../unknown';
import type { Facet as FacetName, SharePointAttr } from './vocabulary';

export type TypeName = string;

export interface FieldTree {
  readonly file: string;
  readonly root: FieldNode;
}

export interface Facet {
  readonly name: FacetName;
  /** `value`, as written. */
  readonly value: string;
  readonly fixed?: string;
  readonly source: Located;
}

/** An enclosing particle, as written (R14.2). */
export interface GroupStep {
  readonly kind: 'sequence' | 'choice' | 'all' | 'group';
  /** `group` steps: the referenced model group. */
  readonly ref?: TypeName;
  readonly minOccurs?: string;
  readonly maxOccurs?: string;
}

export interface Wildcard {
  readonly kind: 'any' | 'anyAttribute';
  readonly namespace?: string;
  readonly processContents?: string;
  readonly minOccurs?: string;
  readonly maxOccurs?: string;
}

export interface FieldNode {
  readonly name: string;
  readonly namespace: string | null;
  readonly nodeType: 'element' | 'attribute';
  /** From the content model only (R14.1, design §9.2). */
  readonly kind: 'group' | 'field' | 'richText';
  readonly xsdType: {
    /** The `type` attribute, resolved; absent for an inline or missing type. */
    readonly declared?: TypeName;
    /** The XML Schema built-in at the end of the derivation chain. */
    readonly builtin: TypeName;
    readonly variety: 'atomic' | 'list' | 'union' | 'complex';
    readonly itemType?: TypeName;
    readonly memberTypes?: readonly TypeName[];
  };
  /** Strings as written, absent when absent (R14.2). */
  readonly raw: {
    readonly minOccurs?: string;
    readonly maxOccurs?: string;
    readonly nillable?: string;
    readonly use?: string;
    /** Enclosing particles inside the parent's content model, outermost first. */
    readonly groups: readonly GroupStep[];
  };
  readonly effective: {
    readonly minOccurs: number;
    readonly maxOccurs: number | 'unbounded';
    readonly nillable: boolean;
  };
  readonly repeating: boolean;
  readonly optional: boolean;
  /** Set by task 20 (R14.4); false until then. */
  readonly required: boolean;
  /** Shared by the alternatives of the nearest enclosing xsd:choice (R14.5). */
  readonly choiceGroup?: string;
  /** Base type's facets first, then each derivation's, in declaration order (R14.7). */
  readonly facets: readonly Facet[];
  readonly default?: string;
  readonly fixed?: string;
  /** `xsd:any` (other than rich text) and `xsd:anyAttribute`, in document order (R14.6). */
  readonly wildcards: readonly Wildcard[];
  /**
   * Expansion stopped here because the content refers back to an ancestor (R15.3): the element
   * or its type is already being expanded, or a model group refers to itself (the element whose
   * content holds that group is marked).
   */
  readonly recursive: boolean;
  /** The first `xsd:annotation/xsd:documentation` of the declaration, its text verbatim. */
  readonly description?: string;
  /**
   * SharePoint `ma:` attributes of the declaration, by local name, as written; absent when the
   * declaration has none (R21.5).
   */
  readonly sharePoint?: Readonly<Partial<Record<SharePointAttr, string>>>;
  /** The declaration. */
  readonly source: Located;
  /** The `ref` site, when it is not the declaration. */
  readonly use?: Located;
  /** Elements in content-model order (base type's first), then attributes in declaration order. */
  readonly children: readonly FieldNode[];
}
